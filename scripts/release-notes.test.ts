// Tests for scripts/release-notes.ts (TASK-277): `node --test scripts/release-notes.test.ts`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { releaseNotes } from "./release-notes.ts";

const CHANGELOG = `# Changelog

All Lumiose packages share one version.

## 0.4.0-rc.1 (2026-10-14)

### Features

- **vite:** a feature (abc1234)

## 0.3.0 (2026-10-13)

### Bug fixes

- **app:** a fix (def5678)

## 0.2.0 (2026-10-12)
`;

describe("releaseNotes", () => {
  it("is the version's section without its heading, then the install line", () => {
    assert.equal(
      releaseNotes(CHANGELOG, "0.3.0"),
      "### Bug fixes\n\n- **app:** a fix (def5678)\n\n" +
        "Every package is published to npm at 0.3.0. Start a project with `npm create lumiose@latest`.\n",
    );
  });

  it("matches the exact version, pre-releases included", () => {
    assert.match(
      releaseNotes(CHANGELOG, "0.4.0-rc.1")!,
      /^### Features\n\n- \*\*vite:\*\* a feature/,
    );
    assert.equal(releaseNotes(CHANGELOG, "0.4.0"), undefined);
    assert.equal(releaseNotes(CHANGELOG, "0.3"), undefined);
  });

  it("says so for an empty section, the last one included", () => {
    assert.match(releaseNotes(CHANGELOG, "0.2.0")!, /^No notable changes\.\n\n/);
  });
});
