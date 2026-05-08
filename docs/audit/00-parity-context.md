# 00 — Parity Audit Context

_Audit run: 2026-05-07. Scope: bring codex-dev-team into functional sync
with claude-dev-team after the latter's audit-driven hardening run._

## Why this audit is parity-shaped, not full-shape

The sibling repo `../claude-dev-team` just completed a full /audit cycle
that closed 27 findings in 31 commits. That work moved claude noticeably
ahead of codex on several functional dimensions: programmatic stoplist
enforcement, file-size caps on untrusted reads, gate-validator filesystem
error branching, structured-log mode, the pipeline.md three-way split,
adapter-contract tests, and a few smaller items.

The two repos are intended to stay in functional parity at the gate
schema, template, rule, and validator layer. CLI surfaces and runtime
hook semantics diverge by design (Codex CLI vs Claude Code). This audit
**does not** re-do a Phase 0–3 codebase audit on codex — that would
duplicate effort and the findings would mostly mirror what was already
spotted on claude. Instead it works from the claude audit's `B-1` …
`B-27` items and asks, for each: does codex already have this? Does it
need a port? Or is it a deliberate divergence?

## Current state (codex baseline, 2026-05-07)

| Metric | Codex | Claude (post-audit) |
|---|---|---|
| Version | 1.0.0 | 2.6.0 |
| Tests passing | 169 across 17 files | 410 across 27 files |
| `pipeline.md` | 589 lines, monolithic | split: 4 files (index + 3 sub-files) |
| Helper scripts | 18 | 19 (claude added stoplist.js) |
| Stoplist enforcement | checkpoint suppression only | + track-refusal in CLI dispatch |
| Hook size caps | none | 1 MB on gate JSON + review markdown |
| Gate-validator fs errors | swallowed → exit 0 | branched: halt-class codes exit 1 |
| Lock retry in approval-derivation | busy-spin | `Atomics.wait` |
| `LOG_FORMAT=json` event mode | none | both hooks emit structured events |
| Schema property descriptions | none | every property documented |
| Templates README | none | `templates/README.md` lists all 11 |
| Hook event README | n/a (no hooks dir) | `.claude/hooks/README.md` |
| Framework-level ADR dir | none | `docs/adr/0001-...` |

`npm test` is clean (169/169) and `npm run lint` is clean — codex is in
healthy state, just behind on the audit-driven additions.

## Runtime-model differences that affect what's portable

Codex CLI does not expose the same hook events as Claude Code. Concretely:

- **No `.codex/hooks/` directory**: hook scripts live only in `scripts/`.
  Claude duplicates them under `.claude/hooks/` because the Claude Code
  harness loads from there. Codex doesn't have that requirement.
  Consequence: B-1 (hook byte-parity test) doesn't apply — there's
  nothing to keep byte-equal.
- **No `.codex/settings.json` permissions block**: Claude Code's
  permission allow/deny model has no Codex equivalent. Consequence:
  B-2 (`Bash(curl *)` scoping) doesn't port directly — codex's safety
  story for shell commands is whatever its CLI offers.
- **No equivalent to `${CLAUDE_PROJECT_DIR}` env shim**: codex hooks
  invoke scripts directly via `process.cwd()`. Consequence: B-20 (3-tier
  root resolution) doesn't port.
- **`scripts/build-presentation.js`**: claude-only deck builder. Not a
  parity target.

These are real divergences, not gaps. Codex's runtime model is different,
and the audit should resist the urge to force-port items that don't fit.

## What this audit produces

- `docs/audit/09-backlog.md`: every B-item from claude's audit triaged
  against codex's current state — _ported-already_ / _port_ / _adapt_ /
  _doesn't apply_, plus codex-specific gaps the parity check surfaced.
- `docs/audit/10-roadmap.md`: sequenced batches (Quick / Hardening /
  Structural) ordered by dependency and risk.

The audit explicitly does NOT re-run Phase 0–3 deep analysis. If you
want a full codex-only audit at some point, run `/audit` from inside
codex-dev-team and let it produce its own findings.
