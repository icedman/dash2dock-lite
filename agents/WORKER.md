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
Cycle:      1.3
Task:       R-3 — Autohide correctness
Attempt:    2
Card:       §6 "R-3"
Notes:      HEAD c84f252. R-1 hardened the timer: a TypeError in a subscriber is now logged
            as `d2da: timer … subscriber …` instead of killing the timer, so B-3 is no
            longer fatal but still has to be fixed at the root. R-2 reset
            `_debounceCheckSeq` in autohide `disable()` before the `_enabled` early return;
            keep that. `autohider._animationSeq` is never assigned (dead field). Leave it,
            R-18/R-21 prune. Isolated smoke has no windows, so it can't exercise
            `_checkOverlap`. If cheap, extend `tests/` with a gjs check of the pure parts
            (e.g. the window filter as a small exported helper, but only if that needs
            no structural change). Otherwise rely on code reading and say so.
            Use `Meta.WindowType.*` constants, not numbers. Note which types you include
            and why (comment at `handledWindowTypes`). `DockPosition.TOP` per §3.4.
            Gate baselines: lint 0/166; check-settings 2/30; smoke 1 known sig,
            deltas 0/0/0/0/0/+1/0; timer_check 15/15.
Rework 2:   HUMAN DECISION (B-26), the product rule:
              - Dock HIDDEN ⇒ reveal ONLY when the pointer enters the 2px edge strip
                (pressure sense / edge trigger). Pointer position over the hidden dock's
                area must NOT reveal it, whatever the focus/restack changes.
              - Dock SHOWN ⇒ pointer over the dock's area keeps it revealed. Never
                autohide while the pointer is in its area.
            Implement exactly that. If the shown case is already fully covered by
            `_isWithinDash` (20px pad while shown), remove the revived `isInRect` term
            (B-26 resolved by removal); otherwise guard it so it applies only while
            shown. Say which, and why, in the Report.
            Also fix the B-3 comment: mutter returns the active workspace for sticky
            windows, so `?.` is a defensive guard (window being set up/removed), not
            a TypeError fix. Correct the B-3/B-26 text in your Report. Leave the other
            hunks (B-4, B-27) as they are; they passed review. Don't touch the similar dead
            check in animator.js (separate card).
```

## 5. Report

> Overwritten by the WORKER each cycle; read by the AUDITOR.

```
Cycle / Task / Attempt: 1.3 / R-3 / 2
Status:            DONE
Files changed:     autohide.js (+24/-18 vs HEAD c84f252)
Rework items (AUDITOR Last verdict 1.3/1, human decision on B-26):
  1. B-26 resolved by REMOVAL. `|| isInRect(arect, pointer, 0)` dropped from _checkOverlap.
     The things that became unused went with it: `pos`, `rect`, `arect`, the
     `//! change to struts rect` and `// console.log(arect)` lines, and the `isInRect` import.
     Nothing else was removed (get_distance_sqr/get_distance were unused before; lint for
     autohide.js is still 3 warnings).
     Why removal and not a `!_hidden` guard: the shown case is already fully covered.
     dock.js:_isWithinDash(p) is `if (this._hidden) return false;` followed by
     `isInRect(<struts transformed pos, struts.width, struts.height>, p, 20)`. That is the same
     struts rect the removed term built (`this.dock.struts.get_transformed_position()` +
     width/height), with a 20 px pad, so a strict superset of pad 0. A guarded term would
     never be true when _isWithinDash is false, so it would be dead code.
     How the human rule maps to the code now:
       - SHOWN (dock._hidden false): pointer in the struts rect +20 px ⇒ _checkOverlap returns
         false ⇒ _checkHide -> show(); the dock never autohides while the pointer is in its area.
       - HIDDEN: _isWithinDash is false, so pointer position over the dock area plays no part
         in any _checkHide (focus/restack/window move). Reveal through the dwell edge strip
         only: _onEnterEvent -> show() when pressure sense is OFF, _onMotionEvent dwell count
         when it is ON (B-27 TOP clause included). _checkHide can still show() a hidden dock
         when no window overlaps it in dodge mode. That is dodge semantics, not pointer
         driven, and unchanged.
     Comment added above the check stating this rule. The similar dead check in animator.js
     (`_hidden && isWithin` -> slideIn) is untouched, as instructed.
  2. B-3 code comment corrected: "get_workspace() returns the active workspace for sticky
     windows, but may be null for a window that is still being managed or is being unmanaged".
  3. Report text corrected (below).
Findings addressed:
  B-3  Not reproducible as described. Mutter's meta_window_get_workspace() returns the
       active workspace for on-all-workspaces windows (Auditor checked mutter 45.0/49.7
       source + GIR), so sticky windows never threw and were always dodged. The change
       `(w.is_on_all_workspaces() || w.get_workspace()?.index() === workspace)` is only a
       defensive null guard for windows without a workspace (being managed/unmanaged).
       I withdraw my Attempt 1 claims ("no longer throw", "now dodged on every workspace").
       R-2's unconditional _debounceCheckSeq reset in disable() is untouched.
  B-4  unchanged from Attempt 1 (passed review): `.includes()`; effective types NORMAL,
       DIALOG, MODAL_DIALOG, UTILITY; comment at handledWindowTypes. DESKTOP/DOCK no longer
       count as overlapping (intended).
  B-26 Closed as "dead check removed". Correction to Attempt 1: reviving it would have
       revealed a hidden dock with pressure sense OFF too, not only ON. With it OFF, clicking
       or typing in the bottom ~icon-height band of a window over the dock would have
       revealed it. Nit acknowledged: the `_hidden` guard in _isWithinDash predates 02ab4b5
       (that commit only reformatted it).
  B-27 unchanged from Attempt 1 (passed review).
Tests: no gjs unit test, same reason as Attempt 1 (autohide.js -> dock.js -> resource:///
  org/gnome/shell imports; not loadable in plain gjs without restructuring). Code reading only.
Self-verification:
  make check = OK
  make lint = 0 errors / 166 warnings (unchanged; autohide.js 3 = HEAD)
  python3 tools/check-settings.py = 2 errors / 30 warnings (unchanged)
  gjs -m tests/timer_check.js = 15/15 ok
  make smoke = PASS, 1 known sig, 0 new, 0 gone; msgs 6/5; probe 6/5.
    after-enable deltas all 0 (uiGroup 40, stage 2877, dashes 2, docks 1, hi 1, lo 2, loop 1).
    after-disable: uiGroup 36, stage 2854, dashes 1, docks 0, hi 0, lo 0->1, loop 1;
    deltas 0/0/0/0/0/+1/0 (= baseline, lo +1 = known T-5).
    grep -c 'd2da: ' /tmp/d2da-smoke.log = 0; 'unable to layout' = 0.
  No artifacts left (temp report/helper deleted, python run with -B; no __pycache__).
Needs human visual check: yes:
  - autohide+dodge, bottom and top dock: overlap hides, moving the window away shows.
  - Dock hidden, pointer parked over the dock area inside an overlapping window, click/
    focus another window: the dock must stay hidden. It reveals only at the edge strip
    (pressure sense ON: push; OFF: touch).
  - Dock shown, pointer resting on the dock while a window overlaps it: stays shown.
  - pressure sense ON with a top dock: a push at the top reveals; the bottom edge does nothing.
  - dialog/utility window over the dock dodges; X11 + desktop icons: dock not stuck hidden.
New findings (proposed B-xx, with file:symbol and evidence):
  - (from Attempt 1, Auditor agreed, Low) autohide.js:_checkOverlap dereferences
    `monitor.index` while other code treats dock._monitor as nullable.
Scope request / blockers: none
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
- **R-0e** Probe v2 (T-5, T-6): same settle wait before every disable in `tools/smoke-shell.sh`; strict mode FAILs if probe line counts ≠ N+1/N; live-instance counters for the extension's `Dock` / `Dash` / `Animator` (counter bump in ctor + destroy is the only change allowed in those files) reported as new probe fields. Scope `probe.js`, `tools/smoke-shell.sh`, `dock.js`, `animator.js` (counter lines only). Accept: `lo` delta 0; live-instance deltas recorded (expected > 0 until R-7d).
- **R-7a** Animator teardown: `Animator.destroy()` destroys renderer/dot/badge pools. Scope `animator.js`, `dock.js`.
- **R-7b** Menus & lists: `DockItemContainer` destroy handler → `menu.destroy()` + `menuManager.removeMenu`; `_destroyList` → `list.destroy()`; clock/calendar destroyed with their item. Fixes B-29. Scope `dockItems.js`, `dockItemMenu.js`, `dock.js`, `services.js`.
- **R-7c** Autohide window tracking via a per-extension `WindowTracker` (Map), no `_tracked`/`_parent` expandos. Fixes B-31. Scope `autohide.js`, `extension.js`.
- **R-7d** `Dock.destroy()` (dash, struts, dwell, renderArea) and `extension.destroyDocks()` calls it. Fixes B-1. Accept: probe deltas = 0 **including R-0e live-instance counters** (stage-walk deltas are already 0 and can't see B-1, T-6) → Orchestrator turns on `D2DA_SMOKE_STRICT_LEAKS=1`.
- **R-8** Services: one debounce handle per job (B-36), `Gio.Cancellable`s, `monitor.cancel()`, enumerator `close()`, per-service try/catch, measured `dt` (B-25).
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
