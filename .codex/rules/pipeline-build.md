# Pipeline Build (Stages 4–8)

The implementation half of the pipeline: build, pre-review, peer code
review, QA, sign-off, and deploy. Stages 1–3 + 9 + duration + execution
model + helpers live in `pipeline-core.md`. Track routing and the safety
stoplist live in `pipeline-tracks.md`. The full index is in `pipeline.md`.

## Stage 4 — Build (parallel role workstreams)

Invoke in parallel (using Codex app worktrees or cloud task fan-out —
see Execution Profiles):

  `dev-backend`  → `src/backend/`  → `pipeline/pr-backend.md`
  `dev-frontend` → `src/frontend/` → `pipeline/pr-frontend.md`
  `dev-platform` → `src/infra/`    → `pipeline/pr-platform.md`

Gate file per PR: `pipeline/gates/stage-04-{area}.json`
All three must have `"status": "PASS"` before proceeding.

---

## Stage 5 — Pre-review checks

Between Stage 4 (build) and Stage 6 (peer code review), two automated
gates must pass. These catch issues the toolchain already knows about
before reviewer attention is spent on them.

### Stage 5a — Pre-review gate (lint + type-check + SCA)

Invoke: `dev-platform` role.
Scope: lint, type-check, dependency vulnerability scan, license allowlist.
Output: `pipeline/gates/stage-05.json`.
Gate key: `"status": "PASS"` with `"lint_passed": true`,
`"tests_passed": true`, and no `high`/`critical` SCA findings.

On failure, the owning dev (identified from the failing check) is re-invoked
to fix. Stage 6 does not start until this gate passes.

### Stage 5b — Security review (conditional)

Invoke the `security` role **only when** the triggering heuristic fires. The
heuristic matches any of:

- Paths: `src/backend/auth*`, `src/backend/crypto*`, `src/backend/payment*`,
  `src/backend/pii*`, `src/backend/session*`, or any file named with
  `*secret*` / `*token*` / `*credential*`
- New or upgraded dependencies in `package.json`, `requirements.txt`, etc.
- Changes to `Dockerfile` or `docker-compose*.yml` that add/modify a service
  image, network, or volume
- Files under `src/infra/` that affect network topology, IAM/RBAC,
  TLS/certificates, secrets management, or CI/CD secret handling
- New or changed database migrations
- New environment variables or secret references in `.env.example`

If the heuristic does not fire, the security gate is skipped and the
orchestrator records the skip decision in `pipeline/context.md` under
`## Brief Changes` as `SECURITY-SKIP: <reason>`.

A `veto: true` gate halts the pipeline. No peer-review approval can override
a veto — the security reviewer must personally re-review the fix and flip the
flag.

Both 5a and 5b must pass (when applicable) before Stage 6 begins.

---

## Stage 6 — Peer Code Review

### Review shape — scoped vs matrix

Before Stage 6 begins, the orchestrator inspects the diff and picks one
of two review shapes, then writes the chosen shape into each stage-06
gate's `"review_shape"` and `"required_approvals"` fields.

**Scoped review** — `review_shape: "scoped"`, `required_approvals: 1`.

Used when the diff is **area-contained**: every changed file lives under
one of `src/backend/`, `src/frontend/`, `src/infra/`, or `src/tests/`,
with no cross-area edits. One reviewer from a different area is sufficient.
The pairing convention:

| Owning area     | Default reviewer     |
|-----------------|----------------------|
| `src/backend/`  | `dev-platform`       |
| `src/frontend/` | `dev-backend`        |
| `src/infra/`    | `dev-backend`        |
| `src/tests/`    | `dev-backend`        |

**Gate pre-creation (required for scoped reviews).** Before invoking the
reviewer, the orchestrator must write `pipeline/gates/stage-06-{area}.json`
with `"required_approvals": 1` and `"review_shape": "scoped"`. The
`approval-derivation.js` hook defaults newly-created gates to
`required_approvals: 2`. If the gate doesn't pre-exist with the correct
value, the hook creates a matrix gate and a single approval never flips the
status to PASS.

**Matrix review** — `review_shape: "matrix"`, `required_approvals: 2`.

Used when the diff touches more than one area. The original matrix applies:
  `dev-backend`  reviews: frontend + platform → writes `pipeline/code-review/by-backend.md`
  `dev-frontend` reviews: backend + platform  → writes `pipeline/code-review/by-frontend.md`
  `dev-platform` reviews: backend + frontend  → writes `pipeline/code-review/by-platform.md`

Each area's stage-06 gate accumulates two approvals from reviewers whose
own area is different.

### Review file format

Reviewers write per-area sections inside their review file, each ending with
a `REVIEW: APPROVED` or `REVIEW: CHANGES REQUESTED` marker on its own line:

```markdown
# Review by <reviewer-name>

## Review of backend
<comments, BLOCKER/SUGGESTION/QUESTION entries>

REVIEW: APPROVED

## Review of platform
<comments>

REVIEW: CHANGES REQUESTED
BLOCKER: <text>
```

The `approval-derivation.js` hook parses these sections after the reviewer
writes the file and updates `pipeline/gates/stage-06-<area>.json`
accordingly. **Agents no longer author the `approvals` or `changes_requested`
fields directly** — the hook is the single writer.

### READ-ONLY Reviewer Rule (strictly enforced)

During a Stage 6 review invocation, a reviewer agent writes ONLY to:
  - `pipeline/code-review/by-{reviewer}.md` (their review file)
  - `pipeline/gates/stage-06-{area}.json` (append-only approval gate)

A reviewer agent MUST NOT:
  - Use `Write` or `Edit` on any file under `src/`
  - Amend or refactor the author's code, even for a "one-line obvious fix"
  - Add themselves to `approvals` in a stage-06 gate if they modified any
    source file during the same invocation — the gate is then invalid

If the reviewer finds a bug or other BLOCKER: they write
`REVIEW: CHANGES REQUESTED` in their review file, list the blocker, and
halt. The orchestrator re-invokes the owning dev role to fix it in their
own workstream.

Rationale: silent inline fixes bypass the owning dev, skip re-review of
the patched lines, and leave no audit trail tying the patch to a
CHANGES-REQUESTED → addressed loop.

### Gate merge strategy (hook-derived)

Each area gate (`pipeline/gates/stage-06-{area}.json`) accumulates approvals
via `approval-derivation.js`, not via agent self-write. The gate reaches
`"status": "PASS"` when:

- `approvals.length >= required_approvals` (1 for scoped, 2 for matrix)
- `changes_requested` is empty

An agent that manually edits the `approvals` array is running around the
integrity model. The hook runs on every file save and reconciles the gate to
the review file; any direct edit will be overwritten on the next reviewer's
file save. Don't fight it.

### Review round limit

To prevent an unbounded review-fix spiral, the orchestrator enforces a
**two-round maximum** per area per pipeline run:

- **Round 1**: reviewer writes `CHANGES REQUESTED` → owning dev fixes →
  reviewer re-reviews.
- **Round 2**: if the same reviewer writes `CHANGES REQUESTED` again on the
  same area, the orchestrator **must not** invoke the dev a third time.
  Instead it invokes `principal` with the two review files, the dev's PR
  file, and the brief and design spec.

The Principal makes a binding ruling: either the blocker is resolved (dev
implements Principal's ruling and the reviewer approves), or the pipeline
FAILs with an explicit rejection. The round counter resets if a different
reviewer takes over the area. Record the escalation in `pipeline/context.md`
as `REVIEW-ESCALATED: <area> after 2 rounds — principal ruling requested`.

Pre-read requirement (pass to each reviewer):
  - `pipeline/brief.md`
  - `pipeline/design-spec.md`
  - `pipeline/adr/` (all files)
  - The other reviewer's file if already written (sequential fallback)

On architectural escalation or deadlock: invoke `principal`. Principal ruling
is binding.

---

## Stage 7 — QA

Invoke: `dev-qa` role
Input: `src/` + `pipeline/brief.md` (acceptance criteria)
Output: `pipeline/test-report.md`
Gate file: `pipeline/gates/stage-07.json`
Gate keys:
- `"status": "PASS"` with `"all_acceptance_criteria_met": true`
- `"criterion_to_test_mapping_is_one_to_one": true | false` — this drives
  the Stage 8 auto-fold

On failure: identify owning dev from the failing test's path (dev-qa writes
`"assigned_retry_to"` in the gate), invoke that dev with the failure context.
Retry limit: 3 cycles. On 3rd identical failure, auto-escalate to `principal`.

After gate passes → **HUMAN CHECKPOINT C**.

---

## Stage 8 — Sign-off and Deploy (adapter-driven)

Invoke: `dev-platform` role.
Preconditions:
- PM sign-off confirmed
- `pipeline/runbook.md` exists and has `## Rollback` + `## Health signals`
  sections
- `.codex/config.yml` names a valid adapter in `deploy.adapter`

Stage 8 is adapter-driven. The dev-platform role reads the selected adapter's
instructions from `.codex/adapters/<adapter>.md` and follows them.
Built-in adapters: `docker-compose` (default), `kubernetes`, `terraform`,
`custom`. See `.codex/adapters/README.md` for the contract.

Output:
- `pipeline/deploy-log.md` — human-readable, includes a runbook pointer
- `pipeline/gates/stage-08.json` — gate with fields `adapter`, `environment`,
  `smoke_test_passed`, `runbook_referenced`, and an adapter-specific
  `adapter_result` block

Gate key: `"status": "PASS"` AND `"runbook_referenced": true`.

On failure: do NOT auto-rollback. The deploy log points to the runbook's
`§Rollback` section; the orchestrator surfaces that pointer and the user
decides.

### Auto-fold from Stage 7

When Stage 7 maps every acceptance criterion 1:1 to a passing test and sets
`"all_acceptance_criteria_met": true`, the orchestrator auto-writes the PM
sign-off portion of Stage 8 without invoking the PM:

```json
{
  "stage": "stage-08",
  "status": "PASS",
  "pm_signoff": true,
  "auto_from_stage_07": true,
  "track": "<track>",
  "agent": "orchestrator",
  "timestamp": "<ISO>",
  "blockers": [],
  "warnings": []
}
```

The auto-fold is skipped (and the PM invoked normally) when:
- `"all_acceptance_criteria_met"` is not `true` in Stage 7
- Stage 7 does not have a 1:1 criterion-to-test mapping
- The user explicitly requested a manual sign-off
- The track is `hotfix` (hotfixes always require PM sign-off)

Post-deploy: invoke `pm` role to write stakeholder summary.
