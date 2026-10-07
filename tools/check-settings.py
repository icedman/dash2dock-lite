#!/usr/bin/env python3
"""Settings consistency checker for Dash2Dock Animated (stdlib only).

Cross-checks the four places a setting lives:

  schema   schemas/*.gschema.xml           <key name="foo-bar">
  keys.js  preferences/keys.js              'foo-bar': { widget_type: ... }
  ui       ui/*.ui (not ui/legacy/)         <object class="GtkSwitch" id="foo-bar">
  runtime  runtime JS (see RUNTIME_GLOBS)   this.foo_bar / extension.foo_bar / ...

Heuristics (deliberately simple regex, not a JS/XML-semantic analysis):

  * keys.js: comments are stripped, then every `'name': {` at 4-space indent
    inside setKeys({...}) is a key; its widget_type is the first
    `widget_type: '...'` before the next key.
  * ui: only objects whose class is a value widget (SETTING_WIDGET_CLASSES) are
    treated as setting widgets. prefKeys.connectBuilder binds them via
    builder.get_object(<key name>), so widget id == key name.
  * runtime read: the snake_case name accessed as a property (`.foo_bar`, so
    `this.`, `extension.`, `this.extension.`, `dock.extension.`, ... all count),
    or the dashed name passed to getValue()/get_<type>() as a string. The
    settings mirror (`this[n] = value`) and `case 'foo-bar':` labels are *not*
    reads: a reaction that only re-styles does not use the value.
  * switch/case: a small tokenizer skips strings/comments/regex-ish literals,
    tracks braces and attributes each `case <literal>:` to the innermost
    enclosing `switch` block.

Issue classes:
  ERROR  missing-in-schema   key in keys.js but not in the schema (GSettings aborts)
  ERROR  shared-adjustment   one GtkAdjustment used by >1 widget (B-12 class)
  ERROR  duplicate-case      same case label twice in one switch (B-16 class)
  ERROR  widget-type         keys.js widget_type does not match the ui widget class
  WARN   missing-in-keys     schema key not in keys.js (not mirrored at runtime)
  WARN   ui-id-no-key        value widget whose id is not a key (may be wired by hand
                             in prefs.js; then shown as such)
  WARN   key-no-widget       keys.js key with a UI widget_type but no ui widget
  WARN   dead-setting        key never read at runtime (split: UI-visible / no widget).
                             Keys that have a `case` in extension.js are marked: the
                             handler may consume `value` directly (msg-to-ext does).

Exit status: 1 if any ERROR, else 0. Warnings never fail.
"""

import glob
import os
import re
import sys
import xml.etree.ElementTree as ET

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

SCHEMA_GLOB = 'schemas/*.gschema.xml'
KEYS_JS = 'preferences/keys.js'
UI_GLOB = 'ui/*.ui'  # top level only: ui/legacy/ is excluded
PREFS_JS = 'prefs.js'
# Root *.js per the card, plus apps/ and effects/ (shipped runtime code that also
# reads extension.<key>). prefs.js runs in the prefs process, eslint.config.js is
# tooling: neither counts as a runtime read.
RUNTIME_GLOBS = ['*.js', 'apps/*.js', 'effects/*.js']
RUNTIME_EXCLUDE = {'prefs.js', 'eslint.config.js'}
# Files scanned for duplicate case labels (card: extension.js; the rest is free).
SWITCH_GLOBS = ['*.js', 'apps/*.js', 'effects/*.js', 'preferences/*.js']
SWITCH_EXCLUDE = {'eslint.config.js'}

# ui class -> keys.js widget_type it can be bound as (prefKeys.connectBuilder).
SETTING_WIDGET_CLASSES = {
    'GtkSwitch': 'switch',
    'GtkScale': 'scale',
    'GtkDropDown': 'dropdown',
    'GtkColorButton': 'color',
}
# keys.js widget_types that are expected to have a ui widget.
UI_WIDGET_TYPES = set(SETTING_WIDGET_CLASSES.values())


def rel(path):
    return os.path.relpath(path, ROOT)


def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()


def line_of(text, pos):
    return text.count('\n', 0, pos) + 1


# ---------------------------------------------------------------- JS scanning

def strip_js_comments(src):
    """Blank out comments (keep strings and newlines so offsets stay valid)."""
    out = []
    i, n = 0, len(src)
    while i < n:
        c = src[i]
        nxt = src[i + 1] if i + 1 < n else ''
        if c == '/' and nxt == '/':
            j = src.find('\n', i)
            j = n if j < 0 else j
            out.append(' ' * (j - i))
            i = j
        elif c == '/' and nxt == '*':
            j = src.find('*/', i + 2)
            j = n if j < 0 else j + 2
            out.append(re.sub(r'[^\n]', ' ', src[i:j]))
            i = j
        elif c in '\'"`':
            j = skip_string(src, i)
            out.append(src[i:j])
            i = j
        else:
            out.append(c)
            i += 1
    return ''.join(out)


def skip_string(src, i):
    """Return index just past the string literal starting at src[i]."""
    q = src[i]
    i += 1
    n = len(src)
    while i < n:
        c = src[i]
        if c == '\\':
            i += 2
            continue
        if c == q:
            return i + 1
        if c == '\n' and q != '`':
            return i  # unterminated; don't run away
        i += 1
    return n


def switch_cases(path):
    """Return [(case_label, line, switch_line)] for every case in the file."""
    src = strip_js_comments(read(path))
    cases = []
    stack = []  # entries: None for a plain block, dict for a switch block
    pending_switch = None  # line of a `switch (...)` whose `{` is next
    i, n = 0, len(src)
    case_re = re.compile(r'case\s+(\'[^\'\n]*\'|"[^"\n]*"|[\w.$]+)\s*:')
    switch_re = re.compile(r'switch\s*\(')
    while i < n:
        c = src[i]
        if c in '\'"`':
            i = skip_string(src, i)
            continue
        if c == '/' and i > 0:
            # Regex literal heuristic: '/' after an operator/open paren.
            prev = src[:i].rstrip()[-1:] if src[:i].strip() else ''
            if prev and prev in '(,=:[!&|?{};':
                j = i + 1
                while j < n and src[j] not in '/\n':
                    j += 2 if src[j] == '\\' else 1
                i = j + 1
                continue
        if (c.isalpha() or c == '_') and (i == 0 or not (src[i - 1].isalnum() or src[i - 1] in '_$.')):
            m = switch_re.match(src, i)
            if m:
                # skip the balanced (...) condition
                depth, j = 1, m.end()
                while j < n and depth:
                    if src[j] in '\'"`':
                        j = skip_string(src, j)
                        continue
                    depth += {'(': 1, ')': -1}.get(src[j], 0)
                    j += 1
                pending_switch = line_of(src, i)
                i = j
                continue
            m = case_re.match(src, i)
            if m:
                sw = next((s for s in reversed(stack) if s is not None), None)
                if sw is not None:
                    cases.append((m.group(1), line_of(src, i), sw['line']))
                i = m.end()
                continue
            j = i
            while j < n and (src[j].isalnum() or src[j] in '_$'):
                j += 1
            i = j
            continue
        if c == '{':
            if pending_switch is not None:
                stack.append({'line': pending_switch})
                pending_switch = None
            else:
                stack.append(None)
        elif c == '}':
            if stack:
                stack.pop()
        i += 1
    return cases


def find_duplicate_cases(cases):
    """Yield (case_label, first_line, dup_line, switch_line) per duplicate."""
    seen = {}
    for label, ln, sw in cases:
        if (sw, label) in seen:
            yield label, seen[(sw, label)], ln, sw
        else:
            seen[(sw, label)] = ln


def parse_keys_js(path):
    """Return {name: {'widget_type': str|None, 'line': int}}."""
    src = strip_js_comments(read(path))
    start = src.find('setKeys(')
    body = src[start:] if start >= 0 else src
    off = start if start >= 0 else 0
    key_re = re.compile(r"^    '([a-z0-9-]+)'\s*:\s*\{", re.M)
    matches = list(key_re.finditer(body))
    keys = {}
    for idx, m in enumerate(matches):
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(body)
        wt = re.search(r"widget_type\s*:\s*'([^']*)'", body[m.end():end])
        keys[m.group(1)] = {
            'widget_type': wt.group(1) if wt else None,
            'line': line_of(src, off + m.start()),
        }
    return keys


def runtime_reads(paths, names):
    """Return {key: [file:line, ...]} of runtime reads for each key name."""
    reads = {k: [] for k in names}
    snake = {k.replace('-', '_'): k for k in names}
    prop_re = re.compile(r'\.([a-z][a-z0-9_]*)\b')
    str_re = re.compile(r"(?:getValue|get_[a-z0-9]+)\(\s*'([a-z0-9-]+)'")
    for path in paths:
        src = strip_js_comments(read(path))
        for m in prop_re.finditer(src):
            k = snake.get(m.group(1))
            if k:
                reads[k].append('%s:%d' % (rel(path), line_of(src, m.start())))
        for m in str_re.finditer(src):
            if m.group(1) in reads:
                reads[m.group(1)].append('%s:%d' % (rel(path), line_of(src, m.start())))
    return reads


# ---------------------------------------------------------------- XML scanning

def parse_schema(paths):
    keys = {}
    for path in paths:
        for key in ET.parse(path).getroot().iter('key'):
            keys[key.get('name')] = rel(path)
    return keys


def parse_ui(paths):
    """Return (widgets, adjustment_users).

    widgets: {id: (class, file)} for value widgets.
    adjustment_users: {adjustment_id: [(widget_id, file:line), ...]}.
    """
    widgets = {}
    adj_users = {}
    adj_prop_re = re.compile(
        r'<property\s+name="adjustment"\s*>\s*([^<\s]+)\s*</property>')
    for path in paths:
        text = read(path)
        for obj in ET.parse(path).getroot().iter('object'):
            cls, oid = obj.get('class'), obj.get('id')
            if oid and cls in SETTING_WIDGET_CLASSES:
                widgets[oid] = (cls, rel(path))
        # Regex pass for line numbers and the owning widget id (nearest
        # preceding <object ... id="...">).
        obj_re = re.compile(r'<object\s+class="[^"]*"\s+id="([^"]+)"')
        for m in adj_prop_re.finditer(text):
            owner = None
            for om in obj_re.finditer(text, 0, m.start()):
                owner = om.group(1)
            adj_users.setdefault(m.group(1), []).append(
                (owner, '%s:%d' % (rel(path), line_of(text, m.start()))))
    return widgets, adj_users


# ---------------------------------------------------------------- main

def expand(globs, exclude=()):
    out = []
    for g in globs:
        for p in sorted(glob.glob(os.path.join(ROOT, g))):
            if os.path.basename(p) in exclude and os.path.dirname(p) == ROOT:
                continue
            out.append(p)
    return out


def main():
    issues = {}  # (severity, cls) -> [message]

    def add(sev, cls, msg):
        issues.setdefault((sev, cls), []).append(msg)

    schema = parse_schema(expand([SCHEMA_GLOB]))
    keys = parse_keys_js(os.path.join(ROOT, KEYS_JS))
    widgets, adj_users = parse_ui(expand([UI_GLOB]))
    prefs_src = strip_js_comments(read(os.path.join(ROOT, PREFS_JS)))

    for k in sorted(set(keys) - set(schema)):
        add('ERROR', 'missing-in-schema',
            "'%s' (%s:%d) has no <key> in %s" % (k, KEYS_JS, keys[k]['line'], SCHEMA_GLOB))
    for k in sorted(set(schema) - set(keys)):
        add('WARN', 'missing-in-keys',
            "'%s' (%s) is not in %s: never mirrored to extension.%s"
            % (k, schema[k], KEYS_JS, k.replace('-', '_')))

    for adj, users in sorted(adj_users.items()):
        if len(users) > 1:
            add('ERROR', 'shared-adjustment',
                "'%s' used by %s" % (adj, ', '.join('%s (%s)' % u for u in users)))

    reacted = set()  # keys with a `case 'key':` in extension.js
    for path in expand(SWITCH_GLOBS, SWITCH_EXCLUDE):
        cases = switch_cases(path)
        if rel(path) == 'extension.js':
            reacted |= {c[0].strip('\'"') for c in cases}
        for label, first, dup, sw in find_duplicate_cases(cases):
            add('ERROR', 'duplicate-case',
                '%s: case %s at line %d repeats line %d (switch at line %d)'
                % (rel(path), label, dup, first, sw))

    for wid, (cls, f) in sorted(widgets.items()):
        if wid in keys:
            want = SETTING_WIDGET_CLASSES[cls]
            have = keys[wid]['widget_type']
            if have != want:
                add('ERROR', 'widget-type',
                    "'%s': %s in %s but keys.js widget_type is %r (expected %r)"
                    % (wid, cls, f, have, want))
        else:
            by_hand = "'%s'" % wid in prefs_src
            add('WARN', 'ui-id-no-key',
                "'%s' (%s in %s)%s" % (wid, cls, f,
                                       ' - wired by hand in prefs.js' if by_hand else ''))

    for k, info in sorted(keys.items()):
        if info['widget_type'] in UI_WIDGET_TYPES and k not in widgets:
            add('WARN', 'key-no-widget',
                "'%s' widget_type %r has no widget in ui/*.ui"
                % (k, info['widget_type']))

    all_keys = sorted(set(keys) | set(schema))
    reads = runtime_reads(expand(RUNTIME_GLOBS, RUNTIME_EXCLUDE), all_keys)
    for k in all_keys:
        if not reads[k]:
            where = 'UI-visible' if k in widgets else 'no widget'
            src = 'keys.js+schema' if k in keys and k in schema else (
                'schema only' if k in schema else 'keys.js only')
            note = ''
            if k in reacted:
                note = '; has case in extension.js'
            add('WARN', 'dead-setting',
                "'%s' never read at runtime [%s, %s%s]" % (k, where, src, note))

    # ------------------------------------------------------------ report
    order = ['missing-in-schema', 'shared-adjustment', 'duplicate-case', 'widget-type',
             'missing-in-keys', 'ui-id-no-key', 'key-no-widget', 'dead-setting']
    print('check-settings: %d schema keys, %d keys.js keys, %d ui value widgets'
          % (len(schema), len(keys), len(widgets)))
    n_err = n_warn = 0
    for sev in ('ERROR', 'WARN'):
        for cls in order:
            msgs = issues.get((sev, cls))
            if not msgs:
                continue
            print('\n%s %s (%d)' % (sev, cls, len(msgs)))
            for m in msgs:
                print('  ' + m)
            if sev == 'ERROR':
                n_err += len(msgs)
            else:
                n_warn += len(msgs)
    print('\ncheck-settings: %d error(s), %d warning(s)' % (n_err, n_warn))
    return 1 if n_err else 0


if __name__ == '__main__':
    sys.exit(main())
