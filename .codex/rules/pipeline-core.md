# Pipeline Core (Stages 1–3, 9, durations, execution model, helpers)

Stages with mostly single-role flows: requirements (PM), design
(Principal), pre-build clarification, and the post-deploy retrospective.
Stage Duration Expectations, the Parallel Execution Model, Helper Commands,
and Human Checkpoints live here too. The build/review/test/deploy stages
live in `pipeline-build.md`. Track routing and the safety stoplist live in
`pipeline-tracks.md`.

## Stages overview

1. **Requirements** — PM writes `pipeline/brief.md` and Stage 1 gate.
2. **Design** — Principal writes `pipeline/design-spec.md` and ADRs.
3. **Clarification** — unresolved questions in `pipeline/context.md` are answered.
4. **Build** — implementation happens in role-owned areas.
5. **Pre-review** — lint, type-check, dependency audit, and conditional security.
6. **Peer Review** — reviewers write `pipeline/code-review/by-<role>.md`.
7. **QA** — QA writes tests and `pipeline/test-report.md`.
8. **Sign-off and Deploy** — PM sign-off, then deployment when requested.
9. **Retrospective** — lessons are added to `pipeline/lessons-learned.md`.

---

## Stage 1 — Requirements (PM)

Invoke: `pm` agent
Input: user's feature request
Output: `pipeline/brief.md`
Gate file: `pipeline/gates/stage-01.json`
Gate key: `"status": "PASS"`

The PM defines acceptance criteria and scope. Engineers do not begin design
until the gate passes. After gate passes → **HUMAN CHECKPOINT A**.

---

## Stage 2 — Design (Principal + Dev input)

Step 2a — Principal drafts:
  Input: `pipeline/brief.md`
  Output: `pipeline/design-spec.md` (status: DRAFT)

Step 2b — Dev annotation (parallel, read-only):
  Each dev appends concerns to `pipeline/design-review-notes.md`.
  These are read-only passes — no code written yet.

Step 2c — Principal chairs review:
  Input: `pipeline/design-spec.md` + `pipeline/design-review-notes.md`
  Output: updated `pipeline/design-spec.md`, ADR files in `pipeline/adr/`
  Gate file: `pipeline/gates/stage-02.json`
  Gate keys: `"arch_approved": true` AND `"pm_approved": true`

After both approvals → **HUMAN CHECKPOINT B**.

---

## Stage 3 — Pre-Build Clarification

Check `pipeline/context.md` for any lines starting with `QUESTION:` that
lack a `PM-ANSWER:`. If any exist, invoke `pm` agent to answer them before
proceeding. If none, proceed immediately.

---

## Stage 9 — Retrospective (all roles + Principal synthesis)

Full protocol: see `.codex/rules/retrospective.md`.

Runs automatically after Stage 8 (PASS or FAIL) and after any red halt.

Step 9a — Contribution (parallel, read-heavy):
  Invoke in parallel: `pm`, `principal`, `dev-backend`, `dev-frontend`,
  `dev-platform`, `dev-qa`. When Stage 5b fired, also invoke `security`.
  Each appends a section to `pipeline/retrospective.md` using the
  four-heading template. Each produces one concrete lesson.

Step 9b — Synthesis:
  Invoke: `principal`
  Input: `pipeline/retrospective.md` + `pipeline/lessons-learned.md`
  Output: synthesis block prepended to retrospective, updated
  `pipeline/lessons-learned.md` (max 2 promotions, retire rules proved
  wrong or reinforced ≥5 times without defect).
  Gate file: `pipeline/gates/stage-09.json`
  Gate key: `"status": "PASS"` (informational)

After gate: the orchestrator prints the synthesis block and the list of
promoted/retired lessons to the user. No checkpoint — pipeline ends here.

---

## Stage Duration Expectations

Typical wall-clock targets for each stage on a full track run. These are
guidelines, not hard limits — the framework does not enforce timeouts on role
execution. If a stage seems stalled, use `npm run status` to check progress
and `npm run pipeline:context` for a full state dump.

| Stage | Typical Duration | Notes |
|-------|-----------------|-------|
| 1 — Requirements | 2–5 min | Single role (PM). Fast unless scope is ambiguous. |
| 2 — Design | 5–15 min | Sequential: draft → annotation → review. Longest non-build stage. |
| 3 — Clarification | <1 min | Pass-through if no open questions. |
| 4 — Build | 5–20 min | Parallel roles. Wall-clock = slowest workstream. Complexity-dependent. |
| 5 — Pre-review | 2–5 min | Automated checks. Depends on test suite and SCA scan speed. |
| 6 — Peer Review | 5–15 min | Reviewers reading peer PRs. Sequential fallback is slower. |
| 7 — QA | 3–10 min | Depends on test suite size and whether retries are needed. |
| 8 — Sign-off + Deploy | 3–10 min | Docker build + smoke tests. Network-dependent. |
| 9 — Retrospective | 3–8 min | Parallel contributions + Principal synthesis. |

**Full pipeline**: 28–88 minutes typical, depending on feature complexity.

**Stall indicators**:
- Stage 4 taking >30 min: check if a dev role hit an ambiguity and wrote a
  `QUESTION:` to `pipeline/context.md` without the orchestrator noticing.
- Stage 7 retry loops: check if the same test is failing repeatedly
  (auto-escalates after 3 identical failures).
- Any stage with no gate file written after 15 min: likely a context or
  permission issue. Check the role's output for errors.

---

## Parallel Execution Model

Stage 4 builds run as parallel role workstreams. How the parallelism is
realized depends on the execution profile — see
`.codex/rules/execution-profiles.md` for the full description.

**`local`**: roles run sequentially in the current checkout. Parallel
fan-out is simulated — each role's output files are staged before the next
role begins. Suitable for single-developer pairing sessions.

**`app_worktree`**: the Codex app creates isolated worktrees for each
build role. Roles receive disjoint write scopes and run concurrently. This
is the recommended profile for full-track runs where build parallelism
matters.

**`cloud`**: each Stage 4 role is dispatched as a self-contained cloud
task. The task prompt includes role, stage, files-to-read, allowed writes,
expected outputs, and verification commands. Tasks run independently and
return branch-ready diffs.

In all profiles, the orchestrator collects per-role gate files
(`pipeline/gates/stage-04-{area}.json`) before advancing to Stage 5. All
three must pass.

---

## Helper Commands

- `npm run quick -- "<change>"` starts a quick-track run.
- `npm run nano -- "<change>"` records a nano scope and starts the edit stage.
- `npm run config-only -- "<change>"` records config-only scope and starts platform edit.
- `npm run dep-update -- "<update>"` records dependency scope and starts platform edit.
- `npm run hotfix -- "<bug and fix>"` writes `pipeline/hotfix-spec.md` and starts build.
- `npm run review:derive` derives Stage 6 approval gates from review files.
- `npm run security:check -- <changed files>` decides whether security review is required.
- `npm run runbook:check` verifies `pipeline/runbook.md` before deploy.
- `npm run validate` runs syntax checks and latest-gate validation.
- `npm run budget -- init|update|check` manages budget tracking (opt-in).
- `npm run visualize` generates `pipeline/diagram.md` with Mermaid stateDiagram.

## Human Checkpoints

- Checkpoint A: after requirements (Stage 1)
- Checkpoint B: after design (Stage 2)
- Checkpoint C: after QA (Stage 7)

Checkpoint bypass requires an explicit user instruction or a configured
auto-pass condition in `.codex/config.yml`.
