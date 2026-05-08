# ADR 0001 — Pipeline rules and agent prompts are bilaterally coupled

**Status:** Accepted
**Date:** 2026-05-07
**Authors:** Framework maintainers (parity audit B-27 / Q-08)

## Context

Two source-of-truth surfaces talk about the same thing:

- `.codex/rules/pipeline.md` says, for example, "invoke `dev-platform`
  at Stage 5 to run lint, type-check, and SCA."
- `AGENTS.md` (and any agent prompts under `.codex/`) says, for example,
  "On a Pre-Review task you run lint, type-check, and SCA at Stage 5."

Each agent's prompt restates the parts of `pipeline.md` it owns. The
two files are intentionally redundant: agents can be invoked without
the orchestrator reading every rule file aloud, and orchestrator rules
must be readable without diving into every agent persona.

The cost is that any rename — Stage 5 → 5.1, `dev-platform` → some
other owner, "lint + SCA" → "lint + SCA + license check" — requires
edits in both `pipeline.md` and the relevant agent persona. Drift is
silent today; nothing programmatic checks the two agree.

## Decision

We accept the bilateral coupling. We do **not** introduce a single
source of truth (e.g. generating agent prompts from a manifest) for
the following reasons:

1. **Generated prompts lose human-tuned voice.** Agents are LLM
   personas. Their effectiveness depends on how the prompt reads to a
   model, not just on the facts it conveys. A generated prompt would be
   uniform and dry across roles.
2. **Orchestrator rules and agent prompts have different audiences.**
   The orchestrator reads `pipeline.md` to route work and validate
   gates. An agent reads its own prompt to do a job. The same fact
   needs different framing in each place.
3. **The coupling is bounded.** It only exists between
   `pipeline.md` and the agent prompts; gate schemas, templates, and
   validators are decoupled (gates are JSON, templates are scaffolds,
   validators read deterministic inputs).
4. **Drift is observable.** When a stage is renumbered or an owner
   changes, agents will reference a stage that does not exist; this
   surfaces at the next pipeline run rather than as a silent bug.

## Mitigations in place

- **Track field on every gate** (`.codex/rules/gates.md`): downstream
  tooling (validator, status, parity) branches on the track string,
  not on per-stage hardcoded names. A renumber that updates `pipeline.md`
  but forgets the agent persona will produce gates that still validate;
  the symptom is a stage that "didn't run" rather than a corrupt run.
- **Hooks parity** (`scripts/parity-check.js`): catches drift between
  this repo and `claude-dev-team` at the helper-script + rule-file
  presence level. The audit-driven `tests/codex-parity.test.js` on the
  claude side runs both validators against shared fixtures.
- **Frontmatter schema and contract tests**: assert agent and skill
  metadata stays well-formed at CI time.

## Mitigations not in place (and why)

- **Schema-lite contract test that parses stage references in
  pipeline.md and every agent file and asserts agreement.** Could catch
  real drift, but requires a small DSL for "this agent owns these
  stages" embedded in agent metadata (or parsed out of prose). The
  leverage is low — a single yearly drift event is cheaper to fix on
  report than the cost of maintaining the contract test forever.
  Revisit if drift events become recurrent.

## Consequences

- **Positive:** agent prompts stay tuned to their role's tone;
  orchestrator rules stay readable as a single linear document; hooks
  and tooling stay independent of stage naming.
- **Negative:** every stage rename or ownership change is a multi-file
  edit. A future audit will probably notice this again; that's fine
  — the answer will probably be the same.
- **Trigger to revisit:** if drift between `pipeline.md` and the agent
  prompts causes more than one defect within a single quarter, accept
  the cost of the schema-lite contract test and ship it.

## Codex-specific note

Codex's runtime model differs from Claude Code's, but this ADR applies
identically: the same coupling exists in the codex tree
(`.codex/rules/pipeline.md` ↔ `AGENTS.md` and per-agent prompts), with
the same trade-offs. The claude-dev-team sibling carries a structurally
identical ADR (also numbered 0001) — the parity check ignores
divergence here because the decision is shared.

## Related

- Parity audit findings B-27, Q-08 (`docs/audit/09-backlog.md`).
- Sibling: `../claude-dev-team/docs/adr/0001-pipeline-agent-bilateral-coupling.md`
  (parallel ADR with the same decision and reasoning, scoped to claude's
  paths and runtime).
