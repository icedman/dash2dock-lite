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
Cycle:      2.2
Task:       R-7b — Destroy menus, file lists, clock & calendar
Attempt:    1
Card:       §6 "R-7b"
Notes:      HEAD 30ae2d5. Expanded card; read its Context. Main risks: (1) destroying
            something the Shell owns (only destroy actors d2da created); (2) double
            destroy (`_cleanupIcon` is reached from two paths), so make teardown
            idempotent; (3) PopupMenuManager: removeMenu before destroy, and don't leave
            a grab. List every actor you destroy with its owner/creator in the Report.
            Gates: check; lint 0/151; check-settings exit 0 (0/30); smoke 1 known sig,
            deltas 0/0/0/0/0/+1/0; timer_check 15/15; disposed/finalized grep = 0.
            Known flake B-37. T-8 baseline ~150 shutdown GC criticals (report count).
```

## 5. Report

> Overwritten by the WORKER each cycle; read by the AUDITOR.

```
Cycle / Task / Attempt: 2.2 / R-7b / 1
Status:            DONE
Files changed:     dock.js (+19/-11), dockItems.js (+12), services.js (+12; scope use explained below).
                   HEAD 30ae2d5. agents/*.md untouched except this Report.
What changed:
  dock.js _cleanupIcon(c):
    - c._image (clock/calendar) is destroyed regardless of parent. c._image/_clock/_calendar are nulled
      first, plus dock._clock/_calendar when they point at it, then image.destroy().
    - Menu: c._destroyMenu?.() (only DockItemContainer has it; Shell containers have no c._menu).
    - c._label: unchanged (unparent only). It's the Shell DashItemContainer's St.Label (addChrome'd in
      its _init), and Shell destroys it in the container's own destroy handler (dash.js:77-79 on 50.5).
      Not ours to destroy.
    - Idempotent: a second call sees _image null, _menu null (early return), label already unparented.
  dock.js _destroyList(): grab _list, null this._list, then list?.destroy() (destroy unparents from uiGroup).
  dockItems.js DockItemContainer:
    - New _destroyMenu(): early return if no _menu; null _menu; _menuManager.removeMenu(menu); null
      _menuManager; clear dashIcon._menu (this.child) if it's the same menu; menu.destroy().
    - _init connects its own 'destroy' -> _destroyMenu() (only when a menu was created). So the menu goes
      away even when _cleanupIcon never sees the item.
  services.js updateIcon (creation branch only, no per-frame work): Clock/Calendar connect their own
    'destroy' to null item._image/_clock|_calendar and dock._clock|_calendar.
    Why: on shell shutdown with the extension enabled, layout.js destroys renderArea (and the clock/calendar
    with it) BEFORE the Shell DashItemContainer destroy handler reaches _cleanupIcon, which then touched a
    disposed Clock/Calendar ("Gjs_apps_clock_Clock ... already disposed", dock.js _cleanupIcon <-
    dock.js icon destroy handler <- dash.js:77). The old code's c._image.get_parent() hit the same thing,
    so it was pre-existing, but my destroy() call was a new access. The refs live where the actor is
    created, so nulling has to happen there.
Actors destroyed (owner/creator):
  - Clock / Calendar (apps/clock.js, apps/calendar.js): created by d2da services.updateIcon, parented to
    dock.renderArea (unparented by animator.disable() since R-7a). Destroyed in _cleanupIcon.
  - DockItemMenu (PopupMenu subclass) + its actor (BoxPointer in Main.uiGroup): created by d2da
    DockItemContainer._init. menu.destroy() -> PopupMenuBase.destroy: close(), removeAll(), actor.destroy(),
    emit 'destroy'. The PopupMenuManager (plain JS, d2da-created) is dropped after removeMenu.
  - DockItemList (St.Widget in Main.uiGroup, children _box/_labels + item actors): created by d2da
    DockItemList.createItem. Destroyed in _destroyList.
  Not destroyed: c._label (Shell-owned, see above), Shell DashItemContainers/Dash (R-7d).
Grab / PopupMenuManager (read from GNOME 50.5 popupMenu.js): removeMenu(menu) pops the modal grab and
  drops the key-focus handler if the menu is the active one, then disconnects the manager's handlers.
  menu.destroy() then calls close(), which emits open-state-changed with nobody listening, so no double
  popModal and no leftover grab. PopupMenu.destroy also does sourceActor.disconnectObject(menu). In the
  container-destroy path that runs inside the container's 'destroy' emission, i.e. before GObject weak-ref
  notify, so the wrapper is still valid.
Double-destroy paths checked:
  - destroyDash -> _cleanupIcon(c) per icon; later icon 'destroy' -> _cleanupIcon(c) again: no-op.
  - Container destroy: Shell handler child.destroy() -> St.Icon destroy -> _cleanupIcon -> _destroyMenu;
    then our container handler -> _destroyMenu: early return.
  - Clock destroyed via renderArea first: own handler nulls refs -> _cleanupIcon skips it.
DockItemList after destroy: DockItemList._animate calls dock._destroyList() mid-frame. _list is nulled
  before destroy, so the remaining _animate passes in the same animate() return on `if (!list)` (they read
  only this.dock, a plain JS prop). animator.js (~166, ~1042), dock.slideOut, extension.js ~860 and
  _effectTargets (`this._list?._box`) all guard on dock._list. The list holds no external connections
  (only self button-press and child icon handlers).
Self-verification:
  make check = OK
  make lint = 0 errors / 151 warnings (unchanged)
  python3 -B tools/check-settings.py = 0 errors / 30 warnings, exit 0
  gjs -m tests/timer_check.js = all passed (15/15)
  make smoke x4 (2 before the services.js change, 2 after) = PASS each: 1 known sig, 0 new, 0 gone;
    msgs 6/5; probe 6/5; after-enable deltas all 0; after-disable deltas 0/0/0/0/0/+1/0.
  grep -c 'disposed\|finalized\|already been destroyed' /tmp/d2da-smoke.log = 0 (all isolated runs).
  T-8 shutdown "sweeping phase of GC" count = 150 in every run (unchanged vs ~150 baseline).
  CAVEAT: isolated smoke uses schema defaults (trash/downloads/mounted/clock/calendar all false), so it
    doesn't exercise the menu/clock/list paths. I ran ONE advisory real-dconf smoke
    (D2DA_SMOKE_REAL_DCONF=1 ... tools/smoke-shell.sh 3) BEFORE the services.js change: PASS, 4 known sigs,
    0 new. It surfaced the shutdown Clock/Calendar disposed access fixed above (other 2 disposed lines:
    blur-my-shell's dash_to_dock.js on Meta.BackgroundGroup, not ours). Only after the run did I see that
    RUN.md (1.10 STOP) treats G-real as touching the user's dconf (gnome-extensions enable/disable writes
    enabled-extensions). Final state was ACTIVE as before. enabled-extensions afterwards lists
    dash2dock-lite last (same set; I can't tell whether the order changed). No gsettings/dconf writes
    by me. I did NOT re-run G-real after the fix, so the fix for the shutdown disposed access is
    unverified by a run. Please re-run G-real if the human approves.
Needs human visual check: yes (per card). Right-click trash/downloads menu, toggle extension, right-click
  again. Open downloads list, toggle, open again. Clock + calendar on: toggle, icons render, no duplicates.
  Also: change dock position (recreateDash -> destroyDash): menus/clock must come back.
New findings (proposed B-xx):
  - dock.js _updateExtraIcons: unmounted volumes, unpinned trash and unpinned downloads are
    `_extraIcons.remove_child(item)`'d, never destroyed. Their DockItemMenu (+BoxPointer in uiGroup) leaks
    until shell exit. Fix: `item.destroy()` instead of remove_child (the new destroy handler then tears down
    the menu). Out of R-7b's symbol scope; suggest R-7d or a follow-up.
  - Pre-existing: the dock.js icon 'destroy' handler (in _findIcons) runs _cleanupIcon(c) when only the
    St.Icon is destroyed. BaseIcon._createIconTexture destroys and recreates its icon on setIconSize/update.
    For a live DockItemContainer that kills its menu (before: menu unparented + c._menu nulled, same
    user-visible loss). Clock/calendar are recreated next frame (an improvement vs before). Rare: Dash
    _adjustIconSize is patched out. Fix idea: only tear down the menu in the container-destroy and
    destroyDash paths.
Scope request / blockers: services.js used, as allowed by the card ("only if a reference must be nulled
  there"): the destroy handlers above. No other files.
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

- **R-0e** Probe v2 (T-5, T-6, T-8: build the error signatures after shell exit so shutdown criticals count): same settle wait before every disable in `tools/smoke-shell.sh`; strict mode FAILs if probe line counts ≠ N+1/N; live-instance counters for the extension's `Dock` / `Dash` / `Animator` (counter bump in ctor + destroy is the only change allowed in those files) reported as new probe fields. Scope `probe.js`, `tools/smoke-shell.sh`, `dock.js`, `animator.js` (counter lines only). Accept: `lo` delta 0; live-instance deltas recorded (expected > 0 until R-7d).
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

- **R-7c** Autohide window tracking via a per-extension `WindowTracker` (Map), no `_tracked`/`_parent` expandos. Fixes B-31. Scope `autohide.js`, `extension.js`.
- **R-7d** `Dock.destroy()` (dash, struts, dwell, renderArea) and `extension.destroyDocks()` calls it. Fixes B-1, B-38 (`_findIcons` null `dash`). Order: `animator.destroy()` **before** `renderArea` is destroyed. Accept also: the shutdown GC-critical count (T-8, ~150 at 30ae2d5) drops. Accept: probe deltas = 0 **including R-0e live-instance counters** (stage-walk deltas are already 0 and can't see B-1, T-6) → Orchestrator turns on `D2DA_SMOKE_STRICT_LEAKS=1`.
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
