const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const SCRIPT = path.resolve(__dirname, "..", "scripts", "approval-derivation.js");

describe("approval derivation", () => {
  let tmp;
  let reviewDir;
  let gatesDir;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-review-"));
    reviewDir = path.join(tmp, "pipeline", "code-review");
    gatesDir = path.join(tmp, "pipeline", "gates");
    fs.mkdirSync(reviewDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function run() {
    return execFileSync(process.execPath, [SCRIPT], {
      cwd: tmp,
      encoding: "utf8",
    });
  }

  function gate(name) {
    return JSON.parse(fs.readFileSync(path.join(gatesDir, name), "utf8"));
  }

  it("creates a review gate from an approval marker", () => {
    fs.writeFileSync(path.join(reviewDir, "by-frontend.md"), [
      "## Review of backend",
      "Looks good.",
      "REVIEW: APPROVED",
      "",
    ].join("\n"));

    const output = run();
    assert.match(output, /frontend -> APPROVED on backend/);
    assert.deepEqual(gate("stage-06-backend.json").approvals, ["frontend"]);
  });

  it("honors scoped gates with one required approval", () => {
    fs.mkdirSync(gatesDir, { recursive: true });
    fs.writeFileSync(path.join(gatesDir, "stage-06-backend.json"), JSON.stringify({
      stage: "stage-06-backend",
      status: "FAIL",
      agent: "codex-team",
      track: "quick",
      timestamp: "2026-04-29T12:00:00Z",
      blockers: [],
      warnings: [],
      area: "backend",
      review_shape: "scoped",
      required_approvals: 1,
      approvals: [],
      changes_requested: [],
      escalated_to_principal: false,
    }));
    fs.writeFileSync(path.join(reviewDir, "by-qa.md"), [
      "## Review of backend",
      "REVIEW: APPROVED",
      "",
    ].join("\n"));

    run();
    assert.equal(gate("stage-06-backend.json").status, "PASS");
  });

  it("records changes requested and removes prior approval", () => {
    fs.writeFileSync(path.join(reviewDir, "by-platform.md"), [
      "## Review of frontend",
      "REVIEW: APPROVED",
      "",
    ].join("\n"));
    run();
    fs.writeFileSync(path.join(reviewDir, "by-platform.md"), [
      "## Review of frontend",
      "BLOCKER: missing test",
      "REVIEW: CHANGES REQUESTED",
      "",
    ].join("\n"));
    run();

    const result = gate("stage-06-frontend.json");
    assert.deepEqual(result.approvals, []);
    assert.equal(result.changes_requested[0].reviewer, "platform");
  });

  // ── B-16 size-cap port ────────────────────────────────────────────

  it("skips an oversized review file with a WARN", () => {
    const reviewPath = path.join(reviewDir, "by-frontend.md");
    fs.writeFileSync(
      reviewPath,
      "## Review of backend\nREVIEW: APPROVED\n" + "x".repeat(1_100_000),
    );

    const result = spawnSync(process.execPath, [SCRIPT], {
      cwd: tmp,
      encoding: "utf8",
    });
    assert.match(result.stderr || "", /exceeds 1000000 bytes/);
    assert.equal(
      fs.existsSync(path.join(gatesDir, "stage-06-backend.json")),
      false,
      "oversized review file must not result in a gate write",
    );
  });

  it("refuses to clobber an oversized existing gate", () => {
    fs.mkdirSync(gatesDir, { recursive: true });
    const gatePath = path.join(gatesDir, "stage-06-backend.json");
    const oversize = {
      stage: "stage-06-backend",
      status: "FAIL",
      agent: "orchestrator",
      track: "full",
      timestamp: "2026-04-29T12:00:00Z",
      area: "backend",
      review_shape: "matrix",
      required_approvals: 2,
      approvals: [],
      changes_requested: [],
      escalated_to_principal: false,
      blockers: [],
      warnings: ["x".repeat(1_100_000)],
    };
    fs.writeFileSync(gatePath, JSON.stringify(oversize));
    const beforeBytes = fs.statSync(gatePath).size;

    fs.writeFileSync(path.join(reviewDir, "by-frontend.md"), [
      "## Review of backend",
      "REVIEW: APPROVED",
      "",
    ].join("\n"));

    const result = spawnSync(process.execPath, [SCRIPT], {
      cwd: tmp,
      encoding: "utf8",
    });
    assert.match(result.stderr || "", /refusing to clobber/);
    assert.equal(fs.statSync(gatePath).size, beforeBytes, "oversize gate must remain untouched");
  });
});
