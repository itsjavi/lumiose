// Tests for scripts/pack.ts (TASK-39): `node --test scripts/pack.test.ts`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { publishable, tarballProblems, type Manifest } from "./pack.ts";

const manifest = (fields: Partial<Manifest> = {}): Manifest => ({
  name: "@lumiose/example",
  version: "1.2.3",
  exports: {
    ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
    "./internal/*.ts": { types: "./dist/*.d.ts", default: "./dist/*.js" },
    "./package.json": "./package.json",
  },
  bin: { example: "./dist/bin.js" },
  dependencies: { lumiose: "1.2.3" },
  ...fields,
});
const FILES = ["package.json", "dist/index.js", "dist/index.d.ts", "dist/bin.js", "dist/a/b.js"];

describe("tarballProblems", () => {
  it("accepts built files with every export and bin", () => {
    assert.deepEqual(tarballProblems(manifest(), FILES), []);
  });

  it("reports sources, tests, fixtures and test helpers", () => {
    const files = [
      ...FILES,
      "src/index.ts",
      "dist/index.test.js",
      "dist/check/__fixtures__/app/a.js",
      "dist/test-links.js",
      "tsconfig.build.json",
    ];
    assert.deepEqual(tarballProblems(manifest(), files), [
      "ships src/index.ts",
      "ships dist/index.test.js",
      "ships dist/check/__fixtures__/app/a.js",
      "ships dist/test-links.js",
      "ships tsconfig.build.json",
    ]);
  });

  it("accepts template sources outside the package's src/", () => {
    assert.deepEqual(tarballProblems(manifest(), [...FILES, "templates/app/src/index.stsx"]), []);
  });

  it("reports missing or TypeScript exports and bins", () => {
    const problems = tarballProblems(
      manifest({ bin: { example: "./src/bin.ts" } }),
      FILES.filter((file) => file !== "dist/index.d.ts"),
    );
    assert.deepEqual(problems, [
      "export or bin ./dist/index.d.ts: missing",
      "export or bin ./src/bin.ts: missing",
      "export or bin ./src/bin.ts: TypeScript source",
    ]);
  });

  it("reports wildcard exports without files, private packages and workspace specifiers", () => {
    const problems = tarballProblems(
      manifest({
        private: true,
        exports: { "./internal/*.ts": "./lib/*.js" },
        dependencies: { lumiose: "workspace:*" },
        peerDependencies: { vite: "^8.3.0" },
      }),
      FILES,
    );
    assert.deepEqual(problems, [
      "is private",
      "export ./lib/*.js: no files",
      "dependencies.lumiose: workspace:*",
    ]);
  });
});

describe("publishable", () => {
  it("lists the public packages, each with publishConfig exports for its exports", () => {
    const dirs = publishable();
    const names = dirs.map(
      (dir) => (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest).name,
    );
    for (const name of [
      "lumiose",
      "@lumiose/vite",
      "@lumiose/cli",
      "@lumiose/compiler",
      "create-lumiose",
    ]) {
      assert.ok(names.includes(name), name);
    }
    for (const dir of dirs) {
      const json = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest & {
        publishConfig?: { exports?: Record<string, unknown> };
      };
      if (json.exports === undefined || json.name === "@lumiose/compiler") continue;
      const published = Object.keys(json.publishConfig?.exports ?? {});
      for (const key of Object.keys(json.exports)) {
        assert.ok(
          published.includes(key === "./internal/*" ? "./internal/*.ts" : key),
          `${json.name} ${key}`,
        );
      }
    }
  });
});
