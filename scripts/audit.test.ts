// Tests for scripts/audit.ts (TASK-314): `node --test scripts/audit.test.ts`.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { publishedAdvisories, publishedImporters, type Advisory } from "./audit.ts";

const roots: string[] = [];
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function advisory(module_name: string, paths: string[]): Advisory {
  return {
    module_name,
    severity: "high",
    title: "",
    url: "",
    findings: [{ version: "1.0.0", paths }],
  };
}

describe("publishedImporters", () => {
  it("lists the non-private packages under packages/", () => {
    const root = mkdtempSync(join(tmpdir(), "audit-"));
    roots.push(root);
    for (const [name, manifest] of Object.entries({
      lumiose: { name: "lumiose" },
      "site-kit": { name: "@lumiose/site-kit", private: true },
    })) {
      mkdirSync(join(root, "packages", name), { recursive: true });
      writeFileSync(join(root, "packages", name, "package.json"), JSON.stringify(manifest));
    }
    assert.deepEqual([...publishedImporters(root)], ["packages__lumiose"]);
  });
});

describe("publishedAdvisories", () => {
  it("keeps advisories reached from a published package and drops the rest", () => {
    const importers = new Set(["packages__vite"]);
    const found = publishedAdvisories(
      [
        advisory("esbuild", ["packages__vite>vite>esbuild"]),
        advisory("mysql2", ["examples__ssr-auth>mysql2", "benchmarks__ssr>mysql2"]),
      ],
      importers,
    );
    assert.deepEqual(
      found.map((item) => item.module_name),
      ["esbuild"],
    );
  });
});
