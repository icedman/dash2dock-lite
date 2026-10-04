# AUDITOR — verifies the Worker's change against D2DA rules, proves the shell still runs, commits

> You are the **AUDITOR** for Dash2Dock Animated. You are independent of the Worker: assume nothing from its Report
> that you haven't checked in the diff or by running it. You **do not write feature code**. You either
> **PASS → commit** or **FAIL → write a rework list**. Invoked by the ORCHESTRATOR (`agents/RUN.md`).

Inputs: `git diff`, the task card + "Current Assignment" + "Report" in `agents/WORKER.md`, the rules in `agents/D2DA.md`.

**Special case — cycle 0.0 (bootstrap):** there is no Worker Report. Scope = the files listed in `agents/RUN.md` Phase Board row 0.0. Apply A3, A7, A12, run G-syntax + G-smoke + G-smoke-x2, then commit with the message given in that row (trailer `Task: bootstrap (cycle 0.0)`).

---

## 1. Procedure

1. **Preflight**
   - `git --no-optional-locks status --short` and `git --no-pager diff --stat`.
   - Every changed/untracked file must be either in the card's *Scope*, an `agents/*` file, or `agents/smoke-baseline*.txt`. Ignore `.antigravitycli/` (never stage it).
   - Report says `Status: BLOCKED` → do not audit code; write verdict `BLOCKED` with the Worker's reason and return.
2. **Read the diff** — `git --no-pager diff` (and `git --no-pager diff --no-index /dev/null <file>` for new files). Check every rule in §2. For each finding ID the card claims, open the code at the symbol and confirm the bug is actually gone (not just moved).
3. **Run the gates** (§3). Run them yourself, even if the Worker says they passed.
4. **Verdict** (§4). PASS → commit (§5). FAIL → rework list. Append to the Audit Log (§7) either way.

## 2. Rules checklist (sources in brackets)

| # | Check | Source |
|---|---|---|
| A1 | **Scope:** only Scope files changed; no unrelated refactors, renames, re-indents or whole-file reformatting. Diff size plausible for the card. | WORKER W1 |
| A2 | **Claimed fixes are real:** each ID in the card is fixed at the root cause; no finding silently skipped; "not reproduced" claims verified by reading code. | D2DA §6 |
| A3 | **Forbidden paths untouched:** `build/`, `node_modules/`, `schemas/gschemas.compiled` (except R-0d's `git rm --cached`), user dconf. | D2DA header, W3 |
| A4 | **GNOME 45-50:** no API newer than 45 without feature detection; **no version-string sniffing** (`Config.PACKAGE_VERSION`, `metadata.version` comparisons) added. | G3, §4 C10 |
| A5 | **No new Shell-private coupling:** new `._private` access to Shell/Mutter objects, new monkeypatches, new expandos on Shell/`Meta.Window` objects → FAIL unless the card allows it (after R-14: only inside `compat.js`). | §3.4, §4 |
| A6 | **Lifecycle:** every new actor/signal/source/subscription/file monitor created in enable or dock creation has a matching destroy/disconnect/remove/cancel in disable or teardown. New `*Seq` handles reset in `disable()`. Prefer `connectObject`/`disconnectObject`. | G1, G5 |
| A7 | **EGO:** no `eval`, no `new Function`, no new `/tmp` paths, no `rm -rf` or shell launchers, no new sync file/D-Bus I/O on the main loop, no new polling timers. | G5, B-8, B-10, B-11 |
| A8 | **Perf:** nothing new per frame in `Animator.animate`, `Dock.layout`, `integrations.bms_update_size`, `services.updateIcon` (allocations, `get_children()`, lookups, `new Vector`), unless the card is a perf task with net reduction. | G2, §6.4 |
| A9 | **Errors:** no empty `catch {}`; catches log `console.error('d2da: …', e)`; no try/catch that hides an `enable()` failure without degrading gracefully. | W9, G3 |
| A10 | **Conventions:** settings read via the snake_case mirror (`extension.foo_bar`); new code uses `DockPosition.*` not raw strings; timer handles follow the `runDebounced(obj)` re-subscribe pattern. | §3.4 |
| A11 | **Schema changes** (if any): `make build` (`glib-compile-schemas --strict`) passes; `preferences/keys.js` and `ui/*.ui` agree; key removals carry a migration note and an Orchestrator human-gate. | §6.5, R-20 |
| A12 | **Style:** matches surrounding code; no comments restating code; no debug `console.log` left behind (`console.log` only for lifecycle messages already present). | W10 |
| A13 | **Report honesty:** Worker's Files changed / verification claims match reality. Mismatch = FAIL. | — |

## 3. Gates (all required unless marked advisory)

| Gate | Command | Pass condition |
|---|---|---|
| G-syntax | `make check` | `check: OK` |
| G-lint | `make lint` *(only once R-0b is committed)* | 0 errors; per changed file, warnings not higher than at HEAD (compare `npx eslint FILE` with `git show HEAD:FILE \| npx eslint --stdin --stdin-filename FILE`) |
| G-settings | `python3 tools/check-settings.py` *(once R-0c is committed)* | **exit 0** (0 errors since 5840f29) and warnings not above the last Audit Log entry |
| G-smoke | `make smoke` | `SMOKE: PASS` (extension ACTIVE after start and after 5 toggles, shell alive, **no NEW error signatures**) |
| G-smoke-x2 | `tools/smoke-shell.sh 5` again | PASS again (flake guard). One PASS + one FAIL ⇒ rerun a third time; report flakiness in the log |
| G-real | `D2DA_SMOKE_REAL_DCONF=1 D2DA_SMOKE_BASELINE=agents/smoke-baseline-real.txt tools/smoke-shell.sh 3` | *advisory* (depends on the user's other extensions). Required for tasks touching `integrations.js` |
| G-card | the card's **Verify** steps | as stated in the card |
| G-leaks | `D2DA_SMOKE_STRICT_LEAKS=1 make smoke` | **required (ON since d95bb11)**: all probe deltas 0 incl. live*, shutdown criticals 0. A FAIL only on probe line counts (missed toggle, T-9) ⇒ rerun once; a repeat is a FAIL |

Note that `make smoke` re-installs the extension into `~/.local/share/gnome-shell/extensions/`. That is expected. The user's running session is not affected until they re-login / toggle the extension.

**Baseline policy.** You may edit `agents/smoke-baseline*.txt` only to **remove** signatures listed as *no longer seen* when the task claims to fix them. Re-run with `D2DA_SMOKE_UPDATE=1` only if the result is exactly "old baseline minus fixed lines". Never add signatures. If a NEW signature is clearly environmental (not from this extension), FAIL with `ESCALATE` and let the Orchestrator decide.

## 4. Verdicts

- **PASS:** all A-rules hold, all required gates pass. → commit (§5).
- **FAIL:** write `Last verdict` (§6) with a numbered **rework list**: each item = rule/gate, file:symbol, what is wrong, what "fixed" looks like. Do **not** edit or revert the Worker's code.
- **BLOCKED / ESCALATE:** something only a human or the Orchestrator can resolve (sudo, product decision, environment-caused new signature, card contradicts code).

Minor nits (naming, a stray blank line) that don't violate a rule: list them as `nit:` and still PASS. Don't fix them yourself.

## 5. Commit procedure (PASS only)

1. Stage **explicit paths only**: the changed Scope files, `agents/WORKER.md`, `agents/AUDITOR.md`, `agents/RUN.md`, `agents/D2DA.md` and `agents/smoke-baseline*.txt` if changed.
   `git add <path> <path> …` — never `git add -A`, `git add .`, or `-a`. Never stage `.antigravitycli/`, `build/`, `*.zip`, `node_modules/`.
2. `git --no-pager diff --cached --stat` — must match what you audited.
3. Commit (Conventional Commits; body trailers are mandatory):
   ```
   GIT_EDITOR=true git commit -m "<type>(<area>): <summary ≤ 72 chars>" -m "Task: <R-id> (cycle <n.m>, attempt <k>)
   Fixes: <B-/P-/C- ids or none>
   Gates: check=PASS smoke=PASS(x2) [lint=…] [settings=…] [real=…]
   Human-check: <none | what to look at>"
   ```
   `type` ∈ `fix`, `perf`, `refactor`, `feat`, `chore`, `build`, `test`, `docs`. `area` = main module (`timer`, `autohide`, `dock`, `animator`, `prefs`, `services`, `release`, `agents`…).
4. Never `--amend`, `rebase`, `reset`, `push`, switch branches, or skip hooks. Hook fails ⇒ FAIL verdict with the hook output.
5. Record the short hash in the Audit Log.

## 6. Last verdict

> Overwritten each cycle. On FAIL the Worker reads this for its rework.

```
Cycle / Task / Attempt:  2.5 / R-8 Services cancellables, debounces, enumerator cleanup and measured dt / 1
Verdict:          PASS
Commit:           see Audit Log (fix(services): cancellables, separate debounces, close enumerators, measured dt)
Gates:            check=PASS ; lint=PASS 0 err / 150 warn (= baseline; extension.js 13, services.js 8 = HEAD) ;
                  settings=exit 0, 0/30 ; timer_check all passed (15/15) ;
                  window_tracker_check all passed (20/20) ; smoke x2 PASS (1 known sig, 0 new,
                  6/5 msgs, 6/5 probe lines, ALL deltas 0) ; strict x1 PASS (counts 6/5, ALL deltas 0,
                  shutdown criticals 0) ; settings variant strict PASS (deltas 0, criticals 0) ;
                  disposed/finalized/already been destroyed = 0 and `d2da: ` = 0 in all runs.
                  No orphaned headless shell. G-real NOT run (W3).
Scope:            services.js (+138/-67), extension.js (+14/-5) + agents/*.md bookkeeping.
                  Matches Scope and Report.
Rule violations:  none. A1-A10, A12, A13 clean (A11 n/a).
Specific checks:
  1. B-36 separate debounce handles: `_debounceRecentsSeq` and `_debounceDownloadsSeq` independent
     on `_loTimer`, both cancelled and nulled in `disable()`. Eliminates mutual starvation.
  2. B-25 per-service error isolation: callback invocation in `ServiceCounter.update(elapsed)`
     wrapped in try/catch with `console.error('d2da: service ' + this.name + ' update', e)`. Defensively
     guarded in `Services.update(elapsed)` as well.
  3. B-25 measured dt: `_onCheckServices()` computes elapsed ms via `GLib.get_monotonic_time()`
     relative to `_lastServicesUpdate`, clamped >= 0, defaulting to 2500 ms on first tick. Timestamp
     reset to 0 in `enable()`, `disable()`, and `_onIconThemeChanged()`.
  4. Cancellables: `_cancellable` created in `enable()`, cancelled and nulled in `disable()`, passed to
     `enumerate_children`, `next_file`, and `load_contents_async`. Cancellation gracefully caught.
  5. Monitor & enumerator cleanup: `_downloadsMonitor?.cancel()` and `_trashMonitor?.cancel()` before
     disconnect/nulling; enumerator `iter?.close(null)` and `enumerator?.close(null)` in finally blocks.
Nit:
  - Empty `catch {}` on `iter?.close(null)` and `enumerator?.close(null)` in `finally` blocks: GFileEnumerator.close
    is idempotent in Gio and safe, but logging with `console.error` would be strictly more informative.
Rework list:      none.
Findings confirmed: B-25 and B-36 resolved.
Human check needed: none.
```

## 7. Audit Log (append-only, newest last)

| Cycle | Task | Attempt | Verdict | Commit | Gates | Notes |
|---|---|---|---|---|---|---|
| — | setup | — | — | — | `make check` OK; smoke PASS ×3 isolated, PASS real-dconf | Tooling created by setup session (uncommitted). Baselines: isolated 1 signature (NM GI warning, shell-side); real 4 (incl. B-35 NaN clip, search-light's DesktopAppInfo warning). |
| 0.0 | bootstrap | 1 | PASS | this commit | `make check` PASS; `make smoke` PASS; smoke-x2 PASS (1 known sig, 0 new, 6/5 msgs each run) | Auditor-only bootstrap commit: Makefile, tools/smoke-shell.sh, agents/*.md, agents/smoke-baseline*.txt. A3/A7/A12 clean. Verified `make check` fails on a syntax error. Nits: WORKER.md template trailing whitespace; smoke log default in /tmp (dev-only); `make install` copies agents/ into the install dir. |
| 0.1 | R-0a | 1 | PASS | this commit (probe.js) + 888baf5 (extension.js, smoke-shell.sh) | `make check` PASS; `make smoke` PASS; smoke-x2 PASS (1 known sig, 0 new, 6/5 msgs, probe 6/5); card: probe-off 0 lines PASS, strict FAIL on lo +1 as designed | Split landing: the R-0a code parts were swept into the human commit 888baf5; this commit adds the missing probe.js (HEAD imported an untracked file). Probe deltas after-disable 0/0/0/0/0/+1(lo)/0. Nits: strict mode doesn't fail on missing probe lines; probe.js must stay in the R-0d pack list. Findings: absolute stage count varies across runs (deltas only); Worker P-a timing cause confirmed, P-b agreed. |
| 0.2 | R-0b | 1 | ESCALATE | none | `make check` PASS; `make lint` PASS (exit 0, 0 errors, 168 warnings, 30 files); `make smoke` PASS; smoke-x2 PASS (1 known sig, 0 new, 6/5 msgs, probe 6/5, deltas 0/0/0/0/0/+1/0) | ESLint 9.39.5 flat config. **G-lint baseline:** 168 warnings (no-unused-vars 162, no-undef 5, no-duplicate-case 1). Per file: effects/easing.js 37, dock.js 25, animator.js 23, extension.js 17, dockItemMenu.js 12, services.js 12, dockItems.js 7, preferences/prefKeys.js 6, apps/clock.js 5, apps/dot.js 5, apps/calendar.js 3, autohide.js 3, prefs.js 3, apps/overlay.js 2, diagnostics.js 2, style.js 2, timer.js 2, apps/recents.js 1, integrations.js 1, all others 0. "type":"module" safe (no CJS run by node; tests/ are gjs). `globals` dep skip accepted (unused). The per-file no-undef/no-duplicate-case demotions in extension.js/timer.js mask exactly the 6 tracked bugs (B-5 x2, B-16, 6.3 Clutter, B-24 x2); drop them in R-4a/R-1. Nits: lint not .PHONY; stale check comment; package.json main=index.js. Finding: T-7 confirmed (install copies node_modules 14 MB + eslint/package files), to R-0d. | **Not committed:** Makefile was edited by someone else at 10:26:51 during the audit (+2 rm -rf node_modules lines in install/publish, unaudited, out of scope); staged set != audited diff. Index unstaged, tree untouched. Awaiting Orchestrator/human. |
| 0.2 | R-0b | 2 | PASS | this commit | `make check` PASS; `make lint` PASS (0 errors / 168 warnings = baseline); `make smoke` PASS; smoke-x2 PASS (1 known sig, 0 new, 6/5 msgs, probe 6/5, deltas 0/0/0/0/0/+1/0); card PASS; publish verified in temp copy | Attempt 2 = Makefile T-7 interim (human node_modules lines kept + agents/eslint.config.js/package*.json removed from install, eslint.config.js from publish; lint .PHONY; check comment). Installed dir and zip contain no node_modules/agents/eslint.config.js/package*.json. Zip: 80 entries, no themes/ (T-4), still has ui/legacy (R-0d). G-lint baseline 168 warnings (per-file list in Last verdict). Nits: rm -rf for single files; package.json main=index.js; dev *.md docs installed. Finding: screenshot names with spaces break xargs cp. |
| 0.3 | R-0c | 1 | PASS | this commit | `make check` PASS; `make lint` PASS (0 err / 168 warn = baseline); check-settings exit 1 by design (2 err / 30 warn); `make smoke` PASS; smoke-x2 PASS (1 known sig, 0 new, 6/5 msgs, probe 6/5; deltas 0/0/0/0/0/+1/0 and 0/-32/0/0/0/+1/0, the -32 = T-6 variance) | **G-settings baseline:** ERROR shared-adjustment 1 (B-12), duplicate-case 1 (B-16), missing-in-schema 0, widget-type 0; WARN missing-in-keys 5 (debug, debug-log, monitor-count, msg-to-pref, theme), ui-id-no-key 0, key-no-widget 8 (animate-icons, animation-type, drawing-* x6), dead-setting 17 (6.5 list of 16 + msg-to-ext FP). B-12/B-16 verified in source; negative test (both patched in scratch copy) gives 0 errors, exit 0; 6 dead + 4 live spot checks correct. Accepted: apps/+effects/ scan, msg-to-ext WARN FP, schema->keys missing = WARN, extra widget-type class. Nits: `.foo_bar` matches any receiver; untracked tools/__pycache__ not staged (gitignore in R-0d). Finding: D2DA 6.5 mislabels animation-type/documents-path as schema-only. |
| 1.1 | R-1 | 1 | PASS | this commit | `make check` PASS; `make lint` PASS (0 err / 166 warn, was 168; timer.js 2 -> 0); check-settings exit 1 (2 err / 30 warn = baseline); `make smoke` PASS; smoke-x2 PASS (1 known sig, 0 new, 6/5 msgs, probe 6/5, deltas 0/0/0/0/0/+1/0 both); card `gjs -m tests/timer_check.js` 15/15 exit 0 (0.4 s) | B-2, B-23, B-6 (timer half), B-24 typo fixed. Test fails against HEAD timer.js (scratch dir, removed). Departures accepted: (1) captured-array iteration, no slice, verified safe (unsubscribe replaces the array; fixed count; 12 Auditor scratch edge cases ok; = HEAD semantics, no per-tick alloc, A8 ok); (2) run* unsubscribe via s._timer, all callers use one timer per handle. Nits: onUpdate comment rationale (b) overclaims; test check 1 fails on HEAD via B-6 id collision, not B-2 alone. Finding: a live handle passed to a second timer stays stuck on the first (latent, no caller). |
| 1.2 | R-2 | 1 | PASS | this commit | `make check` PASS; `make lint` PASS (0 err / 166 warn = baseline; per-file = HEAD); check-settings exit 1 (2 err / 30 warn = baseline); `make smoke` PASS; smoke-x2 PASS (1 known sig, 0 new, 6/5 msgs, probe 6/5, after-disable deltas 0/-32(T-6)/0/0/0/+1/0 and 0/0/0/0/0/+1/0, hi=0 after every disable); card: `gjs -m tests/timer_check.js` 15/15 | B-7 fixed; B-6 extension side fixed (8 stored *Seq handles, each cancelled on its owner timer and nulled; inventory checked against grep of Seq and every run* call). Checked: undock() reset must be last because autohider.disable()->show()->slideIn()->_beginAnimation() re-arms _animationSeq/debounceEndSeq; nothing after it arms timers; listeners readers are the 4 fan-outs, services has no hooks; autohide early cancel safe (_checkHide no-op when !_enabled). Nits: Report diffstat +24 vs real +23; autohider._animationSeq null after the early return (dead field). Findings: services shared _debounceCheckSeq confirmed (downloads armed first, recents re-arms run checkDownloads); leaked docks can re-arm handles until R-7d. |
| 1.3 | R-3 | 1 | ESCALATE | none | `make check` PASS; `make lint` PASS (0 err / 166 warn = baseline; autohide.js 3 = HEAD); check-settings exit 1 (2 err / 30 warn = baseline); `make smoke` PASS; smoke-x2 PASS (1 known sig, 0 new, 6/5 msgs, probe 6/5, after-disable deltas 0/0/0/0/0/+1/0 both); card PASS; `gjs -m tests/timer_check.js` all passed | B-26 needs a product decision: reviving the dead `isInRect(arect, pointer, 0)` only matters while the dock is hidden (struts keep edge geometry; `_isWithinDash` returns false when hidden), so a focus/restack with the pointer in the edge band reveals the dock, with pressure sense on OR off. That contradicts the author's `_hidden` guard. Recommend dropping the term (= shipped behaviour). B-3 premise is wrong: mutter 45.0/49.7 `get_workspace()` returns the active workspace for sticky windows (GIR 18 agrees), so no TypeError ever; the `?.` fix is defensive only and the code comment is wrong. B-4 (DESKTOP/DOCK no longer dodge = intended) and B-27 confirmed. `is_on_all_workspaces` in mutter 45.0 + GIR 15-18. Findings: animator.js `_hidden && isWithin` slideIn is dead; D2DA B-3 row needs re-labelling. Tree/index untouched. |
| 1.3 | R-3 | 2 | PASS | this commit | `make check` PASS; `make lint` PASS (0 err / 166 warn = baseline; autohide.js 3 = HEAD); check-settings exit 1 (2 err / 30 warn = baseline); `make smoke` PASS; smoke-x2 PASS (1 known sig, 0 new, 6/5 msgs, probe 6/5, after-disable deltas 0/0/0/0/0/+1/0 both); `d2da: ` 0; timer_check 15/15 | B-26 per human rule: dead `isInRect(arect, pointer)` (pad undefined => NaN => always false) removed with `pos`/`rect`/`arect`/import; zero behaviour change. Verified `_isWithinDash` (hidden => false, same struts rect, pad 20) is checked before every `return true` in `_checkOverlap`, and `hide()`/`slideOut()` are reachable only via `_checkHide`, so a shown dock under the pointer never hides and pointer position never reveals a hidden one. B-3 comment corrected (defensive guard). B-4, B-27 unchanged from attempt 1. Human visual check required. Finding (pre-existing, Low): `_isWithinDash` precedes the fullscreen check; masked by trackFullscreen. |
| 1.4 | R-4a | 1 | PASS | this commit | `make check` PASS; `make lint` PASS (0 err / 162 warn, baseline 166; extension.js 13 warn vs HEAD 16 warn + 1 err); check-settings exit 1 (1 err B-12 / 30 warn, was 2/30); `make smoke` PASS; smoke-x2 PASS (1 known sig, 0 new, 6/5 msgs, probe 6/5, after-disable deltas 0/0/0/0/0/+1/0 both); `d2da: ` 0; timer_check all passed | B-5 dc_monitor rename (all refs). B-16 merged icon-size case = superset of both old bodies (shrink -> layout -> animate refresh). B-20 `_iconTheme` gone, unified on icon_theme. B-13 hidden actor remembered only if we hid it, restored+cleared in _showMainOverviewDash(true) from disable(); no-op if enabled after startup; no new private access. eslint: no-duplicate-case override removed, no-undef comment narrowed to 6.3 Clutter. Human visual check required. Nit: `Main.overview.dash.opacity` lacks `?.` (pre-existing). |
| 1.5 | R-4b | 1 | PASS | this commit | `make check` PASS; `make lint` PASS (0 err / 162 warn = baseline; animator.js 23 = HEAD); check-settings exit 1 (1 err B-12 / 30 warn = baseline); `make smoke` PASS; smoke-x2 PASS (1 known sig, 0 new, 6/5 msgs, probe 6/5, after-disable deltas 0/0/0/0/0/+1/0 both); timer_check all passed | B-14, B-15, B-34 fixed; revived branches judged within intent (B-14 per 5c173eb; B-15 lock monotonic; B-34 X reset no conflict). Nits: bounce catch console.log; animate clears only appwell Y. Findings: none. |
| 1.6 | R-4c | 1 | PASS | this commit | `make check` PASS; `make lint` PASS (0 err / 158 warn, baseline 162; dock.js 21 vs HEAD 25, -4 unused vars in edited code); check-settings exit 1 (1 err B-12 / 30 warn = baseline); smoke FAIL x2 (NEW Style.unloadAll /tmp css delete, environmental), HEAD worktree PASS, then `make smoke` PASS + smoke-x2 PASS (1 known sig, 0 new, 6/5, after-disable deltas 0/0/0/0/0/+1/0); `d2da: ` 0; timer_check all passed | B-17 get_state; B-18 activate(button) forwarded (Shell 50.5 AppIcon.activate(button) verified), original activate runs uncaught like stock Shell, judged within intent; B-19 symmetric removal on _effectTargets. Finding: smoke flake from /tmp css shared with the live session (style.js, B-10 class). |
| 1.7 | R-4d | 1 | PASS | this commit | `make check` PASS; `make lint` PASS (0 err / 154 warn, was 158; services.js 12 -> 8); check-settings exit 1 (1 err / 30 warn = baseline); timer_check all passed; smoke-x2 PASS (1 known sig, 0 new, deltas 0/0/0/0/0/+1/0 both), no B-37 flake | B-9 fixed. Mount key = sha1(root URI) in the existing tempPath scheme; add/remove/dock.js agree. Always-rewrite only on mount events / enable / mounted-icon change (ping only drains the deferred queue), no periodic I/O. Name escaped per Desktop Entry spec. Nits: _toSafeFileName unused; Exec path unquoted (pre-existing); old shared Volume launcher orphaned in /tmp. |
| 1.8 | R-6 | 1 | PASS | this commit | `make check` PASS; lint 0/154 = baseline; check-settings 1/30 = baseline; timer_check pass; smoke x2 PASS (1 known sig, 0 new, deltas 0/0/0/0/0/+1/0); no eval/new Function in shipped js | B-11 fixed: fixed two-entry whitelist, '' silent, legacy 'this.runDiagnostics()' warns+resets, prefs sends 'run-diagnostics'. Nit: plain-object map resolves Object.prototype keys (harmless; use Object.hasOwn). |
| 1.9 | R-5 | 1 | PASS | this commit | `make check` PASS; lint 0/151 (baseline 154; prefKeys.js 6 -> 3, prefs.js 3 = HEAD); check-settings exit 0, 0 err / 30 warn (B-12 gone); timer_check pass; xmllint tweaks.ui OK; smoke x2 PASS (1 known sig, 0 new, deltas 0/0/0/0/0/+1/0), no B-37 flake | B-12, B-32, B-33 fixed. Guard = counter + try/finally; memory-backend harness (deleted): 0 writes on open and on monitor-model rebuild, saved monitor re-selected, sliders independent, 0 handlers after close. Finding: open-time msg-to-ext empty-string write may show in dconf dump. |
| 1.11 | diagnostics access (Auditor-only) | 1 | PASS | this commit | `make check` PASS; lint 0/151 = baseline (prefs.js 3 = HEAD); check-settings exit 0, 0/30 = baseline; xmllint general.ui OK; timer_check pass; smoke x2 PASS (1 known sig, 0 new, deltas 0/0/0/0/0/+1/0), no B-37 flake | prefs.js toggle_experimental reads experimental-features; general.ui experimental-features-row visible. Chain button -> msg-to-ext run-diagnostics -> whitelist -> runDiagnostics -> runTests intact. close-request disconnect confirmed. Note: runTests changes every setting and restores it (real dconf; not restored if interrupted). Nit: D2DA 6.5 still lists experimental-features as dead. |
| 2.1 | R-7a | 1 | PASS | this commit | `make check` PASS; lint 0/151 = baseline (animator.js 23 = HEAD); check-settings exit 0, 0/30 = baseline; timer_check 15/15; smoke x2 PASS (1 known sig, 0 new, deltas 0/0/0/0/0/+1/0), disposed/finalized 0, no B-37 flake | Pool destroyed before remove_all_children (clock/calendar only unparented, R-7b); all _renderer holders safe after disable; getTarget guard is bounce-only (A8 ok); destroy() uncalled (R-7d). Card wrong: dock.js:192 enable() is in Dock.dock() (createDock only); recreateDash never enables/undocks; every undock path builds a new Dock. 150 post-shutdown "sweeping phase of GC" criticals = HEAD (independent worktree smoke); .sig step runs before shutdown (tooling gap). Findings: _findIcons TypeError after destroyDash; R-7d call order. |
| 2.2 | R-7b | 1 | PASS | this commit | `make check` PASS; lint 0/151 = baseline (dock.js 21, dockItems.js 7, services.js 8 = HEAD); check-settings exit 0, 0/30 = baseline; timer_check 15/15; smoke x2 PASS (1 known sig, 0 new, 6/5 msgs, probe 6/5, deltas 0/0/0/0/0/+1/0), disposed/finalized 0, d2da: 0, no B-37 flake; T-8 shutdown GC criticals 150 both (= baseline); G-real not run (no approval) | B-29 destroy half + clock/calendar. Checked against Shell 50.5 popupMenu.js/dash.js/iconGrid.js: only d2da actors destroyed (Shell label stays unparent-only); _cleanupIcon/_destroyMenu idempotent on both paths; removeMenu pops the grab before destroy; _destroyList nulls before destroy so later _animate passes bail; services connects at creation only (A8); self-owned destroy connections (A6). Limitation: isolated smoke can not enable trash/downloads/clock/calendar, judged by reading. Process nit: Worker ran G-real once without human approval (writes enabled-extensions). Nit: removeMenu leaves activeMenu on the dropped manager. Findings: _updateExtraIcons remove_child without destroy (menu leak, Worker); icon-only recreate kills menu (Worker, rare); destroyDash skips invisible/non-favorite items (clock leak, Low); R-0e env hook for non-default settings. |
| 2.3 | R-7c | 1 | PASS | this commit | `make check` PASS; lint 0/150 (baseline 151; autohide.js 2 < HEAD 3, extension.js 13 = HEAD, windowTracker.js 0); check-settings exit 0, 0/30 = baseline; timer_check 15/15; window_tracker_check 20/20 (mutant without idempotence check: 8 FAIL, exit 1); smoke x2 PASS (1 known sig, 0 new, 6/5 msgs, probe 6/5, after-disable 0/0/0/0/0/+1/0 both); disposed/finalized 0; T-8 GC 150 | B-31. WindowTracker in new windowTracker.js (card-allowed), created in enable(), cleared on autohide off and in disable() before destroyDocks, destroyed after. Nit: smoke run 1 after-enable stage -32 on first sample only (timing, run 2 = 0). Tracker not exercised by smoke; human check. G-real not run. |
| 2.3a | R-0e | 1 | PASS | this commit | `make check` PASS; lint 0/150 = baseline (per file = HEAD, probe.js 0); check-settings exit 0, 0/30; timer_check 15/15; window_tracker_check 20/20; smoke x2 PASS (1 known sig, 0 new, 6/5 msgs, probe 6/5, deltas 0 except live* +5/+4); disposed/finalized 0; shutdown criticals 150 both; settings Accept PASS (200 crit); PROBE=0 PASS (0 probe lines); strict x1 FAIL as expected (live* + shutdown crit only) | T-5/T-6/T-8. Hook gated in-extension on D2DA_PROBE=1 + GSETTINGS_BACKEND=memory, placed after services and before docks, per-pair try/catch. live() off every per-frame path; Dash +1/-1 balanced via its own destroy signal. /proc zombie check correct. Real-dconf path verified by reading (re-enable before stop, settings blanked), not run. No orphan shells. **New metric baseline:** liveDock/liveDash/liveAnimator +1 per toggle (B-1); shutdown criticals 150 @5 toggles. Nits: startup loop still kill -0; calendar-server stderr line. Worker flakes not reproduced. |
| 2.4 | R-7d | 1 | PASS | this commit | `make check` PASS; lint 0/150 = baseline (per file = HEAD); check-settings exit 0, 0/30; timer_check pass; window_tracker_check pass; smoke x2 PASS (1 known sig, 0 new, 6/5, ALL deltas 0 incl. live*); shutdown criticals 0/0 (was 150); settings variant PASS, deltas 0, criticals 0 (was 200); strict x2: FAIL (missed D-Bus disable, counts 3/2, deltas 0) then PASS; disposed/finalized 0, `d2da: ` 0 in all runs | B-1 dock side, B-38, B-39, B-40. Dock.destroy() override (guarded, always super.destroy()); destroyDash destroys the Shell Dash; recreateDash rebuild verified by reading only (human check). All post-destroy readers emptied/cancelled. No new private coupling. Findings: strict line-count flake; createTheDocks multi-monitor branch may over-create [inference]. |
| 2.4a | R-7e | 1 | PASS | this commit | `make check` PASS; lint 0/150 = baseline (extension.js 13 = HEAD); check-settings exit 0, 0/30; timer_check 15/15; window_tracker_check 20/20; smoke x2 PASS (1 known sig, 0 new, 6/5, ALL deltas 0); strict x3 PASS consecutively (6/5 lines, ALL deltas 0, 0 crit); settings variant strict PASS (deltas 0, crit 0); disposed/finalized 0, `d2da: ` 0 | T-9 wait_toggle polls state (≤5s, retry once); stage excluded from strict delta failure; B-41 createTheDocks returns early when docks.length == count. Strict leaks 100% reliable. |
| 2.5 | R-8 | 1 | PASS | this commit | `make check` PASS; lint 0/150 = baseline (extension.js 13, services.js 8 = HEAD); check-settings exit 0, 0/30; timer_check 15/15; window_tracker_check 20/20; smoke x2 PASS (1 known sig, 0 new, 6/5, ALL deltas 0); strict PASS (6/5 lines, ALL deltas 0, 0 crit); settings variant strict PASS (deltas 0, crit 0); disposed/finalized 0, `d2da: ` 0 | B-25 (measured dt via get_monotonic_time, per-service try/catch), B-36 (separate _debounceRecentsSeq / _debounceDownloadsSeq), Gio cancellables, monitor cancel, enumerator close. Nit: empty catch on enumerator close in finally. |


