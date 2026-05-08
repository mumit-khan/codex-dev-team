# Pipeline — Index

The pipeline rules are split across three files for clarity and to let
roles load only the subset relevant to their stage. The split landed in
the parity-audit-driven 2026-05-07 work (item B-21).

| File | Covers | Read this when |
|---|---|---|
| **`pipeline-tracks.md`** | Stage 0: budget gate, track routing, safety stoplist, async-friendly checkpoints, track contracts | The orchestrator chooses a track or evaluates a checkpoint, or any caller checks the stoplist. |
| **`pipeline-core.md`** | Stages 1 (Requirements), 2 (Design), 3 (Pre-Build Clarification), 9 (Retrospective), Stage Duration Expectations, Parallel Execution Model, Helper Commands, Human Checkpoints | PM, Principal, the retro flow, or anyone wanting the helpers and execution-model overview. |
| **`pipeline-build.md`** | Stages 4 (Build), 5 (Pre-review checks), 6 (Peer Review), 7 (QA), 8 (Sign-off + Deploy) | Devs, reviewers, QA, security, platform on deploy. |

References elsewhere in the framework that say "see `.codex/rules/pipeline.md`
Stage X" are accurate at the conceptual level — Stage X exists in one of the
three sub-files, named in the table above. The orchestrator reads all three
on startup.

For convenience, this file used to be the monolith; role briefs and slash-
command rules that cite specific stages were left as-is during the split
(they describe stages, not file paths). New documentation should cite the
sub-file directly when possible (`pipeline-build.md §Stage 6`, not
`pipeline.md §Stage 6`).

## Related rules

- `.codex/rules/gates.md` — JSON schema for every gate file
- `.codex/rules/orchestrator.md` — orchestrator startup and routing
- `.codex/rules/escalation.md` — escalation protocol
- `.codex/rules/coding-principles.md` — binding dev principles
- `.codex/rules/retrospective.md` — Stage 9 protocol details
- `.codex/rules/compaction.md` — context compaction instructions
- `.codex/rules/execution-profiles.md` — local / app_worktree / cloud
  execution model
- `.codex/rules/roles.md` — role definitions
