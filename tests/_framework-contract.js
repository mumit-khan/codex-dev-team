// Shared framework-contract lists used by multiple test files. Single
// source of truth for: rule files, skills, roles, adapters, and stage
// numbers/schemas. Update these when a part of the framework is added or
// removed; the tests that consume this module will then catch any other
// file that drifts out of sync.
//
// The filename does not end in `.test.js`, so `node --test tests/*.test.js`
// won't try to run it as a suite.

// Core rule files shared with the claude-dev-team sibling. Both sides
// split pipeline.md into the three pipeline-* sub-files (B-21).
const RULES = [
  "coding-principles",
  "compaction",
  "escalation",
  "gates",
  "orchestrator",
  "pipeline",
  "pipeline-core",
  "pipeline-build",
  "pipeline-tracks",
  "retrospective",
];

// Codex also has rule files that don't exist on the claude side. Kept
// separate so the shared RULES list stays portable; contract.test.js
// asserts these exist individually.
const CODEX_ONLY_RULES = ["execution-profiles", "roles"];

const SKILLS = [
  "api-conventions",
  "code-conventions",
  "implement",
  "pre-pr-review",
  "review-rubric",
  "security-checklist",
];

const ROLES = [
  "pm",
  "principal",
  "backend",
  "frontend",
  "platform",
  "qa",
  "security",
  "reviewer",
];

const ADAPTERS = [
  "docker-compose",
  "kubernetes",
  "terraform",
  "custom",
];

const STAGE_NUMBERS = [
  "stage-01",
  "stage-02",
  "stage-03",
  "stage-04",
  "stage-05",
  "stage-06",
  "stage-07",
  "stage-08",
  "stage-09",
];

const STAGE_SCHEMAS = STAGE_NUMBERS.map((s) => `${s}.schema.json`);

module.exports = {
  RULES,
  CODEX_ONLY_RULES,
  SKILLS,
  ROLES,
  ADAPTERS,
  STAGE_NUMBERS,
  STAGE_SCHEMAS,
};
