# Pipeline Tracks (Stage 0)

This file covers track routing, the safety stoplist, the budget gate,
and async-friendly checkpoints — everything the orchestrator decides
*before* invoking Stage 1. The pipeline definition itself lives in
`pipeline-core.md` (Stages 1–3, 9, durations, parallel execution,
helper commands, checkpoints) and `pipeline-build.md` (Stages 4–8).
The full index is in `pipeline.md`.

## Stage 0 — Routing and Budget

Before Stage 1, the orchestrator decides which track to run and (optionally)
initialises budget tracking.

### Safety stoplist

The full track is mandatory for any change that touches:
- Authentication, authorization, or session handling
- Cryptography, key management, or secrets rotation
- PII, payments, or regulated-data handling
- Schema migrations or destructive data changes
- Feature-flag introduction (toggling existing flags is fine in config-only)
- New external dependencies (upgrades are fine in dep-update)

The lighter tracks (quick, nano, config-only, dep-update) must not be used
to bypass this list. When uncertain, default to full. As of B-13 (parity
audit 2026-05-07), `codex-team.js` enforces the stoplist programmatically
by refusing the lighter tracks on description or diff matches; `--force`
overrides for false positives.

The routing decision is recorded in `pipeline/context.md` under `## Brief
Changes` as `TRACK: <name>` with a one-line rationale. Each gate file in
`pipeline/gates/` includes `"track": "<name>"` in its body so the
gate-validator and downstream tooling can branch on track.

### Budget gate (opt-in)

If `.codex/config.yml` has `budget.enabled: true`, the orchestrator writes
`pipeline/budget.md` at run start with zero counters and updates it at every
stage boundary:

```markdown
# Budget

Started: <ISO>
Tokens max: 500000
Wall-clock max: 90 min

## Running totals
| Stage | Tokens | Elapsed (min) |
|-------|--------|---------------|
| requirements | 12000 | 3.2 |
| design       | 45000 | 8.7 |
| ...          | ...   | ... |
```

After each stage gate passes, the orchestrator checks the running totals
against the configured maximums. On exceed:

- `on_exceed: escalate` — write `pipeline/gates/stage-budget.json` with
  `status: ESCALATE`, `escalation_reason: "Budget exceeded — <tokens |
  wall-clock>"`, and `decision_needed: "Continue (override budget), or halt
  and inspect?"`. The orchestrator halts.
- `on_exceed: warn` — log the breach and continue the pipeline. Useful for
  calibration runs where the team is still tuning limits.

Token counts are best-effort — the orchestrator sums reported usage where
available, otherwise estimates from character counts. This is a guardrail,
not a cryptographic limit.

When `budget.enabled: false` (default), no tracking happens.

### Async-friendly checkpoints (opt-in)

By default the pipeline halts at Checkpoints A (after requirements), B
(after design), and C (after QA) waiting for a human `proceed`. Teams can
pre-approve a checkpoint when a precondition holds, configured in
`.codex/config.yml`:

```yaml
checkpoints:
  c:
    auto_pass_when: all_criteria_passed
```

Supported conditions:

- `null` / absent — always wait for human (default; current behaviour)
- `no_warnings` — auto-pass if the stage gate has zero warnings
- `all_criteria_passed` — auto-pass if `stage-07.json` has
  `all_acceptance_criteria_met: true` AND
  `criterion_to_test_mapping_is_one_to_one: true` (Checkpoint C only)

Auto-pass writes a record to `pipeline/context.md` under `## User Decisions`
as:

```
<ISO> — CHECKPOINT-AUTO-PASS: <a|b|c> (<condition>)
```

Never auto-pass security-sensitive work. The safety stoplist above remains
the hard guard — auto-pass at checkpoints does not override it. If
`pipeline/context.md` contains any stoplist trigger keyword, auto-pass is
suppressed regardless of the configured condition. `codex-team.js
checkpoint <stage>` implements the auto-pass with the stoplist suppression.

---

## Tracks

| Track | Use for | Review |
|---|---|---|
| full | Cross-area features | Matrix review |
| quick | Small scoped code changes | One reviewer |
| nano | Trivial single-file edits | Regression check only |
| config-only | Configuration value changes | Platform review |
| dep-update | Dependency upgrades | QA + security-sensitive checks |
| hotfix | Urgent production bugs | Expedited review |

The rules in `pipeline-build.md` describe the **full** track. Lighter-track
deltas live in the track's own command file (`.codex/commands/{track}.md`).
When a gate in a lighter track differs from the full-track definition (for
example, Stage 6 needing only one approval in `quick`), the track file
overrides the rule here — the track file is authoritative for its own track.

---

## Track Contracts

`npm run next` is track-aware. It infers the active track from
`CODEX_TEAM_TRACK`, existing gate files, or `pipeline/context.md`, then advances
only through the stages that track uses.

### full

Full track uses every stage in order. Stage 6 normally uses matrix review, but
pre-existing scoped gates remain valid when a run intentionally narrows review
area and approval count.

### quick

Quick track uses Requirements → Build → Peer Review → QA → Deploy →
Retrospective. Stage 6 review gates must be scoped reviews with
`required_approvals: 1`. `npm run pipeline:review` precreates quick scoped
review gates from existing `pipeline/pr-<area>.md` files.

### nano

Nano track uses Build → QA only. It must not write requirement, design,
clarification, pre-review, deploy, or retrospective gates. A PASS QA gate must
record `regression_check: "PASS"`.

### config-only

Config-only track uses Build → Pre-review → QA → Deploy. It records
`CONFIG-ONLY scope` in `pipeline/context.md`. A PASS QA gate must record
`regression_check: "PASS"`.

### dep-update

Dependency-update track uses Build → Peer Review → QA → Deploy. The review
area is `deps`, with a precreated `pipeline/gates/stage-06-deps.json` scoped
review gate requiring one approval. A PASS QA gate must record
`regression_check: "PASS"`.

### hotfix

Hotfix track uses Build → Pre-review → Peer Review → QA → Deploy →
Retrospective. It writes `pipeline/hotfix-spec.md`, records
`STAGE-4.5A-SKIP: hotfix track`, and still runs the conditional security check.
A PASS Stage 6 gate must record `stage_4_5a_skipped: true`.
