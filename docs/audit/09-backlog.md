# 09 — Parity Backlog

Each row maps a claude-dev-team audit finding (`B-N`) to its codex
status: ported-already / port / adapt / doesn't apply. Codex-specific
gaps not from claude's audit appear at the bottom under `CX-N`.

Severity is the cost of NOT porting; effort is implementation cost.

## Already in codex (no port needed)

| Claude id | Item | Notes |
|---|---|---|
| B-8 | Lock-tuning rationale comments | Codex has them on `LOCK_RETRIES`, `LOCK_DELAY_MS`, `LOCK_STALE_MS`. ✅ |
| B-11 | `scripts/budget.js` | Originally a codex script; this is what claude ported. ✅ |
| B-12 | `scripts/visualize.js` | Same — codex was the source. ✅ |
| B-24 | Async-checkpoint conditional auto-pass | Implemented in `codex-team.js` (`applyCheckpointAutoPass`), reads `.codex/config.yml`, suppresses on stoplist content in context.md. Honestly more polished than claude's port. ✅ |

## Port — straightforward (small effort, low risk)

| Claude id | Item | Effort | Severity | Notes |
|---|---|---|---|---|
| **B-4 [DONE]** | Add `description` to every property in `schemas/*.schema.json` | XS | Low | Direct copy of the prose from claude's schemas with $id/title swapped to codex; descriptions adjusted for codex's stage numbering (no 4.5a; 5=pre-review, 6=peer review, 7=qa, 8=signoff+deploy). |
| **B-5 [DONE]** | `templates/README.md` cataloguing the 11 templates | XS | Low | Direct port; codex's template set matches claude's. |
| **B-19 [DONE]** | `release.js check` validates `.codex/config.yml` `framework.version` against `VERSION` | XS | Medium | Codex `release.js` already verifies `package.json` and `package-lock.json`; one more regex-based check. |
| **B-22 [DONE]** | Replace busy-spin lock retry with `Atomics.wait` | XS | Low | One-line change in `scripts/approval-derivation.js`. Verified the busy-spin still exists at line ~129. |
| **B-27 [DONE]** | Framework-level ADR for the rule↔agent bilateral coupling | XS | Low | Pure docs; copy claude's ADR with `.claude` → `.codex` swap and re-date. |

## Port — needs adaptation (medium effort)

| Claude id | Item | Effort | Severity | Notes |
|---|---|---|---|---|
| **B-3 [DONE]** | Filesystem error branching in `gate-validator.js` | S | Medium | Codex `gate-validator.js` swallows errors. Add `HALT_FS_CODES` set + branch in top-level catch. Same pattern as claude. |
| **B-15 [DONE]** | Table-driven test for `security-heuristic.js` | XS | Low | Direct port; codex has the same `DEFAULT_PATTERNS` shape. |
| **B-16 [DONE]** | 1 MB cap on hook file reads | S | Medium | Both `gate-validator.js` and `approval-derivation.js`. `MAX_GATE_BYTES` / `MAX_FILE_BYTES` constants + `statSync` size check before each read. |
| **B-18 [DONE]** | Adapter-contract test (five required H2 sections per adapter) | S | Low | Codex has 4 adapters in `.codex/adapters/`. Codex adapters carry 5 sections (no Runbook hooks like claude) — the test reflects codex's actual structure. |
| **B-23 [DONE]** | `LOG_FORMAT=json` structured-log mode | M | Low | Both hooks. One JSON event line per terminal exit (`gate_pass`/`gate_fail`/`gate_escalate`/`gate_updated`). |

## Port — larger / structural

| Claude id | Item | Effort | Severity | Notes |
|---|---|---|---|---|
| **B-13 [DONE]** | Programmatic stoplist enforcement on lighter tracks | S–M | High | Ported `scripts/stoplist.js` with the regex set unchanged; wired into `runTrack`; `--force` bypasses. The pre-existing `contextHasStoplistTrigger` (used for checkpoint suppression) coexists. |
| **B-14 [DONE]** | Concurrency test for `approval-derivation.js` | S | Medium | Spawn two parallel processes both writing to the same area gate; assert both approvals land. ~30 LOC. |
| **B-17 [DONE]** | Replace `codex-team.js` if-chain dispatch with `COMMANDS` object map; export it | S | Medium | Refactor preserved behaviour; added `checkpoint <stage>` subcommand wrapping the existing `applyCheckpointAutoPass`. |
| **B-21** | Split `.codex/rules/pipeline.md` (589 lines) into core / build / tracks sub-files | M | Medium | Same shape as claude's split. `pipeline.md` becomes a thin index. Update `parity-check.js` (codex side) to scan `pipeline-tracks.md` for stoplist content; update agent prompts that read pipeline.md to also load the sub-files (or trust the index pointer). |
| **B-10** | Extract `tests/_framework-contract.js` shared module | S | Low | Centralise COMMANDS / RULES / SKILLS / etc. lists used by multiple test files. Codex's `tests/contract.test.js` and `tests/parity-check.test.js` carry duplicate inline lists today. |

## Doesn't apply — runtime divergence

| Claude id | Reason |
|---|---|
| B-1 | Codex has no `.codex/hooks/` directory; hook scripts live only in `scripts/`. There's no second copy to byte-pin. |
| B-2 | Codex has no `settings.json` permissions block. Whatever Codex CLI offers for shell-command scope is its own concern. |
| B-6 | Codex has no `.codex/hooks/` directory; the README would have nothing to live alongside. |
| B-7 | Claude's "First 30 Minutes" README section is Claude-Code-specific (mentions `claude` command, EXAMPLE.md is claude-flavoured). Codex has its own onboarding via `AGENTS.md`. Optional codex-specific equivalent is fine but it's not a parity port. |
| B-9 | Codex has no `.codex/commands/` (Codex CLI doesn't have slash commands in the same shape). The claude test pinned slash↔CLI parity; codex's equivalent surface is the `npm run *` shims, which are tested differently. |
| B-20 | Codex hooks invoke scripts via `process.cwd()`; the `${CLAUDE_PROJECT_DIR:-…}` shim has no Codex analogue. |
| B-25 | The codex-parity test in claude is the symmetric vector — running both validators against shared input. Codex already has the parity-check.js script; it does not need a sibling file going the other direction. |
| B-26 | Codex has no presentation deck builder. Nothing to move. |

## Codex-specific gaps (not in claude's audit)

These are pre-existing issues the parity check surfaced, not part of
the claude audit. Worth fixing alongside but they are codex-only.

| Id | Item | Effort | Severity | Notes |
|---|---|---|---|---|
| **CX-1** | `release.js` check covers `package.json` and `VERSION` but not `.codex/config.yml`'s `framework.version`. | XS | Medium | Same as B-19's port for codex (listed there). |
| **CX-2** | Schemas under `schemas/*.schema.json` lack property `description` fields entirely (pre-audit gap, fixed by B-4 port). | XS | Low | Folded into B-4 port. |
| **CX-3** | Stoplist content in `.codex/rules/pipeline.md` — when the file is split (B-21 port), parity-check needs to be updated to scan the new sub-file. | XS | Low | Folded into B-21 port. |
| **CX-4** | Codex has `execution-profiles.md` and `roles.md` rule files that claude doesn't. Pre-existing codex-only structure; flagged here so the parity-check ignore-list is explicit. | n/a | Low | Document in README; not a fix. |
| **CX-5 [DONE]** | `scripts/bootstrap.js` copied the entire `docs/` tree into bootstrap targets, including audit outputs. Polluted test fixtures and would have shipped framework audit findings into target projects. | XS | Medium | Surfaced when implementing B-4 — the schema test couldn't pass with my own audit's `docs/audit/` files getting copied into the test tmpdir. Made bootstrap selective (mirror the claude-dev-team pattern: only copy `parity`, `migration`, `release-notes`, `releases` subdirs + top-level files). |

## Summary

- **5 ports — straightforward** (B-4, B-5, B-19, B-22, B-27): roughly half a day total.
- **5 ports — needs adaptation** (B-3, B-15, B-16, B-18, B-23): ~2–3 dev-days.
- **5 ports — structural** (B-10, B-13, B-14, B-17, B-21): ~3–4 dev-days, mostly because B-21 is the largest.
- **8 deliberate divergences** (B-1, B-2, B-6, B-7, B-9, B-20, B-25, B-26): no work.
- **0 codex-only gaps** that aren't already absorbed into a port.

Total ports: 15 items. Total work: ~5–7 dev-days if done sequentially.
Most are independent and parallelisable.
