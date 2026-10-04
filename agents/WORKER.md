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
| W3 | Never edit `build/`, `node_modules/`, `.antigravitycli/`, `schemas/gschemas.compiled`. Never touch the user's dconf (`gsettings set`, `dconf write`). **Never run real-dconf smoke (`D2DA_SMOKE_REAL_DCONF=1`, G-real)** unless §4 Notes explicitly say `G-real: ALLOWED`. It toggles the user's `enabled-extensions` and runs on their live settings. |
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
Cycle:      2.3a
Task:       R-0e — Probe v2: fair timing, shutdown criticals, live instances, settings hook
Attempt:    1
Card:       §6 "R-0e"
Notes:      HEAD deb31fb. G-real: NOT allowed (W3). The settings hook must be impossible
            to trigger against real dconf: check GSETTINGS_BACKEND === 'memory' inside
            the extension, not just in the script. Key names: check them against the
            schema (`schemas/*.gschema.xml`) before using them in the Accept run; adapt
            the list if a key is named differently, and say so.
            Size: if the diff goes past ~300 lines, ship 1-4 and report 5 as remaining.
            Gates: check; lint 0/150; check-settings exit 0 (0/30); timer_check 15/15;
            window_tracker_check 20/20; smoke 1 known sig; disposed/finalized grep 0.
            Known flake B-37.
```

## 5. Report

> Overwritten by the WORKER each cycle; read by the AUDITOR.

```
Cycle / Task / Attempt: 2.3a / R-0e / 1
Status:            DONE (all 5 items, code diff 160+/15-)
Files changed:     tools/smoke-shell.sh (+93/-14), probe.js (+52), dock.js (+5), animator.js (+6),
                   extension.js (+4/-1). HEAD deb31fb. agents/*.md untouched except this Report.
What changed:
  1 T-5: D2DA_SMOKE_SETTLE (default 2 s) after the initial enable (was 4 s) and after every re-enable
    (was 1 s). I kept the final `sleep 2` after the loop, commented. Reason: see finding F1. lo
    delta is now 0 in every run (the after-disable lo column is 0 in all rows, so real growth would
    still show).
  2 T-8: after the state checks, the alive check runs, then the stop: the script appends the marker
    line `d2da-smoke: stopping shell` to the log, sends SIGTERM, polls up to 10 s, then SIGKILL, then
    wait. Everything after that reads the complete log. Prints `shutdown criticals: N (sweeping phase
    of GC: M)`, where N = lines after the marker matching CRITICAL|sweeping phase of GC. Signatures:
    the pre-marker part is unchanged; from the shutdown part only JS ERROR/JS WARNING/TypeError/
    ReferenceError lines go in (no criticals or their stack traces), so today's shutdown criticals
    can't trip the NEW gate. STRICT: N > 0 fails. Documented in the header.
    Also: the alive/"shell died" check now reads /proc/PID/status instead of `kill -0`. An exited,
    unreaped child (zombie) still answers kill -0, so the old check could never fire, and the 10 s
    poll needs the same test. In real-dconf mode, cleanup's safety re-enable now also runs before the
    stop (it needs the shell's D-Bus). That path is untested (W3).
  3 T-6: probe.js `live(kind, delta)` is a module-level integer map, always on, nothing else. The JSON
    gets liveDock/liveDash/liveAnimator. Counter lines: Dock._init +1 plus this.connect('destroy') -1;
    dock.js createDash `new Dash()` +1 plus dash.connect('destroy') -1 (separate connect: the existing
    connectObject 'destroy' no-op could be disconnected first by a future disconnectObject);
    Animator gets a trivial constructor +1, and Animator.destroy() -1. The probe table now sizes
    columns to the field name (liveAnimator).
  4 Strict: FAIL if probe line counts != TOGGLES+1/TOGGLES (only with D2DA_PROBE=1).
  5 Settings hook: probe.js `applySmokeSettings(settings)`. It returns early unless
    GLib.getenv('D2DA_PROBE') === '1' AND GLib.getenv('GSETTINGS_BACKEND') === 'memory', checked
    inside the extension. Then it parses D2DA_SMOKE_SETTINGS (space-separated key=value). For each
    pair: schema has_key check (avoids a GLib critical on unknown keys), get_key().get_value_type(),
    GLib.Variant.parse, and set_value only if the value differs (the memory backend keeps values
    across re-enables, so later enables write nothing). It logs `d2da-probe settings applied: ...`.
    Each bad pair -> console.error('d2da: probe settings', e) and continue. The script passes
    D2DA_SMOKE_SETTINGS only in memory mode with D2DA_PROBE=1, otherwise it prints a note and passes
    an empty value.
    PLACEMENT DEVIATION: the card says "right after this._settings exists". this._settings is created
    inside _enableSettings(), and set_value fires the changed:: switch synchronously. Right after
    _enableSettings(), this.integrations/this.services are null, and on the first enable this.docks
    is undefined (e.g. trash-icon -> animate() -> this.docks.forEach TypeError; blur-background ->
    integrations.hookBms). So the call sits in enable() right after services.enable() /
    _onCheckServices(). That is still before _update*() and before docks are built (startUp() runs
    250 ms later). Commented.
  Key names: trash-icon, downloads-icon, clock-icon, calendar-icon, autohide-dash all exist in
    schemas/org.gnome.shell.extensions.dash2dock-lite.gschema.xml (all type b). No changes needed.
Self-verification:
  make check = OK. make lint = 0 errors / 150 warnings. python3 -B tools/check-settings.py = 0/30,
  exit 0. gjs -m tests/timer_check.js = all passed (15/15). gjs -m tests/window_tracker_check.js =
  all passed (20/20).
  Default smoke: 2x `make smoke` + 2x tools/smoke-shell.sh 5. Clean runs = PASS, 1 known sig, 0 new,
  0 gone, msgs 6/5, probe lines 6/5, disposed/finalized grep 0. Baseline table (final make smoke):
    probe after-enable:
      #    uiGroup    stage   dashes    docks       hi       lo     loop liveDock liveDash liveAnimator
      1         40     2848        2        1        1        2        1        1        1            1
      ... rows 2-6 identical except live* = 2..6
    delta        0        0        0        0        0        0        0       +5       +5           +5
    probe after-disable:
      1         36     2825        1        0        0        0        1        1        1            1
      ... rows 2-5 identical except live* = 2..5
    delta        0        0        0        0        0        0        0       +4       +4           +4
    shutdown criticals: 150 (sweeping phase of GC: 150)   <- new metric baseline (T-8)
  liveDock/liveAnimator +1 per toggle, as the card expects (B-1). liveDash also +1 per toggle:
    destroyDash() only remove_child()s the Dash, and GC never disposes it during the run. That is
    for R-7d.
  Flakes seen (2 of 6 default-mode runs, neither reproduced on rerun):
    a) first make smoke, before the final `sleep 2` was restored: 151 criticals = 150 sweep + 1
       "Gjs_ui_dash_Dash ... already disposed" during shutdown. Stack: timer.js -> dock.js:1312
       _beginAnimation loop -> animator.js:132 -> dock.js:1014 layout. Disposed grep = 1. See F1.
    b) one run 5/4 msgs and probe lines: one `gnome-extensions disable` in the loop had no effect
       (5 s gap between an enable and the next disable, no error in .log or .log.bus). PASS
       (non-strict), but it would FAIL strict mode.
    c) one run: stage +32 in both phases from toggle 4 on (uiGroup, live, timers unchanged). It's a
       step outside d2da (Shell lazily building UI ~10 s into the run). It would FAIL strict mode
       too; stage is noisy in absolute terms (T-6 already says so).
  Accept settings variant: D2DA_SMOKE_SETTINGS='trash-icon=true downloads-icon=true clock-icon=true
    calendar-icon=true autohide-dash=true' tools/smoke-shell.sh 5 -> PASS, 0 new sigs, disposed 0,
    "settings applied" on all 6 enables. after-enable uiGroup 44 / stage 2890 (vs 40 / 2848), so
    the item/menu paths ran. after-disable is back to 36/2825, deltas 0 except live* +4. Shutdown
    criticals 200 (vs 150): extra items leak more at shutdown. Finding for R-7d, not fixed here.
  Accept probe-off: D2DA_PROBE=0 D2DA_SMOKE_SETTINGS='trash-icon=true' tools/smoke-shell.sh 2 -> PASS,
    0 `d2da-probe` lines (probe or settings), no probe table. (Script tweak after this run: it now
    also prints "ignored without D2DA_PROBE=1".)
  Error path (extra): D2DA_SMOKE_SETTINGS='no-such-key=1 trash-icon=maybe clock-icon=true' -> two
    `d2da: probe settings` errors per enable (unknown key / VariantParseError), clock-icon still
    applied, smoke FAIL on 2 NEW sigs (stack lines of the logged error). That's the intended visibility
    for a typo; baseline not touched.
  G-real NOT run (W3). Real-dconf code paths in the script (re-enable before stop, settings ignored)
    are untested.
New findings / notes:
  F1 Shutdown race: the extension stays enabled while the shell shuts down. If the dock's animation
    loop (_hiTimer) is still running, layout() touches the already-disposed Dash (Gjs critical +
    console "unable to layout()"). The old script never looked at shutdown, and its final `sleep 2`
    let the loop go idle. I kept that sleep so the stop measures leaks, not this race. Possible fix
    (later card): stop the timers / guard layout on the Dash's destroy, or Timer source teardown at
    shutdown.
  F2 Probe flakes (b) and (c) above make strict mode not fully deterministic yet. Before turning
    strict on (after R-7d), consider dropping `stage` from the strict delta check, or retry the
    D-Bus toggle when the state doesn't change.
  F3 Animator.destroy() decrements without an idempotence guard. Fine today (nothing calls it). R-7d
    should call it exactly once, or add a guard.
Scope request / blockers: none.
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
- **Fixes:** T-4 (zip missing `themes/`), T-7 (dev files in install/zip), part of G5.
- **Scope:** `Makefile` (`publish`, `install-zip`), `.gitignore`; `git rm --cached schemas/gschemas.compiled` (file stays on disk; it is tracked today).
- **Do:** `publish` = `gnome-extensions pack --force --extra-source=…` for every runtime file/dir (all root `*.js` except `prefs.js`/`extension.js` which pack adds itself, `apps/`, `effects/`, `preferences/`, `ui/` **without `ui/legacy`**, `themes/`, `stylesheet.css`, `LICENSE`, `CHANGELOG.md`), `--schema=schemas/org.gnome.shell.extensions.dash2dock-lite.gschema.xml`. Gitignore `schemas/gschemas.compiled`, `.antigravitycli/`, `*.shell-extension.zip`, `__pycache__/`. Keep the `g44*` targets (deleted in R-21). `probe.js` is a runtime file (imported by `extension.js`), so it must be in the zip. `eslint.config.js` is a root `*.js` but **must not** be packed (list runtime JS explicitly or filter it out). Make `install` install from the same allow-list (e.g. `gnome-extensions install --force` of the packed zip), replacing the interim `rm -rf` lines from 2a0ae6f, so dev docs (`CHECKLIST.md`, `DESIGN.md`, `ERRORS.md`, `HACKING.md`), `agents/`, `node_modules/`, `package*.json` are never installed; `make smoke` must still work. Shell loops over files: handle spaces (`screenshots/` has some).
- **Accept:** `make publish` produces a zip; `unzip -l` shows `themes/`, no `ui/legacy`, no `agents/`, `tools/`, `tests/`, `build/`, `eslint.config.js`, `node_modules/`, `package*.json`, dev docs; `probe.js` present. After `make install` the installed dir has the same file set.
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
#### R-7a — Animator teardown
- **Fixes:** G1, animator-owned actors (part of the B-1 class). Pooled actors are currently removed from `renderArea` but never destroyed.
- **Scope:** `animator.js`. (`dock.js` only if a call site must change; say why.)
- **Context (HEAD 03940ad):** `Animator.enable/disable/_precreateResources` (top of `animator.js`). The pools are `_renderers` (`St.Icon`), `_dots` (`DockItemDotsOverlay`), `_badges` (`DockItemBadgeOverlay`), all children of `dock.renderArea`. `disable()` does `this._target.remove_all_children()`, which unparents the pool *and* the services-owned clock/calendar actors (`services.js` adds them to `renderArea`; their destroy is R-7b), and then keeps the pool arrays. `_precreateResources` resets the arrays to `[]` when `renderArea` has 0 children, so the old actors are dropped undestroyed. Icons cache `icon._renderer = this._renderers[icon._idx]`; `bounceIcon` frames touch `container._renderer`. `undock()` calls `animator.disable()`; `Dock.dock()` (only via `createDock()`, always a new Dock + Animator) calls `animator.enable()`. `recreateDash()` doesn't touch the animator (corrected after the 2.1 audit). `_bms` is owned by `integrations.js`: don't touch it.
- **Do:**
  - Add `_destroyPool()`: `destroy()` every actor in the three pools (null-safe), then reset the arrays to `[]`.
  - `disable()`: `_destroyPool()` first, then keep `this._target?.remove_all_children()` for the remaining non-pool children (current clock/calendar behaviour until R-7b). Comment that. Then `_target = null`, `_computed = null`.
  - `_precreateResources`: replace the bare array reset with `_destroyPool()`.
  - Add `destroy()`: `disable()` then null `dock`, `extension`. Not called yet: R-7d wires it into `Dock.destroy()`.
  - Make sure nothing touches a destroyed pool actor after `disable()`: stale `icon._renderer` / `_dots` / `_badges` refs on icons that outlive undock, bounce frames still running on `_hiTimer` (≤ ~1 s, guarded by `getTarget`), `animate()` called between undock and redock. Clear the refs or guard them, without adding per-frame work (A8).
- **Don't:** change `animate()` math; destroy clock/calendar (R-7b); add `Dock.destroy` (R-7d); touch `_bms`.
- **Accept:** after `undock()` no pool actor is alive; redock (`recreateDash` → `enable` → `_precreateResources`) rebuilds the pool and renders; no "already disposed" / "has been finalized" warnings in the smoke log.
- **Verify:** `make check`; `make lint`; `tools/check-settings.py` (exit 0); `gjs -m tests/timer_check.js`; `make smoke` + one more run; `grep -c 'disposed\|finalized\|already been destroyed' /tmp/d2da-smoke.log` = 0.
- **Human:** yes. The dock renders icons, dots and badges after toggling the extension, after changing preferred monitor (redock), and during a bounce right before disabling.

#### R-7b — Destroy menus, file lists, clock & calendar
- **Fixes:** B-29 (destroy half). The "menu side always TOP" half stays open (visual/product call, separate item).
- **Scope:** `dock.js` (`_cleanupIcon`, `_destroyList`), `dockItems.js` (`DockItemContainer` menu creation/teardown). `services.js` / `dockItemMenu.js` only if a reference must be nulled there; say why.
- **Context (HEAD 30ae2d5):**
  - Custom items (`DockItemContainer`, `dockItems.js` ~302) create `this._menu = new DockItemMenu(...)` + `this._menuManager = new PopupMenu.PopupMenuManager(this)`, add `_menu.actor` to `Main.uiGroup`, `addMenu`, and set `dashIcon._menu`. Nothing ever destroys them.
  - `dock.js _cleanupIcon(c)` (called from `destroyDash()` per icon and from each icon's `destroy` handler) only *unparents* `c._image`, `c._menu.actor` and `c._label`.
  - `c._image` is the clock/calendar actor created in `services.js updateIcon` (`item._clock` / `item._calendar` / `item._image`, also cached as `dock._clock` / `dock._calendar`) and parented to `dock.renderArea`.
  - Since R-7a, `animator.disable()` (in `undock()`, which runs **before** `destroyDash()` in `extension.destroyDocks`) unparents clock/calendar via `remove_all_children()`. The `get_parent()` check in `_cleanupIcon` then skips them, so they leak.
  - `_destroyList()` only `remove_child`s `dock._list` (`DockItemList`) from `uiGroup`.
- **Do:**
  - `_cleanupIcon(c)`: destroy (not just unparent) d2da-owned actors: `c._image` regardless of parent; null `c._image`, `c._clock`, `c._calendar`, and `dock._clock` / `dock._calendar` when they point at it. Menus: `c._menuManager?.removeMenu(c._menu)` / owner manager if present, then `c._menu.destroy()`, then null. Must be idempotent (called from both destroyDash and the destroy handler).
  - Don't destroy Shell-owned actors. `c._label` is the Shell DashItemContainer's label: keep the current unparent-only behaviour, or leave it alone if the Shell destroys it with its container. Note your choice.
  - `DockItemContainer`: connect its own `destroy` (connectObject or a stored id) to tear down `_menu` + `_menuManager`, so the menu goes away even when `_cleanupIcon` never sees it.
  - `_destroyList()`: `this._list.destroy()` (destroy unparents), then null. Check that `DockItemList` animation (`dockItemMenu.js` ~332-454, driven from the dock's animation loop) can't touch the list after destroy.
- **Don't:** change menu side/position; touch `Dock.destroy` / B-1 (R-7d); change `animate()` per-frame work (A8).
- **Accept:** after `destroyDocks()` no d2da menu, list or clock/calendar actor stays alive or parented to `uiGroup`; reopening a menu or list after re-enable works; no disposed/finalized warnings.
- **Verify:** `make check`; `make lint`; `tools/check-settings.py` (exit 0); `gjs -m tests/timer_check.js`; `make smoke` ×2; `grep -c 'disposed\|finalized\|already been destroyed' /tmp/d2da-smoke.log` = 0. Report the shutdown "sweeping phase of GC" count (T-8, baseline ~150); a drop is a bonus, not required.
- **Human:** yes. Right-click menu on a custom item (trash/downloads), then toggle the extension and right-click again. Open the downloads/recents list, toggle the extension, open it again. Clock and calendar icons enabled: toggle the extension; the icons render, with no duplicates.

#### R-7c — Per-extension WindowTracker, no `Meta.Window` expandos
- **Fixes:** B-31.
- **Scope:** `autohide.js`, `extension.js`.
- **Context (HEAD 0a01a50):** `AutoHide._checkOverlap` maps `global.get_window_actors()` to windows, writes `w._parent = a` (never read anywhere) and calls `this._track(w)` on every filtered window. `_track` uses a `window._tracked` expando on the shared `Meta.Window` and `window.connectObject('position-changed', …, 'size-changed', …, this)`; both callbacks just call `this.dock.extension.checkHide()`. With several docks, the first autohider to see a window sets `_tracked`, so the others never connect; when that autohider disables, it clears `_tracked` for everyone. `AutoHide.disable()` untracks by scanning current window actors (only if `_enabled`). Windows that stop matching the filter stay connected; closed windows are never explicitly released. `extension.js` toggles autohiders on the `autohide-dash` setting (~1213-1218) and creates/destroys docks in `createDock` / `destroyDocks`.
- **Do:**
  - Add `export class WindowTracker` in `autohide.js`: `constructor(onChange)`, `Map`/`Set` of tracked `Meta.Window`s, `track(w)` (idempotent; `w.connectObject('position-changed', cb, 'size-changed', cb, 'unmanaged', () => this.untrack(w), this)`), `untrack(w)` (`w.disconnectObject(this)` in try/catch → `console.error('d2da: …')` only for unexpected errors), `clear()`, `destroy()` = `clear()` + drop the callback.
  - `extension.js`: own one tracker. Create it in enable/startUp with `() => this.checkHide()`, `destroy()` it in `disable()` after `destroyDocks()`, null it. When `autohide-dash` turns off, `clear()` it.
  - `AutoHide._checkOverlap`: call `this.extension.windowTracker?.track(w)`; remove `_parent`. `AutoHide.disable()`: remove the per-window untrack scan (the tracker owns connections now).
  - No new expandos on Shell/Meta objects (A5). No per-frame work (A8); `_checkOverlap` is debounced.
- **Don't:** change the overlap/dodge logic or window filters (R-3 fixed them; the 1.3 human rule stands); add a global (non-extension) singleton.
- **Accept:** `grep -n '_tracked\|_parent\b' autohide.js` is empty (except `get_parent` calls); exactly one connection per window across all docks; all connections gone after `disable()` and when autohide is turned off; closed windows are released.
- **Verify:** `make check`; `make lint`; `tools/check-settings.py` (exit 0); `gjs -m tests/timer_check.js`; `make smoke` ×2; disposed/finalized grep = 0. Smoke has no windows and default autohide off, so add a gjs unit test `tests/window_tracker_check.js` for `WindowTracker` with fake window objects (connectObject/disconnectObject stubs) **if `autohide.js` can be imported without Shell modules**. Otherwise put `WindowTracker` in a new `windowTracker.js` (allowed by this card) so it can be tested, and import it from `autohide.js`.
- **Human:** yes. Autohide + dodge on: move/resize a window over the dock ⇒ dock hides/shows; close it ⇒ dock shows; two monitors with docks on both (if available); turn autohide off/on.

#### R-0e — Probe v2: fair timing, shutdown criticals, live instances, settings hook
- **Fixes:** T-5, T-6, T-8; prerequisite for strict leaks after R-7d.
- **Scope:** `tools/smoke-shell.sh`, `probe.js`; `dock.js`, `animator.js`, `extension.js` **only** the counter / hook call lines described below.
- **Context (HEAD deb31fb):**
  - `smoke-shell.sh` sleeps 4 s after the initial enable but only 1 s after each later enable (T-5 ⇒ `lo` +1 artifact).
  - The signature step (`.sig` + baseline compare) runs while the shell is alive; `cleanup()` kills it at EXIT. So criticals logged during shutdown (~150 "sweeping phase of GC" at HEAD) are never seen (T-8).
  - `probe.js` walks `global.stage`; docks removed from the stage are invisible (T-6). Nothing calls `Dock.destroy()` / `Animator.destroy()` yet (R-7d).
  - Isolated smoke uses `GSETTINGS_BACKEND=memory` with defaults only, so trash/downloads/clock/calendar/autohide paths never run.
- **Do:**
  1. **T-5:** one settle wait (`D2DA_SMOKE_SETTLE`, default 2 s) after the initial enable *and* after every re-enable, before the next disable. The `lo` delta must become 0 without hiding real growth.
  2. **T-8:** after the toggles and the state checks, stop the shell (SIGTERM, wait up to ~10 s, then SIGKILL) **before** building signatures, so shutdown output is included. Keep the "shell died" check before the stop. Print `shutdown criticals: N` (count of CRITICAL/`sweeping phase of GC` lines after the last `dash2dock-lite` lifecycle line, or after a marker you log). Shutdown criticals must not break the NEW-signature gate today: keep them out of the signature comparison (report the count only) unless `D2DA_SMOKE_STRICT_LEAKS=1`, where N > 0 fails. Document this in the header.
  3. **T-6 live instances:** `probe.js` exports `live(kind, delta)` (always counts; a plain integer map, no env check; nothing else) and adds the counts to the probe JSON as `liveDock`, `liveDash`, `liveAnimator`. Counter lines: `Dock` constructor/`_init` +1 and a `destroy` signal handler −1 (St actor); the extension-created Dash +1 where it's created in `dock.js` (`createDash`) and −1 on its `destroy` signal; `Animator` constructor +1 (add a trivial constructor if needed) and `Animator.destroy()` −1. Expected now: `liveDock`/`liveAnimator` grow by 1 per toggle (the B-1 leak), which is what R-7d must bring to 0.
  4. **Strict mode:** FAIL if probe line counts ≠ N+1/N (currently only printed).
  5. **Settings hook:** `probe.js` exports `applySmokeSettings(settings)`. It does nothing unless `D2DA_PROBE === '1'` **and** `GSETTINGS_BACKEND === 'memory'` (never touches real dconf). It parses `D2DA_SMOKE_SETTINGS` (`key=value` separated by spaces; value parsed with `GLib.Variant.parse` using the key's type from `settings.settings_schema.get_key(key).get_value_type()`), sets each key, and logs `d2da-probe settings applied: …`. Errors go to `console.error('d2da: probe settings', e)`. Call it from `extension.js` `enable()` right after `this._settings` exists and before docks are built. `smoke-shell.sh` passes `D2DA_SMOKE_SETTINGS` through.
- **Don't:** change extension behaviour when `D2DA_PROBE` is unset; touch real dconf; fix the leaks themselves (R-7d); add anything per-frame.
- **Accept:**
  - `make smoke`: deltas all 0 except the live-instance growth, `shutdown criticals: N` printed, still PASS.
  - `D2DA_SMOKE_SETTINGS='trash-icon=true downloads-icon=true clock-icon=true calendar-icon=true autohide-dash=true' make smoke` runs those paths (report any new signatures; don't fix them, list them as findings).
  - `D2DA_PROBE=0 tools/smoke-shell.sh 2`: 0 probe lines and no settings applied.
- **Verify:** `make check`; `make lint`; `tools/check-settings.py` exit 0; `gjs -m tests/timer_check.js`; `gjs -m tests/window_tracker_check.js`; `make smoke` ×2; the two Accept variants. Paste the probe table and shutdown count from a default run into the Report (they become the new metrics baseline).
- **Human:** no.
- **R-7d** Also B-39 (`_updateExtraIcons` must `destroy()` removed items) and B-40 (`destroyDash` cleans up all box children). `Dock.destroy()` (dash, struts, dwell, renderArea) and `extension.destroyDocks()` calls it. Fixes B-1, B-38 (`_findIcons` null `dash`). Order: `animator.destroy()` **before** `renderArea` is destroyed. Accept also: the shutdown GC-critical count (T-8, ~150 at 30ae2d5) drops. Accept: probe deltas = 0 **including R-0e live-instance counters** (stage-walk deltas are already 0 and can't see B-1, T-6) → Orchestrator turns on `D2DA_SMOKE_STRICT_LEAKS=1`.
- **R-8** Services: one debounce handle per job (B-36), `Gio.Cancellable`s, `monitor.cancel()`, enumerator `close()`, per-service try/catch, measured `dt` (B-25).
- **R-9a** Trash: empty via Gio with confirmation, no `rm -rf` (B-8). **R-9b** Launchers: `DesktopAppInfo` from in-memory `GLib.KeyFile`, `GLib.shell_quote` (B-10). **R-9c** XDG paths (B-22). **R-9d** CSS from runtime dir / in-memory, per shell instance (B-37).

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
