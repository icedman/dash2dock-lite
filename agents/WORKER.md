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
| W13 | **CPU budget & Idle (G2 golden rule):** Never hog the CPU. Idle dock MUST consume 0% CPU (no spinning timers, no active timelines, zero wakeups while idle). When animating, CPU usage must stay low (≤ 40–50% of a single core; paced timer loop). Any change that prevents the dock from idling or pushes animation CPU above ~50% (such as unthrottled Clutter.Timeline spinning) is a regression and will be rejected. |

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
| `../gnome-shell/` | GNOME Shell source tree (read directly, no resource extractio). Gnome versions are at branches gnome-45, gnome-46, and so on. |

Isolated smoke can't change settings from outside (memory backend is in-process). To exercise non-default settings in a test, gate the code path behind an env var read with `GLib.getenv('D2DA_…')` and document it in the card's Verify.

---

## 4. Current Assignment

> Written by the ORCHESTRATOR only. Worker: do not edit this section.

```
Cycle:      4.5
Task:       R-16 — Evaluation on dropping Shell Dash.js dependency
Attempt:    1
Card:       §6 "R-16"
Notes:      HEAD ecf4f95. Skipped R-14c/d per human directive.
            Goal: Comprehensive evaluation of dropping Shell ui/dash.js (`new Dash()`) entirely.
            Analyze: (1) exact Dash capabilities currently utilized, (2) private monkeypatches/couplings
            eliminated, (3) replacement architecture using Shell public AppFavorites + AppSystem + WindowTracker,
            (4) DnD, context menu, and ShowApps decoupling, (5) phased migration strategy.
```

## 5. Report

> Overwritten by the WORKER each cycle; read by the AUDITOR.

```
Cycle / Task / Attempt: 4.2 / R-14b / 1
Status:            DONE (all items in one cycle, nothing deferred)
Files changed:     compat.js, dock.js, extension.js, tests/compat_baseline_check.js.
                   HEAD f5b1cd4.
What changed:
  - compat.js:
    - Added Dash structural helpers:
      - `getDashBox(dash)`: returns `dash?._box ?? dash?._dashContainer?._box ?? null`. (C1)
      - `getDashContainer(dash)`: returns `dash?._dashContainer ?? dash?.last_child ?? null`. (C1)
      - `getDashShowAppsIcon(dash)`: returns `dash?._showAppsIcon ?? null`. (C1)
      - `getDashBackground(dash)`: returns `dash?._background ?? null`. (C1)
      - `setupDashProxy(dash)`: wraps the proxy adjustments (`_adjustIconSize = () => {}`, monkeypatching `_createAppItem` to set `this.opacity = 0; item.child.visible = false;`) with safe guards. (C1)
      - `setDashOrientation(dash, orientation)`: safely updates orientation on container and box layout managers. (C1)
      - `setDashLayoutDirection(dash, isRtl)`: safely sets text direction (RTL/LTR) on container and box. (C1)
    - Added Overview Dash encapsulation helper:
      - `setOverviewDashVisibility(overviewDash, show, state)`: manages visibility/opacity of `overviewDash`, background, box children, and showApps icon; saves and restores state without any `__box` expando. (C4)
  - extension.js:
    - (C4) Eliminated `Main.overview.dash.__box = Main.overview.dash._box;` expando.
    - (C4) Replaced direct property manipulations in `_showMainOverviewDash(show)` with `Compat.setOverviewDashVisibility(Main.overview.dash, show, this._overviewDashState)`.
    - (C4) In `startup-complete`: used `Compat.getDashContainer(Main.overview.dash)` to remember and hide the container.
  - dock.js:
    - (C1) In `destroyDash()`: replaced `this.dash._box` and `this.dash._showAppsIcon` with `Compat.getDashBox(this.dash)` and `Compat.getDashShowAppsIcon(this.dash)`.
    - (C1) In `createDash()`: delegated proxy setup to `Compat.setupDashProxy(dash)` and background/box setup to `Compat.getDashBackground(this.dash)` / `Compat.getDashBox(this.dash)`.
    - (C1) In `_inspectIcon()`: used `Compat.getDashShowAppsIcon(this.dash)`.
    - (C1) In `_findIcons()`: replaced `this.dash._box` with `Compat.getDashBox(this.dash)` and `this.dash._showAppsIcon` with `Compat.getDashShowAppsIcon(this.dash)`.
    - (C1) In `relayout()`: used `Compat.getDashContainer(this.dash)` and `Compat.setDashLayoutDirection(this.dash, this.extension.apps_icon_front)`.
    - (C1) In `_adjustTheme()`: used `Compat.setDashOrientation(this.dash, vertical)`.
  - tests/compat_baseline_check.js:
    - Added 12 unit test assertions (total 49 passing) verifying `getDashBox`, `getDashContainer`, `getDashShowAppsIcon`, `getDashBackground`, `setupDashProxy`, `setDashOrientation`, `setDashLayoutDirection`, and `setOverviewDashVisibility` with verified absence of `__box` expando.
Self-verification:
  - `make check`: OK.
  - `make lint`: 0 errors / 137 warnings (down from 138 at HEAD).
  - `python3 -B tools/check-settings.py`: 0 errors, 30 warnings, exit 0.
  - `gjs -m tests/compat_baseline_check.js`: 49/49 passed.
  - `gjs -m tests/timer_check.js`: 15/15 passed.
  - `gjs -m tests/window_tracker_check.js`: 20/20 passed.
  - `make smoke`: PASS, 0 new sigs (1 known), shutdown criticals 0, msgs 6/5, probe lines 6/5,
    probe after-disable deltas all 0.
  - `D2DA_SMOKE_STRICT_LEAKS=1 tools/smoke-shell.sh 5`: PASS, shutdown criticals 0, probe line counts 6/5,
    probe after-disable deltas all 0.
  - `D2DA_SMOKE_SETTINGS='trash-icon=true downloads-icon=true clock-icon=true calendar-icon=true autohide-dash=true' D2DA_SMOKE_STRICT_LEAKS=1 tools/smoke-shell.sh 5`: PASS,
    shutdown criticals 0, probe line counts 6/5, probe after-disable deltas all 0.
  - `grep -n '__box' extension.js`: 0 matches.
New findings / notes:
  - Historical investigation confirmed `__box` was originally introduced in Jan 2023 (`6e490da8`) as a temporary swap target for Compiz-alike Magic Lamp Effect (`Main.overview.dash._box = this.dashContainer.dash._box`). Later commits (`2e6b474`) refactored Compiz integration to directly query `dock.dash._box` rather than swapping `Main.overview.dash._box`, rendering `__box` completely dead and safe to eliminate.
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
#### R-7d — `Dock.destroy()`; destroy the Shell Dash and chrome actors
- **Fixes:** B-1 (dock side), B-38, B-39, B-40.
- **Scope:** `dock.js`, `extension.js` (`destroyDocks`), `animator.js` (only an idempotence guard in `destroy()`).
- **Context (HEAD 523cec2):**
  - `Dock` (`DashToDock extends St.Widget`, `dock.js` `_init`) children: `_background`, `fake_dash` (+ `fake_dash_background`), `renderArea`, the Shell `Dash` from `createDash()`. Separate chrome actors (not children): `struts`, `dwell` (added in `addToChrome`, removed in `removeFromChrome`). `dwell` has `connectObject(..., this)` to the autohider.
  - `extension.destroyDocks()` = `undock()` + `cancelAnimations()` + `destroyDash()`, then drops the array. Nothing is destroyed. Probe at 523cec2: liveDock/liveDash/liveAnimator +1 per toggle; 30 shutdown criticals per toggle.
  - `destroyDash()` cleans `_findIcons()` items, then `remove_child(this.dash)`, `dash = null`. It's also used by `recreateDash()` (`recreateAllDocks`), so the Shell Dash leaks there too.
  - `_findIcons()` reads `this.dash._box` in the cached branch ⇒ TypeError once `dash` is null (B-38).
  - `_updateExtraIcons()` `remove_child`s unmounted/unpinned extras without destroying them (B-39). The R-7b container `destroy` handler would then tear down their menus.
  - `destroyDash()` only cleans items `_findIcons` returns; hidden items are skipped (B-40).
  - `Animator.destroy()` (R-7a) = `disable()` + null `dock`/`extension`; not idempotent.
- **Do:**
  - `destroyDash()`: run `_cleanupIcon` over **all** `dash._box` children plus `_extraIcons` children (B-40), then `this.dash.destroy()` (not just `remove_child`), null `dash`, `_icons`, the item refs. Keep `recreateDash()` working (it creates a new Dash afterwards).
  - `_findIcons()`: return `[]` (or the empty state its callers expect) when `!this.dash` (B-38).
  - `_updateExtraIcons()`: `extra.destroy()` instead of `remove_child` for removed extras (B-39).
  - Add `Dock.destroy()` (override; guard with `this._destroyed`): `undock()` if on chrome, `cancelAnimations()`, `destroyDash()`, `animator.destroy()` (**before** `renderArea` goes), autohider teardown (`disable()` + null refs), `struts.destroy()`, `dwell.destroy()` (destroy disconnects its handlers), null refs, then `super.destroy()` (destroys remaining children). Use whichever override pattern the file's GObject classes already use; check `_onDestroy` vs overriding `destroy`. Calling `super.destroy()` from a `destroy` override in GJS is fine.
  - `extension.destroyDocks()`: call `dock.destroy()` per dock (it does undock/cancel/destroyDash itself).
  - `Animator.destroy()`: idempotent (return early if already destroyed).
  - Find every remaining reader of a destroyed dock (timers, `listeners`, `this.dock`, integrations `_bms`, autohide windowTracker callbacks via `extension.checkHide`), and make sure they're nulled or guarded. R-2 already resets handles.
- **Don't:** change layout/animation behaviour; touch `session-modes` (lock-screen handling is separate); add new monkeypatches.
- **Accept:** `make smoke`: `liveDock`/`liveDash`/`liveAnimator` after-disable deltas **0** (after-enable deltas 0 too); shutdown criticals drop substantially (report the number; target ≈ 0); 0 disposed/finalized; no new signatures. The settings variant (`D2DA_SMOKE_SETTINGS='trash-icon=true downloads-icon=true clock-icon=true calendar-icon=true autohide-dash=true' make smoke`) is also clean with live deltas 0. `D2DA_SMOKE_STRICT_LEAKS=1 tools/smoke-shell.sh 3` reported (expected PASS if shutdown criticals reach 0; if some remain, list what they are).
- **Verify:** `make check`; `make lint`; `tools/check-settings.py` exit 0; `gjs -m tests/timer_check.js`; `gjs -m tests/window_tracker_check.js`; the Accept runs.
- **Human:** yes. Toggle the extension several times; change preferred monitor and multi-monitor setting (dock rebuild); lock/unlock the screen; plug/unplug a monitor if possible. The dock always renders, no duplicate docks, no stuck dash in the overview.

#### R-7e — Reliable toggles in smoke (T-9) + createTheDocks duplicate guard (B-41)
- **Fixes:** T-9, B-41.
- **Scope:** `tools/smoke-shell.sh`; `extension.js` (`createTheDocks` only).
- **Do:** (T-9) In the toggle loop, after `gnome-extensions disable`, poll `state` (≤ 5 s, 0.25 s steps) until it isn't ACTIVE. If it never changes, retry the command once; if it still fails, print `FAIL: disable not applied (toggle n)` and set RESULT=1. Same for enable ⇒ ACTIVE. Then the existing settle wait. Exclude `stage` from the strict delta check (keep printing it); document why (run-to-run noise outside the extension). (B-41) Read `createTheDocks` and the callers of `startUp`. If the multi-monitor branch can run with the right number of docks alive, make it idempotent (return when `docks.length == count`, else destroyDocks + create). If it can't, say why and leave a one-line comment instead of a code change.
- **Accept:** strict smoke (`D2DA_SMOKE_STRICT_LEAKS=1 tools/smoke-shell.sh 5`) passes 3 runs in a row; default `make smoke` passes.
- **Verify:** `make check`; `make lint`; `tools/check-settings.py` exit 0; `gjs -m tests/timer_check.js`; `gjs -m tests/window_tracker_check.js`; strict ×3; `make smoke`.
- **Human:** no (multi-monitor rebuild is already on the 2.4 human-check list).

#### R-8 — Services cancellables, debounces, enumerator cleanup and measured dt
- **Fixes:** B-25, B-36.
- **Scope:** `services.js`; `extension.js`.
- **Do:**
  - (B-36) In `services.js`, split `_debounceCheckSeq` into two distinct handles on `this.extension._loTimer`: `_debounceRecentsSeq` (used by `_debounceCheckRecents`) and `_debounceDownloadsSeq` (used by `_debounceCheckDownloads`). In `disable()`, cancel and null both handles.
  - (B-25 per-service try/catch) In `ServiceCounter.update(elapsed)` (or `Services.update`), wrap the callback in `try { ... } catch (e) { console.error('d2da: service ' + this.name + ' update', e); }` so a failure in one service does not crash the loop or starve remaining services.
  - (B-25 measured dt) In `extension.js`, measure actual elapsed milliseconds using `GLib.get_monotonic_time()` between calls to `services.update(elapsed)` instead of passing the hardcoded `SERVICES_UPDATE_INTERVAL` (2500 ms) while `_timer` resolution is 3500 ms. Default to 2500 on the first call. Reset timestamp on `disable()` / `enable()`.
  - (Cancellables) In `services.js`, create `this._cancellable = new Gio.Cancellable()` in `enable()`. In `disable()`, call `this._cancellable.cancel()` and null it. Pass `this._cancellable` to cancellable Gio operations (`enumerate_children`, `next_file`, `load_contents_async`). Catch cancelled errors gracefully (`GLib.Error.matches(e, Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)` or `this._cancellable?.is_cancelled()`).
  - (Monitor cancel) In `services.js`, call `this._trashMonitor?.cancel()` and `this._downloadsMonitor?.cancel()` on `disable()` (and before re-creating `_downloadsMonitor` in `setupDownloads()`).
  - (Enumerator close) In `checkTrash()` and `checkRecentFilesInFolder()`, wrap the enumerator usage in `try ... finally` and call `iter?.close(null)` (or `close_async`) to release file descriptors promptly.
- **Don't:** Change desktop file generation or shell spawn paths (that's R-9a/R-9b). Don't touch real dconf or run interactive tests.
- **Accept:** `make check`, `make lint` (0 errors, ≤ 150 warnings), `tools/check-settings.py` (exit 0), unit tests pass, `make smoke` and strict smoke pass with 0 new signatures and all deltas 0.
- **Verify:** `make check`; `make lint`; `python3 -B tools/check-settings.py`; `gjs -m tests/timer_check.js`; `gjs -m tests/window_tracker_check.js`; `D2DA_SMOKE_STRICT_LEAKS=1 tools/smoke-shell.sh 5`; `make smoke`.
#### R-9a — Trash emptying via Gio with confirmation (B-8)
- **Fixes:** B-8.
- **Scope:** `services.js`; `dockItems.js`; `apps/empty-trash.sh`.
- **Do:**
  - (B-8 remove `rm -rf`) In `services.js:setupTrashIcon`, remove the hardcoded `rm -rf` command and `Terminal=true`. Set the desktop action `Exec` to `gio trash --empty` with `Terminal=false`.
  - (Gio emptyTrash) In `services.js`, add an `emptyTrash()` method: enumerate children of `this._trashDir` (`trash:///`) and delete each child via Gio (`child.delete(this._cancellable ?? null)` or `child.delete_async`), close the enumerator, call `this.checkTrash()`, and refresh dock icon state (`this.extension.animate({ refresh: true })`).
  - (Confirmation dialog) In `dockItems.js:DockItemMenu`, when handling the `trash` action (e.g. from context menu "Empty Trash"), display a GNOME Shell modal confirmation dialog (`ModalDialog.ModalDialog` with `Dialog.MessageDialogContent`: title "Empty Trash?", description "All items in the Trash will be permanently deleted.") with Cancel and destructive "Empty Trash" buttons. Only proceed to empty trash when confirmed. Ensure the dialog closes cleanly, disconnects, and does not leak actors.
  - Delete `apps/empty-trash.sh` (or replace its content with `gio trash --empty`).
- **Don't:** Never execute `rm -rf`. Never empty trash without confirmation when triggered from the dock menu. Never delete files outside `trash:///`. Don't empty real trash during automated test suites.
- **Accept:** `make check`, `make lint` (0 errors, ≤ 150 warnings), `tools/check-settings.py` (exit 0), unit tests pass, `make smoke` and strict smoke pass with 0 new signatures and all deltas 0.
- **Verify:** `make check`; `make lint`; `python3 -B tools/check-settings.py`; `gjs -m tests/timer_check.js`; `gjs -m tests/window_tracker_check.js`; `D2DA_SMOKE_STRICT_LEAKS=1 tools/smoke-shell.sh 5`; `make smoke`.
#### R-9b — Launchers in memory from GLib.KeyFile without /tmp (B-10)
- **Fixes:** B-10.
- **Scope:** `services.js`; `dock.js`; `dockItems.js`.
- **Do:**
  - (B-10 in-memory DesktopAppInfo) In `services.js`, replace writing `.desktop` files into `/tmp` via `tempPath` with in-memory `Gio.DesktopAppInfo` construction:
    - Create a helper to build `Gio.DesktopAppInfo` from `GLib.KeyFile` in memory:
      ```javascript
      const kf = new GLib.KeyFile();
      kf.load_from_data(desktopContent, -1, GLib.KeyFileFlags.NONE);
      const appInfo = Gio.DesktopAppInfo.new_from_keyfile(kf);
      ```
    - Apply this to `setupTrashIcon()`, `setupFolderIcon()`, and `setupMountIcon()`, storing the in-memory app info objects in `services` (e.g. `this.trashApp`, `this.folderApps = {}`, `this.mountApps = {}`).
    - Use `GLib.shell_quote` for any dynamic path injected into `Exec=` (e.g. folder paths, mount locations).
    - Remove the `fn.replace_contents(...)` calls that write `.desktop` files to `/tmp`.
  - In `dock.js`:
    - Update `createItem(appOrPath)` to accept either a `DesktopAppInfo` object or a path string.
    - In `_updateExtraIcons()`: pass the in-memory app info from `this.extension.services` directly to `createItem` for mounts, downloads, and trash instead of `tempPath(...)`.
  - In `dockItems.js`:
    - In `DockItemContainer._init`: enable menu creation when `params.app` is provided (`if (params.appinfo_filename || params.app)`).
    - Replace the `Shell.AppSystem.get_default().get_installed()[0].constructor` hack with standard `Gio.DesktopAppInfo`.
- **Don't:** Don't touch CSS styling or theme handling (that's R-9d). Don't break dock item clicking or context menu activation. Don't write any new files to `/tmp`.
- **Accept:** No `/tmp/*-dash2dock-lite.desktop` files created during extension lifecycle; right-clicking and clicking trash/mount/downloads icons work properly; `make check`, `make lint` (0 errors, ≤ 150 warnings), `tools/check-settings.py` (exit 0), unit tests pass, `make smoke` and strict smoke pass with 0 new signatures and all deltas 0.
- **Verify:** `make check`; `make lint`; `python3 -B tools/check-settings.py`; `gjs -m tests/timer_check.js`; `gjs -m tests/window_tracker_check.js`; `D2DA_SMOKE_STRICT_LEAKS=1 tools/smoke-shell.sh 5`; `make smoke`.
#### R-9c — Use standard XDG user paths and harden config loading (B-21, B-22)
- **Fixes:** B-21, B-22.
- **Scope:** `services.js`; `dock.js`; `extension.js`; `prefs.js`; `utils.js`.
- **Do:**
  - (B-22 XDG user dirs):
    - Replace relative `'Downloads'` and `'Documents'` paths with standard GLib user directory resolution:
      `GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD) || GLib.build_filenamev([GLib.get_home_dir(), 'Downloads'])`
      and
      `GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOCUMENTS) || GLib.build_filenamev([GLib.get_home_dir(), 'Documents'])`.
    - In `services.js`:
      - In `setupDownloads()`, initialize `this._downloadsDir` using the resolved downloads path.
      - In `setupFolderIcons()`, pass the resolved downloads and documents paths into `setupFolderIcon()`.
      - In `checkRecentFilesInFolder(path)`, construct child file paths using `GLib.build_filenamev([path, fileName])` instead of hardcoded relative path `Downloads/${fileName}` or string concatenation.
    - In `dock.js`:
      - In `_updateExtraIcons()` for downloads item, use `this.extension.services._downloadsDir?.get_path()` (with fallback to the resolved downloads path) for `folder` and `setupFolderIcon(...)`.
    - In `extension.js`:
      - In `_loadConfig()` and `_unloadConfig()`, resolve the d2da config directory via:
        `const configDir = GLib.build_filenamev([GLib.get_user_config_dir(), 'd2da']);`
        instead of relative `'.config/d2da'`. Build paths for `config.json`, `icons.json`, `style.css`, and custom SVG icon files using `GLib.build_filenamev([configDir, ...])`.
    - In `prefs.js`:
      - In theme loading, resolve the custom themes directory via `GLib.build_filenamev([GLib.get_user_config_dir(), 'd2da', 'themes'])` instead of relative `'.config/d2da/themes'`.
  - (B-21 `loadFile` and `_loadConfig` error handling):
    - In `utils.js:loadFile`:
      - Wrap `load_contents_finish` in a `try ... catch` block.
      - If `!ok`, return immediately after rejecting (`reject(new Error('unable to load file')); return;`).
      - On error in the async callback, reject the promise (`reject(err); return;`).
    - In `extension.js:_loadConfig`:
      - Catch errors from `loadFile` and `JSON.parse` with `try ... catch (err) { console.error('d2da: loadConfig', err); }`.
- **Don't:** Don't touch CSS stylesheet loading logic or theme generation (that's R-9d). Don't break desktop file generation in memory (R-9b). Don't add synchronous I/O or new polling timers.
- **Accept:** All file paths resolve to absolute paths rooted at standard XDG directories; no relative paths to process cwd; `make check`, `make lint` (0 errors, ≤ 145 warnings), `tools/check-settings.py` (exit 0), unit tests pass, `make smoke` and strict smoke pass with 0 new signatures and all deltas 0.
- **Verify:** `make check`; `make lint`; `python3 -B tools/check-settings.py`; `gjs -m tests/timer_check.js`; `gjs -m tests/window_tracker_check.js`; `D2DA_SMOKE_STRICT_LEAKS=1 tools/smoke-shell.sh 5`; `make smoke`.
#### R-9d — CSS in runtime dir without /tmp per shell instance (B-37)
- **Fixes:** B-37.
- **Scope:** `style.js`; `utils.js`; `prefs.js`; `extension.js`.
- **Context (HEAD 4b343d1):**
  - In `style.js`, `Style.build` constructs `fn = Gio.File.new_for_path(tempPath(`${name}.css`))`, which delegates to `utils.js:tempPath`: `/tmp/${GLib.get_user_name()}-${path}`.
  - When the user runs a real GNOME session and the automated smoke test starts a nested GNOME Shell as the same user, both write and delete `/tmp/<user>-custom-d2dl.css`.
  - In `Style.unloadAll()`, `fn.delete(null)` throws and logs when another instance already deleted the file or when racing, causing intermittent smoke test failures and leaving one instance without stylesheet (B-37).
  - In `prefs.js`, `tempPath('theme.json')` is used when exporting a theme.
  - In `extension.js`, `tempPath` is imported on line 30 but never used (causing an eslint warning).
- **Do:**
  - (B-37 per-instance runtime dir):
    - Replace writing to `/tmp` with `GLib.get_user_runtime_dir()` (or fallback to `GLib.get_tmp_dir()`).
    - Make the generated CSS path per-instance by including a unique identifier: e.g. process ID or an instance UUID:
      `GLib.build_filenamev([GLib.get_user_runtime_dir(), `d2da-${name}-${GLib.getpid()}.css`])`. Ensure parent directory is created if needed.
    - In `style.js:unloadAll()`, when deleting the stylesheet file, catch and ignore `Gio.IOErrorEnum.NOT_FOUND` (e.g. `GLib.Error.matches(err, Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND)`). Log other unexpected errors with `console.error('d2da: style unloadAll', err)`.
    - In `style.js:build()`, clean up previous stylesheet files if the filename changes, or overwrite safely.
    - In `utils.js`, update or replace `tempPath` so that any temporary/runtime path uses `GLib.get_user_runtime_dir()` rather than hardcoded `/tmp`.
    - In `prefs.js`, save exported theme to user config or runtime dir (e.g. `GLib.build_filenamev([GLib.get_user_config_dir(), 'd2da', 'theme.json'])` or runtime dir) and update toast notice.
    - In `extension.js`, remove unused `tempPath` import.
- **Don't:** Don't break dynamic stylesheet reloading when settings change. Don't leave orphaned temporary files behind when `unloadAll()` runs. Don't add synchronous I/O or new polling timers.
- **Accept:** Zero files written to `/tmp` by `style.js`; concurrent shell instances do not collide or delete each other's stylesheets; `make check`, `make lint` (0 errors, ≤ 145 warnings; unused import warning in extension.js resolved), `tools/check-settings.py` (exit 0), unit tests pass, `make smoke` and strict smoke pass with 0 new signatures and all deltas 0.
- **Verify:** `make check`; `make lint`; `python3 -B tools/check-settings.py`; `gjs -m tests/timer_check.js`; `gjs -m tests/window_tracker_check.js`; `D2DA_SMOKE_STRICT_LEAKS=1 tools/smoke-shell.sh 5`; `make smoke`.
- **Human:** yes (end of Phase 2 wrap-up).

#### R-10 — Dirty-flag relayout() and remove per-frame layout() in animator (P-1)
- **Fixes:** P-1.
- **Scope:** `dock.js`, `animator.js`, `extension.js`.
- **Context (HEAD 748290b):**
  - In `animator.js` `_animate(dt)` (~line 156), `dock.layout()` is called on every single frame tick (60+ times/sec).
  - `dock.layout()` in `dock.js` (~line 1082) executes heavy DOM and layout operations on each call: calls `_updateExtraIcons()` (reconciling trash, mounts, downloads, clock, calendar), queries display monitor, calls `_findIcons()` (allocating children arrays), writes `icon.width`, `icon.height`, and `icon.style` on every icon actor, snaps dock and dash container edges, and recalculates dwell geometry.
  - Calling this every frame wastes CPU, causes unnecessary Clutter layout passes, and churns stage views.
- **Do:**
  - In `dock.js`:
    - Add a dirty flag `this._needsLayout = true` on `Dock`.
    - Provide `relayout(force = false)` (or `queueRelayout()`): if `force || this._needsLayout`, run the full layout logic and reset `this._needsLayout = false`.
    - Keep `layout()` as an alias or delegator to `relayout(true)` so external callers remain compatible.
    - Set `this._needsLayout = true` wherever dock structure/geometry changes: `_onAppsChanged()`, `_onMonitorsChanged()`, extra icons changes, `recreateDash()`, and settings changes.
    - Call `this.relayout(true)` in `dock()` on initial setup.
  - In `animator.js`:
    - In `_animate(dt)`: remove the unconditional per-frame `dock.layout()` call.
    - If `dock._needsLayout`: call `dock.relayout()`.
    - Ensure `animate()` returns cleanly if `!dock._icons` or `!dock._icons.length` without throwing or logging spam.
  - In `extension.js`:
    - Ensure settings that affect dock layout (e.g. `icon-size`, `icon-spacing`, `dock-location`, `apps-icon-front`, `panel-mode`, `edge-distance`, `animation-spread`, monitor changes) trigger `dock.relayout(true)` or set `dock._needsLayout = true`.
- **Don't:**
  - Do not change icon magnification math, spread easing, or bounce calculations (those are R-11/R-12).
  - Do not add new timers or polling.
  - Do not break multi-monitor dock sizing or positioning.
- **Accept:**
  - `dock.layout()` / `relayout()` is NOT called every frame while idle or animating unless `_needsLayout` was explicitly flagged.
  - Dock properly repositions/resizes when icons change (launch app, favorite change, mount added/removed), when monitor resolution/count changes, and when dock settings (position, size, spacing) change.
  - `make check`, `make lint` (0 errors, ≤ 140 warnings), `python3 tools/check-settings.py` (exit 0), unit tests pass (`timer_check`, `window_tracker_check`), `make smoke` and strict smoke pass with 0 new signatures and all deltas 0.
- **Verify:**
  - `make check`
  - `make lint`
  - `python3 -B tools/check-settings.py`
  - `gjs -m tests/timer_check.js`
  - `gjs -m tests/window_tracker_check.js`
  - `D2DA_SMOKE_STRICT_LEAKS=1 tools/smoke-shell.sh 5`
  - `make smoke`
- **Human:** yes — hover magnify settles smoothly, icons scale and dock resizes properly on settings changes and monitor changes.

- **R-11** frame-clock animation (`Clutter.Timeline` on the dock actor), exact one-shot debounces (P-2, B-24). Large: split into R-11a timeline driver, R-11b debounce helper, R-11c remove `animation-fps` hack.
- **R-12** allocation-free animator (P-3..P-7, P-11) — split per hotspot.
- **R-13** async services + notification signals + cached shader source (P-9, P-10).

### Phase 4 — GNOME-update resilience (stubs)

#### R-14a/R-15 — Baseline against apps & icons; public APIs and compat helper (C5, C6, C7, C8, C10, C17)
- **Fixes:** C5, C6, C7, C8, C10, C17.
- **Scope:** new `compat.js`; `dock.js`; `animator.js`; `extension.js`; `tests/compat_baseline_check.js`.
- **Context:**
  - `agents/task_4_1_baseline.md` establishes the baseline functionality for app discovery, icon extraction, favorites query, window controls, and overview delegation.
  - C5: `dock.js` calls `Fav.getAppFavorites()._getIds()`. Public GNOME Shell API is `getFavorites().map(a => a.get_id())` and `isFavorite(id)`.
  - C6: `animator.js:1098` uses private `appwell._id`. GNOME Shell provides `getId()` / `app.get_id()`.
  - C7: `dock.js:847-856` walks `Main.uiGroup` to find `overview._delegate`. Public GNOME Shell API is `Main.overview.visible ? Main.overview.toggle() : Main.overview.showApps()`.
  - C8: `dock.js:1546` calls `maximize(3)`/`unmaximize(3)`. In modern Mutter, flags were dropped (arity 0). Feature-detect maximize/unmaximize arity.
  - C10: `dock.js:512` sniffs `Config.PACKAGE_VERSION[0] == '4'` to set `affectsInputRegion: true`. On GNOME 50 it drops it. Pass `affectsInputRegion: true` unconditionally.
  - C17: `extension.js:175` sets dead expando `Main.overview.d2dl`. Never read. Delete it.
- **Do:**
  - Create `compat.js` exporting clean helpers with feature detection and fallbacks:
    - `getFavoriteAppIds(favManager)`: returns `favManager?.getFavorites?.().map(a => a.get_id?.() ?? a.id ?? '') ?? (favManager?.getFavoriteMap?.() ? Object.keys(favManager.getFavoriteMap()) : (favManager?._getIds?.() ?? []))`.
    - `getAppId(appwell)`: returns `appwell?.getId?.() ?? appwell?.app?.get_id?.() ?? appwell?.id ?? appwell?._id ?? ''`.
    - `getStIcon(appwell)`: extracts StIcon from `BaseIcon` / `_iconBin.child` / `.icon` / lazy `_createIconTexture`.
    - `showOverviewApps(overview)`: delegates to `overview.visible ? overview.toggle() : overview.showApps()`.
    - `maximizeWindow(win)` / `unmaximizeWindow(win)`: probes `win.maximize.length === 0 ? win.maximize() : win.maximize(3)`.
  - In `dock.js`:
    - Import `compat.js`.
    - In `_onAppsChanged()`: `this._favorite_ids = Compat.getFavoriteAppIds(Fav.getAppFavorites());`
    - In `_inspectIcon()`: use `Compat.getStIcon(appwell)` and `Compat.getAppId(appwell)`.
    - In `_findIcons()`: in ShowApps button press event, call `Compat.showOverviewApps(Main.overview)`.
    - In `addToChrome()`: remove `Config.PACKAGE_VERSION[0] == '4'` version sniffing; pass `{ affectsInputRegion: true }` unconditionally.
    - In `_maybeMinimizeOrMaximize()`: use `Compat.maximizeWindow(focusedWindow)` / `Compat.unmaximizeWindow(focusedWindow)`.
  - In `animator.js`:
    - Import `compat.js`.
    - In `bounceIcon(appwell)`: use `Compat.getAppId(appwell)`.
  - In `extension.js`:
    - Remove `Main.overview.d2dl = this;`.
  - In `tests/compat_baseline_check.js`:
    - Assert all 23 baseline contracts pass.
- **Don't:**
  - Do NOT edit `timer.js` or `tests/timer_check.js`.
  - Do NOT touch animation math / `Vector` in `animator.js`.
  - Do NOT remove `animation-fps`.
  - Do NOT add new Shell-private couplings or version sniffing.
- **Accept:**
  - `gjs -m tests/compat_baseline_check.js` passes all checks.
  - `make check`, `make lint` (0 errors, warnings ≤ 139), `python3 -B tools/check-settings.py` (exit 0).
  - `gjs -m tests/timer_check.js` (15/15), `gjs -m tests/window_tracker_check.js` (20/20).
  - `make smoke` passes with 0 new signatures, probe deltas 0, shutdown criticals 0.
- **Verify:**
  - `make check`
  - `make lint`
  - `python3 -B tools/check-settings.py`
  - `gjs -m tests/compat_baseline_check.js`
  - `gjs -m tests/timer_check.js`
  - `gjs -m tests/window_tracker_check.js`
  - `make smoke`
- **Human:** yes — apps and favorites display, show apps opens overview app grid, click to focus/minimize works.

#### R-14b — C1/C4 Dash & overview dash encapsulation
- **Fixes:** C1, C4.
- **Scope:** `compat.js`, `dock.js`, `extension.js`, `tests/compat_baseline_check.js`.
- **Context:**
  - C1: `dock.js` directly accesses `dash._box`, `dash._background`, `dash._showAppsIcon`, `dash.last_child` (= `_dashContainer`), and monkeypatches `dash._adjustIconSize` and `dash._createAppItem`.
  - C4: `extension.js:147-172` and `215` directly accesses `Main.overview.dash._box`, creates an expando `Main.overview.dash.__box = Main.overview.dash._box`, directly styles `_background.style`, mutates `_showAppsIcon.child`, and directly toggles `last_child.visible`.
- **Do:**
  - In `compat.js`:
    - Export Dash structural helpers:
      - `getDashBox(dash)`: returns `dash?._box ?? dash?._dashContainer?._box ?? null`.
      - `getDashContainer(dash)`: returns `dash?._dashContainer ?? dash?.last_child ?? null`.
      - `getDashShowAppsIcon(dash)`: returns `dash?._showAppsIcon ?? null`.
      - `getDashBackground(dash)`: returns `dash?._background ?? null`.
      - `setupDashProxy(dash)`: wraps the proxy adjustments (`_adjustIconSize = () => {}`, monkeypatching `_createAppItem` to set `this.opacity = 0; item.child.visible = false;`) with safe bounds and null checks.
      - `setDashLayoutDirection(dash, isRtl)`: sets text direction (RTL or LTR) on container and box if present.
      - `setDashOrientation(dash, vertical)`: sets `layout_manager.orientation` on container and box if present.
    - Export Overview Dash helpers (fixing C4):
      - `setOverviewDashVisibility(overviewDash, show, savedState)`:
        - Controls visibility/opacity of `overviewDash`, its background, box children, and showApps icon.
        - Eliminates the `__box` expando on `Main.overview.dash`!
        - Saves and restores state (such as `last_child` / `_dashContainer` visibility and styles) cleanly.
  - In `extension.js`:
    - Remove `Main.overview.dash.__box = Main.overview.dash._box;` (C4 expando elimination).
    - In `_showMainOverviewDash(show)`: delegate to `Compat.setOverviewDashVisibility(Main.overview.dash, show, this._overviewDashState)`.
    - In `startup-complete` (line 809): use `Compat.setOverviewDashVisibility` / `Compat.hideOverviewDashStartup`.
  - In `dock.js`:
    - Replace direct accesses to `this.dash._box`, `this.dash.last_child`, `this.dash._showAppsIcon`, `this.dash._background` with `Compat.getDashBox(this.dash)`, `Compat.getDashContainer(this.dash)`, `Compat.getDashShowAppsIcon(this.dash)`, `Compat.getDashBackground(this.dash)`.
    - In `createDash()`: use `Compat.setupDashProxy(dash)`.
    - In `relayout()`: use `Compat.setDashLayoutDirection(this.dash, isRtl)` and `Compat.setDashOrientation(this.dash, vertical)`.
  - In `tests/compat_baseline_check.js`:
    - Add comprehensive unit tests verifying Dash accessors, proxy setup, layout direction, orientation, and overview dash visibility hide/restore without any `__box` expando.
- **Don't:**
  - Do NOT touch `timer.js` or `tests/timer_check.js`.
  - Do NOT edit animator vector math (`animator.js`).
  - Keep `animation-fps`.
  - Golden rule W13 / A14: 0% CPU idle, low CPU animating.
- **Accept:**
  - `gjs -m tests/compat_baseline_check.js` passes all tests.
  - `make check`, `make lint` (0 errors, ≤ 138 warnings), `python3 -B tools/check-settings.py` (exit 0).
  - `gjs -m tests/timer_check.js` (15/15), `gjs -m tests/window_tracker_check.js` (20/20).
  - `make smoke` and `D2DA_SMOKE_STRICT_LEAKS=1 tools/smoke-shell.sh 5` pass with 0 new signatures and all deltas 0.
  - `grep -n '__box' extension.js` returns empty.
- **Verify:**
  - `make check`
  - `make lint`
  - `python3 -B tools/check-settings.py`
  - `gjs -m tests/compat_baseline_check.js`
  - `gjs -m tests/timer_check.js`
  - `gjs -m tests/window_tracker_check.js`
  - `make smoke`
  - `D2DA_SMOKE_STRICT_LEAKS=1 tools/smoke-shell.sh 5`
- **Human:** yes — overview dash hidden when extension enabled, restored when disabled.

#### R-14c — C2/C3 icon parts and activate encapsulation
- **Fixes:** C2, C3.
- **Scope:** `compat.js`; `dock.js`; `tests/compat_baseline_check.js`.
- **Context (HEAD ecf4f95):**
  - In `dock.js`: `_inspectIcon(c)` navigates deep item internal structure across GNOME 45–50: `c.child` (appwell / DashIcon / AppIcon), `appwell.icon` (BaseIcon or old IconGrid), `c.icon.icon`, `_dot`, `label`, `_draggable`.
  - In `dock.js`: per-instance monkeypatch of `c._appwell.activate` (to trigger bounce, call `_maybeMinimizeOrMaximize`, support hovered icon targeting), `c.showLabel` (to respect `hide_labels`), and `_draggable` signal connections.
- **Do:**
  - In `compat.js`:
    - Implement `getIconParts(item)`: returns an object `{ appwell, icon, button, grid, dot, label, draggable }` extracting available parts across GNOME 45–50 without hardcoding deep nested paths in `dock.js`.
    - Implement `wrapAppIconActivate(appwell, onActivate)`: cleanly wraps `activate(button)` with error logging and saves original.
    - Implement `wrapAppIconShowLabel(item, shouldShow)`: wraps `showLabel()` with guard.
  - In `dock.js`:
    - In `_inspectIcon(c)`: replace direct internal tree navigation (`c.icon.icon`, `c.child.icon`, `_dot`, etc.) with `Compat.getIconParts(c)`.
    - In `_findIcons()` loop / icon setup: use `Compat.wrapAppIconActivate(appwell, handler)` and `Compat.wrapAppIconShowLabel(c, shouldShow)`.
  - In `tests/compat_baseline_check.js`:
    - Add tests for `getIconParts(item)`, `wrapAppIconActivate(appwell, handler)`, and `wrapAppIconShowLabel(item, shouldShow)`.
- **Don't:**
  - Do NOT touch `timer.js` or `tests/timer_check.js`.
  - Do NOT edit animator vector math (`animator.js`).
  - Keep `animation-fps`.
  - Golden rule W13 / A14: 0% CPU idle, low CPU animating.
- **Accept:**
  - All unit test checks pass (`compat_baseline_check.js`, `timer_check.js`, `window_tracker_check.js`).
  - `make check`, `make lint` (0 errors, ≤ 137 warnings), `python3 -B tools/check-settings.py` (exit 0).
  - Strict smoke tests pass with 0 new error signatures and all probe deltas 0.
- **Verify:**
  - `make check`
  - `make lint`
  - `python3 -B tools/check-settings.py`
  - `gjs -m tests/compat_baseline_check.js`
  - `gjs -m tests/timer_check.js`
  - `gjs -m tests/window_tracker_check.js`
  - `make smoke`
  - `D2DA_SMOKE_STRICT_LEAKS=1 tools/smoke-shell.sh 5`
- **Human:** yes — clicking running app icons minimizes/maximizes, labels show on hover (unless disabled in prefs), dragging items functions normally.

#### R-16 — Evaluation & Architectural Plan: Dropping Shell Dash.js Dependency
- **Context:**
  - Today, each `Dock` instantiates Shell's `Dash` (`new Dash()`, `dock.js:452`) as an invisible proxy.
  - While this provides app list sync, drag-and-drop, and Shell app item menus for free, it is the **#1 source of GNOME Shell version breakage (C1-C4)** and requires invasive monkeypatching (`_adjustIconSize`, `_createAppItem`, `activate`, `showLabel`, `_box`, `_dashContainer`, `_showAppsIcon`, `_background`).
  - By replacing `new Dash()` with a standalone `DockModel` + `DockItem` structure fed by GNOME Shell's stable public APIs (`AppFavorites`, `Shell.AppSystem`, `Shell.WindowTracker`), Dash2Dock Animated achieves true GNOME update imperviousness (Goal G3).
- **Core Investigation & Findings:**
  1. **What `Dash.js` actually provides today:**
     - Favorites order & running apps list (`AppFavorites.getAppFavorites()`, `Shell.AppSystem.get_default().get_running()`).
     - App launch / window focus via `AppIcon`.
     - App context menus (`AppIconMenu`).
     - Show Apps icon (`ShowAppsIcon` triggering `Main.overview.showApps()`).
     - Shell drag-and-drop (`DND.LauncherDraggable` for reordering favorites and dropping app icons to desktop/dock).
     - Separator actor between favorites and running apps.
  2. **Couplings eliminated by dropping `Dash.js`:**
     - `C1`: instantiation, `_box`, `_background`, `_dashContainer`, and monkeypatched `_adjustIconSize`, `_createAppItem`.
     - `C2`: deep tree traversal across versions (`child.icon.icon`, `_iconBin.child`, `_dot`, `label`, `_draggable`).
     - `C3`: per-instance monkeypatch of `c._appwell.activate` and `c.showLabel`.
     - `C4`: overview dash manipulation and expando hacks.
     - `B-1 / B-40`: complex lifecycle leak paths caused by orphaned Shell Dash internal signal listeners on `AppSystem`/`AppFavorites`.
  3. **Proposed Replacement Architecture (`DockModel`):**
     - **Data Layer (`DockModel`)**:
       - Listens to `AppFavorites.getAppFavorites().connectObject('changed', ...)` for favorites order.
       - Listens to `Shell.AppSystem.get_default().connectObject('app-state-changed', ...)` and `Shell.WindowTracker.get_default()` for running state and window counts.
       - Emits clean, typed signals: `items-changed`, `item-added`, `item-removed`.
     - **View/Actor Layer (`DockContainer` / `DockItemContainer`)**:
       - Replaces `this.dash` with a lightweight, native `St.BoxLayout` (`this._box`).
       - Extra items (trash, mounts, downloads, clock, calendar) and app items live as uniform children of `this._box`.
       - Direct, clean `button-press-event` / `clicked` handling on items without monkeypatching upstream `AppIcon.activate`.
     - **Context Menus & Show Apps**:
       - Retain or adapt `PopupMenu` for app menus (instantiating `AppIconMenu` directly or using `Shell.App` window list actions).
       - Direct `ShowAppsIcon` button calling `Compat.showOverviewApps(Main.overview)`.
     - **Drag & Drop**:
       - Reordering favorites directly calls `AppFavorites.getAppFavorites().moveFavoriteToPos(appId, newIndex)`.
       - Standard Clutter / Shell DND integration isolated to a dedicated helper.
- **Migration Path:**
  - **Phase 4.5a (Prototype/Gated)**: Implement `dockModel.js` and allow toggling between legacy `DashProxy` and new `DockModel` via experimental settings or feature flag.
  - **Phase 4.5b (Cutover)**: Make `DockModel` the default; verify `tests/compat_baseline_check.js`, `make smoke`, and leak-free toggles.
  - **Phase 4.5c (Cleanup)**: Purge legacy Dash proxy setup, stubbed icon adjusters, and obsolete Dash accessors.

### Phase 5 — Elegance (stubs)
- **R-17** settings reactions as data. **R-18** `ColorShaderEffect` base, prune utils/easing/vector/timer. **R-19** `dockItemMenu.js` → `dockItemList.js`, rendering out of `services.js`. **R-20** `keys.js` defaults from schema; dead keys *(schema removal needs human OK)*. **R-21** delete obsolete files, legacy UI, g44 tooling, README update.
