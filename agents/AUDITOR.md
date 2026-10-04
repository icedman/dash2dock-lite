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
Cycle / Task / Attempt:  0.0 / bootstrap / 1
Verdict:          PASS
Commit:           this commit (chore(agents): bootstrap agent workflow and headless smoke test)
Gates:            check=PASS ; smoke=PASS (1 known sig, 0 new, 6/5 enable/disable) ; smoke-x2=PASS (same) ; lint=n/a (R-0b) ; settings=n/a (R-0c) ; real=not run (advisory) ; card=n/a
Rule violations:  none (A3, A7, A12 checked)
Rework list:
  —
Nits:
  - agents/WORKER.md:79-80 report template carries trailing whitespace (`git diff --check`).
  - tools/smoke-shell.sh: default log path /tmp/d2da-smoke.log is predictable. Dev-only tool (stripped by `make install`, never in `publish`), so A7 doesn't apply; could use $XDG_RUNTIME_DIR later.
  - Makefile `install` copies `agents/` into the installed extension dir (`publish` strips it, `install` doesn't). Harmless for smoke, but it bloats the local install.
Findings confirmed fixed:  — (bootstrap, no findings claimed)
Human check needed:  none
New findings spotted (for Orchestrator):  none
```

## 7. Audit Log (append-only, newest last)

| Cycle | Task | Attempt | Verdict | Commit | Gates | Notes |
|---|---|---|---|---|---|---|
| — | setup | — | — | — | `make check` OK; smoke PASS ×3 isolated, PASS real-dconf | Tooling created by setup session (uncommitted). Baselines: isolated 1 signature (NM GI warning, shell-side); real 4 (incl. B-35 NaN clip, search-light's DesktopAppInfo warning). |
| 0.0 | bootstrap | 1 | PASS | this commit | `make check` PASS; `make smoke` PASS; smoke-x2 PASS (1 known sig, 0 new, 6/5 msgs each run) | Auditor-only bootstrap commit: Makefile, tools/smoke-shell.sh, agents/*.md, agents/smoke-baseline*.txt. A3/A7/A12 clean. Verified `make check` fails on a syntax error. Nits: WORKER.md template trailing whitespace; smoke log default in /tmp (dev-only); `make install` copies agents/ into the install dir. |
