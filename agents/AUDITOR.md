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
| G-settings | `python3 tools/check-settings.py` *(once R-0c is committed)* | no **new** issues vs. last Audit Log entry |
| G-smoke | `make smoke` | `SMOKE: PASS` (extension ACTIVE after start and after 5 toggles, shell alive, **no NEW error signatures**) |
| G-smoke-x2 | `tools/smoke-shell.sh 5` again | PASS again (flake guard). One PASS + one FAIL ⇒ rerun a third time; report flakiness in the log |
| G-real | `D2DA_SMOKE_REAL_DCONF=1 D2DA_SMOKE_BASELINE=agents/smoke-baseline-real.txt tools/smoke-shell.sh 3` | *advisory* (depends on the user's other extensions). Required for tasks touching `integrations.js` |
| G-card | the card's **Verify** steps | as stated in the card |
| G-leaks | `D2DA_SMOKE_STRICT_LEAKS=1 make smoke` | *required once RUN.md says strict leaks are ON* (after R-7d) |

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
Cycle / Task / Attempt:  1.1 / R-1 / 1
Verdict:          PASS
Commit:           see Audit Log (short hash)
Gates:            check=PASS ; lint=PASS (0 errors / 166 warnings, was 168; timer.js 2 -> 0, the 2
                  removed = no-undef `func` (B-24); `npx eslint timer.js eslint.config.js` clean, so
                  no-undef is an error again for timer.js) ; settings=BASELINE (exit 1, 2 err / 30 warn,
                  same classes/counts) ; smoke=PASS (1 known sig, 0 new, 6/5 msgs, probe 6/5,
                  after-enable deltas 0, after-disable 0 0 0 0 0 +1 0 = T-5) ; smoke-x2=PASS (same;
                  deltas 0 0 0 0 0 +1 0) ; `grep -c 'd2da: timer' /tmp/d2da-smoke.log` = 0 both runs ;
                  leaks=n/a (strict OFF) ; real=not run (advisory, no integrations.js change) ;
                  card=PASS (`gjs -m tests/timer_check.js` 15/15, exit 0, 0.4 s).
Scope:            timer.js (+57/-16), eslint.config.js (only 'timer.js' dropped from the no-undef:warn
                  override `files` + its comment), tests/timer_check.js (new, 132 lines; tests/ is
                  not linted and not shipped). agents/*.md = Orchestrator/Auditor bookkeeping
                  (RUN.md board/ledger/metrics/log, D2DA.md 6.5 wording from 0.3).
Rule violations:  none (A1-A13).
Specific checks:
  - Discrimination: the test against HEAD timer.js (scratch dir, removed) exits non-zero. It FAILs
    the stale checks, then runAnimation(handle) throws "array.forEach is not a function". Same test
    with the runAnimation section cut, against HEAD: 8 FAILs (stale x4, B-23 restart x2,
    is_running after REMOVE, thrower).
  - B-2: per-subscriber try/catch with the d2da prefix, loop continues. The start() wrapper also
    catches anything else in onUpdate (hibernate/onStop), so GJS can never kill the source with
    _timeoutId left set. The wrapper returns CONTINUE only if `_timeoutId === sourceId`. A
    stop()/start() or hibernate() inside a tick removes the old source without nulling the new
    id. source_remove on the dispatching source followed by returning REMOVE is legal in GLib.
  - B-23: subscribe restarts on `length > 0 && !is_running()`. extension.js _updateAnimationFPS
    shutdown()+initialize() with live subs now restarts on the next subscribe (test 5 + my case G:
    hibernate in onUpdate, then subscribe restarts).
  - B-6 (timer half): module-level id counter; obj._timer owner tag; a foreign-owned handle gets
    _id/_timer stripped. The merge path keeps _timer (spread of obj, which has _timer = this).
  - B-24 part: runAnimation typo fixed, mirrors runSequence. The only caller is animator.js
    bounceIcon (array), so no behaviour change.
  - Departure 1 (no slice): verified safe. unsubscribe() always replaces this._subscribers and
    never mutates the captured array, so a mid-loop removal can't skip or double-visit anyone.
    subscribe() push lands in the captured array or a newer one, and count is fixed, so a new sub
    is not run in that tick and runs once in the next. Ids are deduped, so an object can't
    appear twice. Auditor scratch cases (gjs, manual onUpdate, file removed) all ok:
    self-unsubscribe before a survivor, 2 consecutive unsubscribes, subscribe during the loop
    before/after an unsubscribe, self re-arm (1 call/tick, no dup), re-armed debounce never
    fires, thrower between 2 subs, hibernate -> subscribe restart. Semantics = HEAD forEach
    (which also bound the array once), minus nothing, plus no allocation.
  - Departure 2 (s._timer.unsubscribe): accepted. Every element has _timer (set before
    push/merge). Grep of every runDebounced/runOnce/runLoop/runSequence/runAnimation/cancel
    caller (extension.js, dock.js, autohide.js, services.js, animator.js, diagnostics.js): each
    handle is created, re-armed and cancelled on the same timer (debounceEndSeq _loTimer;
    _animationSeq _hiTimer; autohider._animationSeq only cancelled, never assigned; cancel()
    still uses `this`). So nothing changes for current callers, and the stale-handle case is
    fixed (it was the B-6 "never unsubscribes" root cause).
  - A8: onUpdate allocates nothing per tick (const ref + index loop; template strings only on
    throw). The wrapper closure is per start(), not per tick. subscribe writes one property.
  - A13: Report claims match (files, lint 166, test results, HEAD discrimination, smoke).
Rework list:
  —
Nits:
  - onUpdate comment rationale (b) overclaims. run*(handle) already sets `_time = 0` on the
    shared object before the merge, so slice() would see the reset too. After an earlier
    unsubscribe in the same tick, the captured array holds the pre-merge object (exactly as HEAD
    did). The code is right; only the "must be seen in its reset state" wording is stronger than
    the truth.
  - tests/timer_check.js check 1 (thrower) doesn't isolate B-2 on HEAD. HEAD's colliding 0xff id
    (B-6) overwrote the thrower in place, so it ran 0 times for that reason. The check still
    fails on HEAD, just for B-6. Consider separate timers per scenario when the test is next
    touched.
  - The test's last step monkeypatches timer.onUpdate on the instance (fine: the wrapper reads
    this.onUpdate dynamically).
Findings confirmed:  B-2, B-23, B-6 (timer half), B-24 (runAnimation typo) fixed in timer.js.
Human check needed:  none
New findings spotted (for Orchestrator):
  - (latent) A handle that is still live on timer A and gets passed to B.runX() is re-owned by B.
    A keeps ticking its copy, and that copy's run* closure now unsubscribes from B, not A, so it
    stays on A. No caller does this today (grep above). R-2 should keep the "one handle, one
    timer" convention and null handles in disable().
  - Worker info items accepted: onStart/onStop/onPause/onResume hooks are unguarded (no users;
    R-11/R-18). The merge path returns a copy, so callers must store the return value (R-2
    relies on this).
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
