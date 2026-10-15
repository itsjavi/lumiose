// The generator is deterministic (TASK-319): the same options write the same files.
import { strict as assert } from "node:assert";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test } from "node:test";
import { generateApp } from "./generate.ts";

/** Every file below `dir`, as path → content. */
function snapshot(dir: string): Map<string, string> {
  const files = readdirSync(dir, { recursive: true, withFileTypes: true }).filter((entry) =>
    entry.isFile(),
  );
  return new Map(
    files.map((entry) => {
      const path = join(entry.parentPath, entry.name);
      return [relative(dir, path), readFileSync(path, "utf8")];
    }),
  );
}

test("the same options write the same app, and another seed another one", () => {
  const dirs = [0, 1, 2].map(() => mkdtempSync(join(tmpdir(), "lumiose-large-app-test-")));
  try {
    const options = { routes: 120, components: 400 };
    const [first, second, other] = [
      generateApp(dirs[0]!, options),
      generateApp(dirs[1]!, options),
      generateApp(dirs[2]!, { ...options, seed: 2 }),
    ];
    assert.deepEqual(first, second);
    assert.deepEqual(snapshot(dirs[0]!), snapshot(dirs[1]!));
    assert.notDeepEqual(snapshot(dirs[0]!), snapshot(dirs[2]!));
    assert.equal(first.routes, 120);
    assert.equal(first.components, 400);
    assert.ok(first.islands > 0);
    // The HMR targets are on the page the dev measurement loads.
    assert.equal(other.firstPage, other.hmr.path);
  } finally {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  }
});
