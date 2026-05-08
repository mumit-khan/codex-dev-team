# 10 — Sequenced Parity Roadmap

The fifteen ports needed to bring codex into functional sync with the
post-audit claude-dev-team, sequenced by dependency and risk. References
to `B-N` are claude's audit-finding IDs; the codex parity backlog lives
in `09-backlog.md`.

## Batch 1 — Quick wins (half a day, parallelisable)

Pure ports, no behavioural surprises. Each can land independently.

| Order | Item | Why this first |
|---|---|---|
| 1 | **B-4 [DONE]** schema `description` fields | Direct copy from claude's schemas; zero behavioural impact. Improves contributor UX immediately. |
| 2 | **B-5 [DONE]** `templates/README.md` | One-line-per-template doc; copy claude's verbatim with the `.claude` → `.codex` mention swap. |
| 3 | **B-19 [DONE]** `release.js` check `.codex/config.yml` framework.version | Trivial regex check, paired with a new test mirroring claude's pattern. |
| 4 | **B-22** `Atomics.wait` lock retry | One-line replacement of the busy-spin in `scripts/approval-derivation.js`. Existing concurrency tests pass through. |
| 5 | **B-27** Framework-level ADR for the rule↔agent bilateral coupling | Pure docs. Copy claude's ADR with `.claude` → `.codex` swap and re-date. Establishes `docs/adr/` pattern for codex. |

Verification per item: `npm test`, `npm run lint`. Hook-parity check
doesn't apply (codex has no hooks dir).

## Batch 2 — Hardening (~2–3 dev-days)

Real behavioural changes. Each one closes a real defensive gap.

| Order | Item | Why this order |
|---|---|---|
| 6 | **B-3** Filesystem error branching in `gate-validator.js` | Closes the silent-PASS-on-EACCES hole. Same pattern as claude — `HALT_FS_CODES` set + branch in top-level catch. |
| 7 | **B-16** 1 MB cap on hook file reads | Both `gate-validator.js` and `approval-derivation.js`. Defence in depth; existing tests still pass. |
| 8 | **B-15** Table-driven test for `security-heuristic.js` | Pin current behaviour against silent regex changes. ~50 LOC. |
| 9 | **B-18** Adapter-contract test | Six required H2 sections per adapter; ports 1:1 from claude. |
| 10 | **B-14** Concurrency test for `approval-derivation.js` | Two-process parallel test; validates the lock model under contention. |
| 11 | **B-23** `LOG_FORMAT=json` structured-log mode | Both hooks. One JSON event per terminal exit. Useful when Codex CLI runs are driven by an external orchestrator that wants machine-readable signal. |

Sequencing note: B-3 + B-16 are both in `gate-validator.js`; they pair
nicely in one PR. B-15 + B-18 are pure test additions. B-14 fits with
B-23 since both touch `approval-derivation.js` and benefit from the same
test-isolation work.

## Batch 3 — Structural (~3–4 dev-days)

Larger refactors. Each one has bigger blast radius — sequence matters.

| Order | Item | Sequencing notes |
|---|---|---|
| 12 | **B-17** `codex-team.js` dispatch refactor to `COMMANDS` object map | Should land BEFORE B-13 because the stoplist hook is cleaner against an object-map dispatch than an if-chain. Behaviour-preserving refactor; export `COMMANDS`. |
| 13 | **B-13** Programmatic stoplist enforcement on lighter tracks | Port `scripts/stoplist.js` from claude with the regex set unchanged. Wire into `runTrack` in `codex-team.js` to refuse `/quick` `/nano` `/config-only` `/dep-update` on match; `--force` to bypass. Add tests mirroring claude's. |
| 14 | **B-10** Extract `tests/_framework-contract.js` shared module | Useful but not urgent. Pairs naturally after B-17 because the COMMANDS export becomes a natural item to consume. |
| 15 | **B-21** Split `.codex/rules/pipeline.md` (589 lines) into core / build / tracks | Last because it touches the most files (every agent prompt that reads pipeline.md, the parity-check stoplist scan, the orchestrator startup instruction). The claude side did this in the same audit — lessons-learned for the codex side: write all three sub-files first, then replace `pipeline.md` with the index, then update parity-check to scan `pipeline-tracks.md`, then run the suite and patch any test fixtures that were writing the old monolithic content. |

## Verification gates per batch

- **Batch 1**: `npm test`, `npm run lint`, `node scripts/release.js check`.
- **Batch 2**: same plus drift-injection — manually mutate one section
  heading in an adapter file and confirm B-18 fails the targeted
  assertion.
- **Batch 3**: same plus a pipeline dogfood end-to-end on the example
  app, plus a `/quick` invocation on a stoplist-matching description
  (must reject), plus the `--force` bypass (must allow with context.md
  log).

## Roadmap risks

- **B-21 split risk**: every reference to "see `pipeline.md` Stage X" in
  agent prompts and command rules will read accurately as long as
  `pipeline.md` becomes an index pointing at the right sub-file. Worked
  cleanly on the claude side; the codex side has identical structure so
  the same approach will work. Watch out for codex-specific files that
  read pipeline.md content directly (`parity-check.js` is the main one;
  `release.js` may be another).
- **B-13 false positives**: the stoplist regex set might over-trigger
  on real-world descriptions. Land with the same `--force` flag claude
  ships and document the bypass in `docs/tracks.md`.
- **B-17 breakage**: behaviour-preserving refactor. The same drift the
  claude refactor caught (exit code on `bogus` command) is worth
  re-checking on the codex side post-refactor.

## Re-sequencing triggers

- **Any user-reported gate corruption in codex** → bump B-14 (concurrency
  test) and B-3 (error-class branching) into Batch 1.
- **Any user-reported missed stoplist case** → bump B-13 to Batch 1.
- **External orchestrator integration request** → bump B-23
  (`LOG_FORMAT=json`) up.
- **Docs ask** (a contributor confused by per-stage info in the monolith)
  → bump B-21 up.

## What this is NOT

- A full Phase 0–3 audit on codex. If you want one, run `/audit` from
  inside `codex-dev-team` after Batch 1 lands so the new schemas, README,
  and ADR are reflected in the new audit's findings.
- A symmetric port. Codex has things claude doesn't (`execution-profiles.md`,
  `roles.md`) that are deliberate divergences. They stay codex-only.
- A guarantee that codex will be at byte-level parity with claude after
  these ports. The two repos diverge on runtime model (Codex CLI vs Claude
  Code harness, hook event taxonomy, settings.json shape) and the audit
  respects those boundaries.

## Status

- **Total work**: 15 ports, ~5–7 dev-days sequential / 2–3 dev-days
  parallelised aggressively.
- **Already at parity**: 4 items (B-8, B-11, B-12, B-24).
- **Deliberate divergences**: 8 items (B-1, B-2, B-6, B-7, B-9, B-20,
  B-25, B-26).
- **No codex-only gaps** that aren't already absorbed into a port.

Re-run `/audit` (or this parity audit) after Batch 3 lands; expect the
parity ledger in `docs/parity/` to flip from "claude is ahead on N
items" to "two repos in functional sync".
