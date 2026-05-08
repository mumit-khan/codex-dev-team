const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

// Codex's adapter set. Pre-existing list; no shared module yet (ports
// the framework-contract pattern from claude's audit B-10 — not yet
// implemented on the codex side).
const ADAPTERS = ["docker-compose", "kubernetes", "terraform", "custom"];

// Each adapter document is the contract dev-platform follows at deploy.
// Missing any of these sections risks a runtime ESCALATE rather than a CI
// failure. Headings matched flexibly to tolerate small spelling drift; an
// exact-match contract would force a normalisation pass on the existing
// files (e.g. "Smoke Test Results" vs "Smoke test results" vs "Smoke
// tests"), which is a separate concern.
//
// Codex adapter structure differs from claude's: codex has Assumptions,
// Config, Procedure, a smoke-test section, and Recovery procedure (no
// Runbook hooks section like claude). Test asserts the codex contract,
// not claude's.
const REQUIRED_SECTIONS = [
  { name: "Assumptions", re: /^##\s+Assumptions\b/im },
  { name: "Config", re: /^##\s+Config\b/im },
  { name: "Procedure", re: /^##\s+Procedure\b/im },
  { name: "Smoke test", re: /^##\s+smoke[\s_-]*tests?/im },
  { name: "Recovery procedure", re: /^##\s+Recovery procedure\b/im },
];

describe("adapter contract", () => {
  for (const name of ADAPTERS) {
    describe(`${name} adapter`, () => {
      const filePath = path.join(ROOT, ".codex", "adapters", `${name}.md`);
      const body = fs.existsSync(filePath)
        ? fs.readFileSync(filePath, "utf8")
        : "";

      it(`has an # Adapter: ${name} title`, () => {
        assert.ok(body.length > 0, `missing file: .codex/adapters/${name}.md`);
        assert.match(body, new RegExp(`^#\\s+Adapter:\\s+${name}\\b`, "im"));
      });

      for (const section of REQUIRED_SECTIONS) {
        it(`includes a "${section.name}" section`, () => {
          assert.match(
            body,
            section.re,
            `${name}.md missing required section: ${section.name}`,
          );
        });
      }
    });
  }
});
