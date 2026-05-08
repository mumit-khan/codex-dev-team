const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync, spawn } = require("node:child_process");

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

  // ── B-14 concurrency port ──────────────────────────────────────────

  function hookContext(filePath) {
    return JSON.stringify({
      hook_event_name: "PostToolUse",
      tool_name: "Write",
      tool_input: { file_path: filePath },
    });
  }

  it("two concurrent reviewer hooks both land in the same gate without corruption", async () => {
    const frontendFile = path.join(reviewDir, "by-frontend.md");
    const platformFile = path.join(reviewDir, "by-platform.md");
    fs.writeFileSync(
      frontendFile,
      ["## Review of backend", "Looks good.", "", "REVIEW: APPROVED", ""].join("\n"),
    );
    fs.writeFileSync(
      platformFile,
      ["## Review of backend", "Smoke check passes.", "", "REVIEW: APPROVED", ""].join("\n"),
    );

    fs.mkdirSync(gatesDir, { recursive: true });
    fs.writeFileSync(
      path.join(gatesDir, "stage-06-backend.json"),
      JSON.stringify({
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
        warnings: [],
      }, null, 2),
    );

    function spawnHook(stdinPayload) {
      return new Promise((resolve) => {
        const child = spawn("node", [SCRIPT], {
          cwd: tmp,
          stdio: ["pipe", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => { stdout += chunk; });
        child.stderr.on("data", (chunk) => { stderr += chunk; });
        child.on("close", (code) => resolve({ status: code, stdout, stderr }));
        child.stdin.write(stdinPayload);
        child.stdin.end();
      });
    }

    const [first, second] = await Promise.all([
      spawnHook(hookContext(frontendFile)),
      spawnHook(hookContext(platformFile)),
    ]);

    assert.equal(first.status, 0, `first exit ${first.status}: ${first.stderr}`);
    assert.equal(second.status, 0, `second exit ${second.status}: ${second.stderr}`);

    const gate = JSON.parse(
      fs.readFileSync(path.join(gatesDir, "stage-06-backend.json"), "utf8"),
    );
    assert.equal(gate.approvals.length, 2, `expected 2 approvals, got ${JSON.stringify(gate.approvals)}`);
    assert.ok(gate.approvals.includes("frontend"));
    assert.ok(gate.approvals.includes("platform"));
    assert.equal(gate.changes_requested.length, 0);
    assert.equal(gate.status, "PASS", "gate should reach PASS once both approvals land");

    const lockFile = path.join(gatesDir, "stage-06-backend.json.lock");
    assert.equal(
      fs.existsSync(lockFile),
      false,
      "lock file must be removed after the second hook exits",
    );
  });

  // ── B-23 structured-log mode port ─────────────────────────────────

  it("emits one JSON event line per gate update when LOG_FORMAT=json", () => {
    fs.writeFileSync(path.join(reviewDir, "by-frontend.md"), [
      "## Review of backend",
      "REVIEW: APPROVED",
      "",
    ].join("\n"));

    const result = spawnSync(process.execPath, [SCRIPT], {
      cwd: tmp,
      encoding: "utf8",
      env: { ...process.env, LOG_FORMAT: "json" },
    });
    assert.equal(result.status, 0);
    const jsonLine = (result.stdout || "").split("\n").find((l) => l.startsWith("{"));
    assert.ok(jsonLine, `expected a JSON event line in stdout:\n${result.stdout}`);
    const event = JSON.parse(jsonLine);
    assert.equal(event.hook, "approval-derivation");
    assert.equal(event.event, "gate_updated");
    assert.equal(event.area, "backend");
    assert.equal(event.reviewer, "frontend");
    assert.equal(event.verdict, "APPROVED");
    assert.match(event.ts, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("emits no JSON when LOG_FORMAT is unset", () => {
    fs.writeFileSync(path.join(reviewDir, "by-frontend.md"), [
      "## Review of backend",
      "REVIEW: APPROVED",
      "",
    ].join("\n"));
    const result = spawnSync(process.execPath, [SCRIPT], { cwd: tmp, encoding: "utf8" });
    assert.equal(result.status, 0);
    const jsonLines = (result.stdout || "").split("\n").filter((l) => l.trim().startsWith("{"));
    assert.equal(jsonLines.length, 0);
  });
});
