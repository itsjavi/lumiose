// Tests for scripts/publish.ts: `node --test scripts/publish.test.ts`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { taggedPackage, tagProblem } from "./publish.ts";

describe("release tags", () => {
  it("a v<x.y.z> tag publishes the lockstep packages at that version", () => {
    assert.equal(taggedPackage("v0.4.0"), undefined);
    assert.equal(tagProblem("v0.4.0", "0.4.0"), undefined);
    assert.equal(tagProblem("v0.4.1", "0.4.0"), "tag v0.4.1 does not match the version 0.4.0");
    // A manual run (a branch name) checks no tag.
    assert.equal(tagProblem("main", "0.4.0"), undefined);
    assert.equal(tagProblem(undefined, "0.4.0"), undefined);
  });

  it("a <name>@<x.y.z> tag publishes that package outside lockstep (TASK-333)", () => {
    assert.equal(taggedPackage("@lumiose/ui@0.2.0"), "@lumiose/ui");
    assert.equal(tagProblem("@lumiose/ui@0.2.0", "0.2.0"), undefined);
    assert.equal(
      tagProblem("@lumiose/ui@0.2.0", "0.1.0"),
      "tag @lumiose/ui@0.2.0 does not match @lumiose/ui's version 0.1.0",
    );
  });
});
