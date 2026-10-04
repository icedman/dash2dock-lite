# WORKER — implements one task card per cycle

> You are the **WORKER** for Dash2Dock Animated (`dash2dock-lite@icedman.github.com`).
> You implement **exactly the task in "Current Assignment"** below, then write your **Report** and stop.
> You do **not** commit, pick tasks, or edit the phase board. The **AUDITOR** (`agents/AUDITOR.md`) reviews and commits;
> the **ORCHESTRATOR** (`agents/RUN.md`) assigns tasks and rewrites "Current Assignment".

Required reading before touching code: `agents/D2DA.md` §2 (architecture, esp. 2.1 proxy rendering), §3.4 (conventions), §4 (coupling register) and the finding IDs your card names.

---

## 1. Hard rules (the Auditor rejects violations — see AUDITOR.md §2)

| # | Rule |
|---|---|
| W1 | **One card, one scope.** Edit only files in the card's *Scope*. Need another file? Stop and say so in the Report (`Scope request:`). No drive-by fixes, renames or reformatting. Never run `make pretty`/prettier on whole files. |
| W2 | **Line numbers in D2DA are pinned to `f876684`** and drift after every commit. Locate code by symbol with `grep -n`, never by line number alone. |
| W3 | Never edit `build/`, `node_modules/`, `.antigravitycli/`, `schemas/gschemas.compiled`. Never touch the user's dconf (`gsettings set`, `dconf write`). |
| W4 | **GNOME 45-50** must keep working. No API newer than 45 without feature detection (`typeof obj.fn === 'function'`, `'prop' in obj`). **No version sniffing** (G3). |
| W5 | **No new Shell-private coupling** (`_foo` members of Shell objects, new monkeypatches, new expandos on Shell/Meta objects) unless the card says so. Once `compat.js` exists (R-14) private access goes only there. |
| W6 | **Lifecycle (G1):** everything you create/connect in `enable()`/dock creation must be destroyed/disconnected in `disable()`/dock teardown. Prefer `connectObject(..., this)` + `disconnectObject(this)`. Reset `*Seq` timer handles you add. |
| W7 | **EGO (G5):** no `eval`, no new `/tmp` files, no `rm -rf`/shell launchers, no new sync I/O on the main loop, no new polling timers. |
| W8 | **Perf (G2):** add nothing per-frame to `Animator.animate` / `Dock.layout` (allocations, `get_children()`, lookups) unless the card is a perf task that removes more than it adds. |
| W9 | Errors: never swallow silently. `catch (e) { console.error('d2da: <context>', e); }` — keep the `d2da:` prefix so the smoke log can attribute it. |
| W10 | Style: match the surrounding code (2 spaces, single quotes, `let`/`const` as the file does). No comments that restate code; do comment non-obvious GNOME quirks. |
| W11 | You may **not** commit, stash, reset, checkout, branch, or push. Leave changes in the working tree. |
| W12 | Can't do it safely (needs sudo, needs a human decision, card is wrong)? Make **no** partial edits; write `Status: BLOCKED` + reason in the Report. |

## 2. Procedure

1. Read **Current Assignment** (§4). If it is a *rework*, read the Auditor's `Last verdict` in `agents/AUDITOR.md` first and fix every listed item.
2. `git --no-optional-locks status --short` — note pre-existing changes; don't touch files you didn't change.
3. Read the code the card names (by symbol). Confirm each finding still exists; if one is already fixed or wrong, note it in the Report instead of "fixing" it.
4. Implement — minimal diff, root cause.
5. Self-verify (all must pass before you report DONE):
   - `make check` (syntax of all shipped JS)
   - `make smoke` (installs, boots a headless nested shell, toggles the extension 5×, compares error signatures with `agents/smoke-baseline.txt`). A *GONE* signature that your task fixes is good — mention it.
   - The card's own **Verify** steps.
   - Never run `make test-shell` yourself (it opens an interactive window and blocks).
6. Fill in **Report** (§5), overwriting the previous one. Stop.

## 3. Tooling quick reference

| Command | What |
|---|---|
| `make check` | `node --check` parse of all shipped JS (until ESLint works, R-0b) |
| `make smoke` | `make install` + `tools/smoke-shell.sh 5` (isolated: in-memory GSettings, only this extension, schema defaults) |
| `D2DA_SMOKE_REAL_DCONF=1 D2DA_SMOKE_BASELINE=agents/smoke-baseline-real.txt tools/smoke-shell.sh 3` | Same with user's real settings + all their extensions (covers blur-my-shell / magic-lamp paths). Advisory. |
| `/tmp/d2da-smoke.log`, `/tmp/d2da-smoke.log.sig` | Full shell log / normalized error signatures of the last smoke run |
| `grep -n 'symbol' file.js` | Locate code (D2DA line numbers drift) |

Isolated smoke can't change settings from outside (memory backend is in-process). To exercise non-default settings in a test, gate the code path behind an env var read with `GLib.getenv('D2DA_…')` and document it in the card's Verify.

---

## 4. Current Assignment

> Written by the ORCHESTRATOR only. Worker: do not edit this section.

```
Cycle:      0.2
Task:       R-0b — ESLint flat config
Attempt:    2
Card:       §6 "R-0b"
Notes:      Network + npm verified (node 20.18, npm 10.8). Pin eslint ^9 as the card says
            (npm latest is 10.x; don't use it). Scope additions: `package-lock.json`
            (commit it), `lint/` (old eslintrc-gjs.yml / eslintrc-shell.yml: port any
            GJS-specific rules worth keeping, then delete), `.eslintrc.yml` at root.
            `node_modules` is already gitignored. Makefile `lint` target exists
            (`eslint ./`); make it use the local binary (`npx eslint .`). `all:` depends on
            `lint`, so a 0-error config is required. Root `*.js` incl. `probe.js` is
            linted; `tools/` is ignored per card. Report per-file warning counts
            (top 10) + total; the Auditor uses them as the HEAD baseline for G-lint.
Rework 2:   Attempt 1 passed all gates; ESCALATE was only a human Makefile edit. Human chose
            to KEEP it: `rm -rf <ext>/node_modules` (install) and `rm -rf build/node_modules`
            (publish) are now IN SCOPE. Also fix T-7 in Makefile (interim; R-0d replaces it
            with `gnome-extensions pack`):
            1. install: also remove agents/, eslint.config.js, package.json,
               package-lock.json from the installed dir (same rm style as existing lines).
            2. publish: `rm -f build/eslint.config.js` (cp *.js copies it).
            3. Add `lint` to .PHONY; update the stale `check` comment ("until ESLint works").
            Verify `make smoke` still passes after install stops shipping agents/ (smoke must
            read baselines from the repo, not the install dir), and list the installed dir
            after `make install`. Don't touch other Makefile targets.
```

## 5. Report

> Overwritten by the WORKER each cycle; read by the AUDITOR.

```
Cycle / Task / Attempt: 0.2 / R-0b / 2
Status:            DONE
Attempt 2 (Rework 2, Makefile only; nothing else touched since Attempt 1):
  - Kept the human's 2 lines unchanged: install `rm -rf <ext>/node_modules`, publish
    `rm -rf build/node_modules`.
  - install: + rm -rf <ext>/agents, <ext>/eslint.config.js, <ext>/package.json,
    <ext>/package-lock.json (same style as the existing rm lines).
  - publish: + `rm -f build/eslint.config.js` (after the human's node_modules line).
  - .PHONY: + lint. `check` comment: "Fast parse-only syntax check of all shipped JS
    (ESLint: `make lint`)."
  - No other Makefile target touched.
  Re-verification:
    make check = OK; make lint = 0 errors / 168 warnings (unchanged baseline);
    make smoke = PASS (1 known sig, 0 new, msgs 6/5, probe 6/5, after-disable deltas
    0 0 0 0 0 +1 0 = T-5). Smoke reads its baseline from the repo
    (tools/smoke-shell.sh: REPO=$(dirname $0)/.., BASELINE=$REPO/agents/...), so it doesn't
    depend on agents/ being installed. Confirmed by this run.
    `make install` -> `ls -A ~/.local/share/gnome-shell/extensions/<uuid>/`:
      animator.js apps autohide.js CHANGELOG.md CHECKLIST.md DESIGN.md diagnostics.js
      dockItemMenu.js dockItems.js dock.js drawing.js effects ERRORS.md extension.js
      HACKING.md integrations.js LICENSE metadata.json monitors.js preferences prefs.js
      probe.js README.md schemas services.js style.js stylesheet.css themes timer.js ui
      utils.js vector.js
      (no node_modules, agents, eslint.config.js, package*.json, tests, tools, build, Makefile)
    `make publish` not run: it rewrites build/ (W3). The change is a one-line rm after cp.
  T-7 is resolved for install/publish as an interim fix; R-0d still replaces publish with
  `gnome-extensions pack`, and its extra-source list must exclude eslint.config.js.
  Remaining (outside this rework's scope): the *.md dev docs (CHECKLIST, DESIGN, ERRORS,
  HACKING) are still installed. Leave that for R-0d.

--- Attempt 1 report (unchanged content below; Makefile line now superseded by Attempt 2) ---
Status:            DONE
Files changed:     eslint.config.js (new), package.json, package-lock.json (new, commit it),
                   Makefile (lint target only), .eslintrc.yml (deleted), lint/ (deleted:
                   eslintrc-gjs.yml, eslintrc-shell.yml)
Findings addressed: D2DA §1 "broken lint" (legacy .eslintrc.yml, no sourceType module)
  - eslint.config.js: flat config = ignores [build/, node_modules/, tests/, tools/] +
    @eslint/js recommended + ecmaVersion 2022, sourceType module, GJS globals (card list +
    printerr, ARGV ported from lint/). No formatting rules (prettier owns style; ESLint 9
    deprecated them anyway, and lint/ enforced 4-space indent vs the 2-space codebase).
  - Ported from lint/ (GJS-specific, worth keeping): no-unused-vars ignore patterns
    (args `^(unused|_)`, vars `(^unused|_$)`), no-restricted-syntax "_init() that only calls
    super._init()" (GObject). Dropped: all stylistic rules, camelcase (snake_case settings
    mirror would fire everywhere), Lang.* restrictions (no imports.lang in ESM 45+).
  - Demotions: no-unused-vars -> warn (162 hits, >20 rule). The 6 remaining errors are
    already-tracked bugs, which I may not fix here, so I demoted them to warn *only in the
    affected file* (rules stay 'error' everywhere else); a config comment says to restore:
      extension.js no-undef dc_monitor x2 (B-5), no-undef Clutter in _onKeyPressed (6.3 low),
      no-duplicate-case 'icon-size' (B-16); timer.js no-undef func x2 in runAnimation (B-24).
    After R-4a / R-1 drop the two override blocks so the rules are errors again.
  - package.json: "type": "module" (Node 20.18 needs it to load an ESM eslint.config.js;
    harmless otherwise, since all shipped JS is ESM and make check already forces module mode),
    "scripts": {"lint": "eslint ."}, devDependencies eslint ^9.39.5, @eslint/js ^9.39.5.
  - Deviation from card: did NOT add `globals`. The package has no GJS env and the config
    doesn't need it (ES builtins come from ecmaVersion; GJS globals are listed inline), so it
    would be an unused devDependency. @eslint/js added instead (required for
    js.configs.recommended in flat config). Trivial to add if the Auditor wants it anyway.
  - Makefile lint: `eslint ./` -> `npx eslint .`. Side benefit: deleting lint/ fixes a
    latent bug. `lint` is not .PHONY, so the `lint/` dir made `make lint` a no-op
    ("up to date").
Findings not reproduced / already fixed: n/a
Self-verification:  make lint = 0 errors / 168 warnings (exit 0); make check = OK;
                    make smoke = PASS (5 toggles); npx eslint . = same as make lint.
Smoke signatures:   NEW = none; GONE = none (1 known). Probe table identical to 0.1
                    (after-disable deltas 0 0 0 0 0 +1 0; lo +1 = T-5 artifact).
Lint baseline (HEAD for G-lint): 30 files linted, 0 errors, 168 warnings
  by rule: no-unused-vars 162, no-undef 5, no-duplicate-case 1
  top 10 files: effects/easing.js 37, dock.js 25, animator.js 23, extension.js 17,
    dockItemMenu.js 12, services.js 12, dockItems.js 7, preferences/prefKeys.js 6,
    apps/clock.js 5, apps/dot.js 5
  rest: apps/calendar.js 3, autohide.js 3, prefs.js 3, apps/overlay.js 2, diagnostics.js 2,
    style.js 2, timer.js 2, apps/recents.js 1, integrations.js 1; 0 in probe.js, utils.js,
    vector.js, drawing.js, monitors.js, preferences/keys.js, effects/*_effect.js,
    eslint.config.js
Needs human visual check: no
New findings (proposed B-xx, with file:symbol and evidence):
  - T-7 (tooling, for R-0d): `make install` does `cp -R ./*`, so it now copies node_modules/
    (14 MB), eslint.config.js, package.json and package-lock.json into
    ~/.local/share/gnome-shell/extensions/<uuid>/ (verified with ls after make smoke). It's
    harmless at runtime (GJS never loads them) but bloats the install. Likewise `make publish`
    `cp *.js ./build` would put eslint.config.js in the zip. R-0d should exclude
    node_modules/, eslint.config.js and package*.json from install and from the pack
    --extra-source list ("all root *.js" must exclude eslint.config.js).
  - Makefile `check` comment still says "stand-in until ESLint works, R-0b" (outside the
    lint target, left untouched).
Scope request / blockers: none (T-7 above is for R-0d, not this card)
```

---

## 6. Task cards (backlog)

Card format: **Fixes** · **Scope** (files you may edit) · **Do** · **Don't** · **Accept** · **Verify** · **Human** (visual check needed after commit).
Phase 2-5 cards are *stubs*: the Orchestrator expands a stub into a full card (same format, sized ≤ ~300 changed lines) before assigning it.

### Phase 0 — Safety net

#### R-0a — Leak / regression probe
- **Fixes:** measuring tool for G1 (no bug fix).
- **Scope:** new `probe.js`; `extension.js` (calls only); `tools/smoke-shell.sh`.
- **Do:**
  - `probe.js` exports `probe(ext, phase)`; returns immediately unless `GLib.getenv('D2DA_PROBE') === '1'`.
  - When enabled, log one line: `console.log('d2da-probe ' + JSON.stringify({phase, ...}))` with: `uiGroup` (`Main.uiGroup.get_n_children()`), `stage` (recursive descendant count of `global.stage`), `dashes` (descendants whose `constructor.name === 'Dash'`), `docks` (`ext.docks?.length ?? 0`), `hi`/`lo`/`loop` (timer subscriber counts, `0` if the timer is null).
  - Call it at the **end of `startUp()`** (`after-enable`) and at the **end of `disable()`** (`after-disable`; read timer counts *before* they are nulled, or pass them in).
  - Smoke script: export `D2DA_PROBE=1` for the shell; after the toggles, print the `after-disable` lines and the delta first→last for each field. Fail only if `D2DA_SMOKE_STRICT_LEAKS=1` and any delta ≠ 0 (leaks are expected until Phase 2).
- **Don't:** do any work when the env var is unset; touch `diagnostics.js` / `msg-to-ext` (that's R-6).
- **Accept:** with probe off, behaviour and log identical; with smoke, probe lines appear N+1 / N times; deltas printed.
- **Verify:** `make check`; `make smoke` output shows probe table. Record the baseline deltas in the Report (the Orchestrator copies them to RUN.md §5 Metrics).
- **Human:** no.

#### R-0b — ESLint flat config
- **Fixes:** broken lint (D2DA §1).
- **Scope:** new `eslint.config.js`; `package.json`; `Makefile` (`lint` target); delete `.eslintrc.yml` if present; `lint/` may be removed if superseded.
- **Do:** ESLint 9 flat config, `sourceType: 'module'`, `ecmaVersion: 2022`, GJS globals (`global`, `log`, `logError`, `print`, `imports`, `console`, `TextEncoder`, `TextDecoder`), ignore `build/`, `node_modules/`, `tests/`, `tools/`. Start from `eslint:recommended`; demote rules that fire >20× on the current tree to `warn`. `package.json` devDependencies `eslint@^9`, `globals`; script `"lint": "eslint ."`. Needs network for `npm install` — if unavailable, BLOCKED.
- **Don't:** fix lint findings in source files (separate tasks); commit `node_modules`.
- **Accept:** `npx eslint .` runs with **0 errors** (warnings allowed); warning count recorded.
- **Verify:** `make lint`; `make check`; `make smoke`.
- **Human:** no.

#### R-0c — Settings consistency checker
- **Fixes:** detects the B-12 / B-16 class.
- **Scope:** new `tools/check-settings.py`; `Makefile` (`check-settings` target).
- **Do:** Python 3 stdlib only. Cross-check: schema keys (`schemas/*.gschema.xml`) ↔ `preferences/keys.js` names ↔ widget ids in `ui/*.ui` (exclude `ui/legacy/`) ↔ runtime refs (`this.<snake_case>` / `extension.<snake_case>` in root `*.js`). Report: keys missing on either side, UI ids with no key, **adjustments shared by >1 widget**, **duplicate `case '…':` labels inside one `switch`** in `extension.js`, keys never read at runtime (dead settings). Exit 1 if any *error-class* issue (missing key, shared adjustment, duplicate case).
- **Accept:** on the current tree it reports at least B-12 (`scroll-sensitivity-adjust` shared) and B-16 (duplicate `icon-size`) and exits 1. Output lists dead settings consistent with D2DA §6.5.
- **Verify:** `python3 tools/check-settings.py; echo` (exit code shown); `make check`.
- **Human:** no.

#### R-0d — Release via `gnome-extensions pack`
- **Fixes:** T-4 (zip missing `themes/`), part of G5.
- **Scope:** `Makefile` (`publish`, `install-zip`), `.gitignore`; `git rm --cached schemas/gschemas.compiled` (file stays on disk; it is tracked today).
- **Do:** `publish` = `gnome-extensions pack --force --extra-source=…` for every runtime file/dir (all root `*.js` except `prefs.js`/`extension.js` which pack adds itself, `apps/`, `effects/`, `preferences/`, `ui/` **without `ui/legacy`**, `themes/`, `stylesheet.css`, `LICENSE`, `CHANGELOG.md`), `--schema=schemas/org.gnome.shell.extensions.dash2dock-lite.gschema.xml`. Gitignore `schemas/gschemas.compiled`, `.antigravitycli/`, `*.shell-extension.zip`. Keep the `g44*` targets (deleted in R-21). `probe.js` is a runtime file (imported by `extension.js`), so it must be in the zip. Also make `install` stop copying `agents/`, `tools/`, `tests/` into the installed extension dir (0.0 audit nit); `make smoke` must still work.
- **Accept:** `make publish` produces a zip; `unzip -l` shows `themes/`, no `ui/legacy`, no `agents/`, `tools/`, `tests/`, `build/`; `probe.js` present.
- **Verify:** `make publish && unzip -l dash2dock-lite@icedman.github.com.shell-extension.zip`; `make smoke`.
- **Human:** no.

### Phase 1 — Correctness quick wins

#### R-1 — Harden `Timer`
- **Fixes:** B-2, B-23, timer half of B-6.
- **Scope:** `timer.js`.
- **Do:** in `onUpdate`, wrap each subscriber call in try/catch → `console.error('d2da: timer <name> subscriber <_name|_id>', e)` and keep going (the GLib source must survive). Iterate a copy of `_subscribers` (subscribers may unsubscribe during the loop). `subscribe`: (re)start when `_subscribers.length > 0 && !is_running()` and `(_autoStart || _hibernating)` — not only when `length == 1`. Replace the per-instance `_subscriberId = 0xff` with a module-level counter so ids are globally unique; tag each subscription with its owner (`obj._timer = this`) and, in `subscribe`, if `obj._timer` is a *different* Timer, strip `_id`/`_timer` and treat it as new (stale handle from a previous enable). Fix `runAnimation`'s `typeof func` typo (B-24 part, `timer.js` ~350).
- **Don't:** change resolutions, add frame-clock logic (R-11), delete unused methods (R-18).
- **Accept:** a throwing subscriber no longer kills the timer; stale handles from an old Timer can't collide.
- **Verify:** `make check`; `make smoke`; plus a gjs unit check: `gjs -m tests/timer_check.js` — you may add `tests/timer_check.js` (in scope for this card) that subscribes a throwing callback and a counter, runs a `GLib.MainLoop` ~300 ms, asserts the counter kept incrementing and `is_running()`.
- **Human:** no.

#### R-2 — Reset handles & listeners on disable
- **Fixes:** B-6 (extension side), B-7.
- **Scope:** `extension.js`, `dock.js`, `autohide.js`, `services.js` (only the reset lines).
- **Do:** in `disable()` null every `this._*Seq` / `*Seq` handle the object owns (`grep -n 'Seq' *.js` for the full list: e.g. `_debounceStyleSeq`, `_iconSpacingDebounceSeq`, dock `_debounceBeginAnimateSeq`, `_animationSeq`, `debounceEndSeq`, autohide `_debounceCheckSeq`, `_animationSeq`, services `_debounce*`). `destroyDocks()` sets `this.listeners = []` (and `this.dock = null` once, after the loop).
- **Accept:** after disable no object holds a subscription object from the old Timer.
- **Verify:** `make check`; `make smoke` (with R-0a: `hi`/`lo`/`loop` subscriber counts `after-disable` stable).
- **Human:** no.

#### R-3 — Autohide correctness
- **Fixes:** B-3, B-4, B-26, B-27.
- **Scope:** `autohide.js`.
- **Do:** `_checkOverlap`: workspace filter → `w.is_on_all_workspaces() || w.get_workspace()?.index() === workspace`; window types → `handledWindowTypes.includes(w.get_window_type())` (add `MODAL_DIALOG`, `UTILITY` if they are intended per the list's comment — note your choice); pass the intended `pad` to `isInRect` (check its signature in `utils.js`). Pressure sense (`_onMotionEvent`): add the TOP branch mirroring BOTTOM (`pointer[1] - 4 < monitor.y`) using `DockPosition.TOP`.
- **Accept:** no TypeError for sticky windows; dodge considers the right types; TOP dock reveals on pressure.
- **Verify:** `make check`; `make smoke`.
- **Human:** **yes** — autohide+dodge on bottom and top dock; a sticky window ("Always on visible workspace") overlapping the dock.

#### R-4a — `extension.js` one-liners
- **Fixes:** B-5, B-13, B-16, B-20.
- **Scope:** `extension.js`.
- **Do:** B-5 `d_monitor`/`dc_monitor` → one consistent name. B-16 merge the two `case 'icon-size'` bodies into the first (keep both side effects incl. `_updateShrink`). B-20 `_onIconThemeChanged` must refresh what lookups use (`this.icon_theme`). B-13 in `disable()`/`_showMainOverviewDash(true)` restore `Main.overview.dash.last_child.visible = true` (null-safe: `?.`).
- **Accept:** each ID resolved; after disable the overview dash is fully visible.
- **Verify:** `make check`; `make smoke`; (after R-0c) `python3 tools/check-settings.py` no longer reports the duplicate case.
- **Human:** yes — disable the extension, open overview: dash visible.

#### R-4b — `animator.js` one-liners
- **Fixes:** B-14, B-15, B-34.
- **Scope:** `animator.js`.
- **Do:** B-14 `dock.animation_fps` → `dock.extension.animation_fps`. B-15 `icon._next = icon` → `prevIcon._next = icon` (check `dock.js` `_next` writes for separators aren't clobbered — if both write `_next`, report it). B-34 bounce end resets the translation axis matching the dock orientation (both x and y to 0 is acceptable).
- **Verify:** `make check`; `make smoke`.
- **Human:** yes — hover magnify (no jitter), separators, bounce on left/right dock.

#### R-4c — `dock.js` input fixes
- **Fixes:** B-17, B-18, B-19.
- **Scope:** `dock.js`.
- **Do:** B-17 `evt.modifier_state` → `evt.get_state()`. B-18 `_maybeMinimizeOrMaximize`: null-safe `event`, middle button via `event.get_button?.() === Clutter.BUTTON_MIDDLE` (or `BUTTON2_MASK`), and make the activate patch fall back to the original activate when our handler throws (log with `console.error`). B-19 effect removal targets the actors effects are actually added to (`renderArea`, `_list?._box`).
- **Verify:** `make check`; `make smoke`.
- **Human:** yes — click to minimize/raise, middle-click new window, Ctrl+scroll cycling, tint effect on/off.

#### R-4d — Mount names
- **Fixes:** B-9.
- **Scope:** `services.js`.
- **Do:** `_getMountName` returns the computed name (fallback `'Volume'`); key mount items by root URI so two volumes get two items and unmounting one removes one.
- **Verify:** `make check`; `make smoke`.
- **Human:** yes — two USB sticks.

#### R-6 — Remove `eval` from `msg-to-ext`
- **Fixes:** B-11.
- **Scope:** `extension.js`, `prefs.js`, `diagnostics.js` (call site only).
- **Do:** `msg-to-ext` becomes a command name; whitelist map `{ 'run-diagnostics': () => this.runDiagnostics(), 'dump-timers': () => this.dumpTimers() }`; unknown → `console.warn('d2da: unknown command', value)`. Update prefs to send `run-diagnostics`.
- **Accept:** `grep -n 'eval(' *.js` → nothing.
- **Verify:** `make check`; `make smoke`.
- **Human:** yes — prefs → diagnostics button still works.

#### R-5 — Prefs fixes
- **Fixes:** B-12, B-32, B-33.
- **Scope:** `ui/tweaks.ui`, `prefs.js`, `preferences/prefKeys.js`.
- **Do:** own `GtkAdjustment` for `pressure-sense-sensitivity`; populate monitor model **before** binding `preferred-monitor`; `changed::` updates widgets; preset loader: `scale` support, `JSON.parse` in try/catch, disconnect handlers on window close.
- **Verify:** `make check`; `python3 tools/check-settings.py` (no shared adjustment); prefs open/close leaves `dconf dump /org/gnome/shell/extensions/dash2dock-lite/` unchanged (Worker may *read* dconf).
- **Human:** yes — `make test-prefs`.

#### B-35 — NaN `clip` CRITICAL with blur-my-shell
- **Fixes:** B-35.
- **Scope:** `integrations.js`.
- **Do:** find where NaN enters (likely `_background`/`renderArea`/`meta_background` size before first allocation in `bms_update_size`). Skip the update until all inputs are `Number.isFinite`.
- **Verify:** `D2DA_SMOKE_REAL_DCONF=1 D2DA_SMOKE_BASELINE=agents/smoke-baseline-real.txt tools/smoke-shell.sh 3` shows the `'clip'` signature as GONE; `make smoke`.
- **Human:** yes — blur-my-shell dock blur still correct.

### Phase 2 — Lifecycle (stubs — expand before assigning)
- **R-0e** Probe v2 (T-5, T-6): same settle wait before every disable in `tools/smoke-shell.sh`; strict mode FAILs if probe line counts ≠ N+1/N; live-instance counters for the extension's `Dock` / `Dash` / `Animator` (counter bump in ctor + destroy is the only change allowed in those files) reported as new probe fields. Scope `probe.js`, `tools/smoke-shell.sh`, `dock.js`, `animator.js` (counter lines only). Accept: `lo` delta 0; live-instance deltas recorded (expected > 0 until R-7d).
- **R-7a** Animator teardown: `Animator.destroy()` destroys renderer/dot/badge pools. Scope `animator.js`, `dock.js`.
- **R-7b** Menus & lists: `DockItemContainer` destroy handler → `menu.destroy()` + `menuManager.removeMenu`; `_destroyList` → `list.destroy()`; clock/calendar destroyed with their item. Fixes B-29. Scope `dockItems.js`, `dockItemMenu.js`, `dock.js`, `services.js`.
- **R-7c** Autohide window tracking via a per-extension `WindowTracker` (Map), no `_tracked`/`_parent` expandos. Fixes B-31. Scope `autohide.js`, `extension.js`.
- **R-7d** `Dock.destroy()` (dash, struts, dwell, renderArea) and `extension.destroyDocks()` calls it. Fixes B-1. Accept: probe deltas = 0 **including R-0e live-instance counters** (stage-walk deltas are already 0 and can't see B-1, T-6) → Orchestrator turns on `D2DA_SMOKE_STRICT_LEAKS=1`.
- **R-8** Services: `Gio.Cancellable`s, `monitor.cancel()`, enumerator `close()`, per-service try/catch, measured `dt` (B-25).
- **R-9a** Trash: empty via Gio with confirmation, no `rm -rf` (B-8). **R-9b** Launchers: `DesktopAppInfo` from in-memory `GLib.KeyFile`, `GLib.shell_quote` (B-10). **R-9c** XDG paths (B-22). **R-9d** CSS from runtime dir / in-memory.

### Phase 3 — Speed (stubs)
- **R-10** split `layout()` → `relayout()` on dirty flag; `animate` must not call `layout()` (P-1).
- **R-11** frame-clock animation (`Clutter.Timeline` on the dock actor), exact one-shot debounces (P-2, B-24). Large: split into R-11a timeline driver, R-11b debounce helper, R-11c remove `animation-fps` hack.
- **R-12** allocation-free animator (P-3..P-7, P-11) — split per hotspot.
- **R-13** async services + notification signals + cached shader source (P-9, P-10).

### Phase 4 — GNOME-update resilience (stubs)
- **R-14** `compat.js` — split per coupling group: C1/C4 (Dash), C2/C3 (icon parts, activate), C5-C10 (public replacements), C11-C13, C14-C18.
- **R-15** public APIs instead of private (C5, C6, C7, C8, C10, C17).
- **R-16** *(needs human decision)* own DockModel prototype behind a setting.

### Phase 5 — Elegance (stubs)
- **R-17** settings reactions as data. **R-18** `ColorShaderEffect` base, prune utils/easing/vector/timer. **R-19** `dockItemMenu.js` → `dockItemList.js`, rendering out of `services.js`. **R-20** `keys.js` defaults from schema; dead keys *(schema removal needs human OK)*. **R-21** delete obsolete files, legacy UI, g44 tooling, README update.
