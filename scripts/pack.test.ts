// Tests for scripts/pack.ts (TASK-39): `node --test scripts/pack.test.ts`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  distTag,
  publishable,
  publishOrder,
  publishTarballs,
  tarballProblems,
  type Manifest,
} from "./pack.ts";

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
const FILES = [
  "LICENSE",
  "README.md",
  "package.json",
  "dist/index.js",
  "dist/index.d.ts",
  "dist/bin.js",
  "dist/a/b.js",
];

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

  it("accepts TypeScript exports of a package that ships its sources (@lumiose/ui)", () => {
    const ui = manifest({
      name: "@lumiose/ui",
      exports: { ".": "./dist/index.ts", "./dialog": "./dist/dialog/dialog.tsx" },
      bin: {},
    });
    const files = [
      "LICENSE",
      "README.md",
      "package.json",
      "dist/index.ts",
      "dist/dialog/dialog.tsx",
    ];
    assert.deepEqual(tarballProblems(ui, files), []);
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

  it("reports a missing LICENSE, README and main", () => {
    const problems = tarballProblems(
      manifest({ main: "compiler.linux-x64-gnu.node" }),
      FILES.filter((file) => file !== "LICENSE" && file !== "README.md"),
    );
    assert.deepEqual(problems, [
      "no LICENSE",
      "no README.md",
      "a native binary without os and cpu",
      "export or bin compiler.linux-x64-gnu.node: missing",
    ]);
  });

  it("reports a WASI binary that package managers would install next to a native one", () => {
    const wasi = (fields: Partial<Manifest>): Manifest => ({
      name: "@lumiose/compiler-wasm32-wasi",
      version: "1.2.3",
      main: "compiler.wasi.cjs",
      ...fields,
    });
    const files = ["LICENSE", "README.md", "package.json", "compiler.wasi.cjs"];
    assert.deepEqual(tarballProblems(wasi({}), files), ["a WASI binary without cpu wasm32"]);
    assert.deepEqual(tarballProblems(wasi({ cpu: ["wasm32"] }), files), []);
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

const item = (name: string, fields: Partial<Manifest> = {}) => ({
  manifest: { name, version: "1.0.0", ...fields },
});

describe("publishOrder", () => {
  it("publishes each package after the internal packages it depends on", () => {
    const order = publishOrder([
      item("create-lumiose", { dependencies: { "@lumiose/cli": "1.0.0", lumiose: "1.0.0" } }),
      item("@lumiose/cli", { dependencies: { "@lumiose/vite": "1.0.0", commander: "1" } }),
      item("@lumiose/vite", { dependencies: { "@lumiose/compiler": "1.0.0", lumiose: "1.0.0" } }),
      item("lumiose"),
      item("@lumiose/compiler", {
        optionalDependencies: { "@lumiose/compiler-linux-x64-gnu": "1.0.0" },
      }),
      item("@lumiose/compiler-linux-x64-gnu"),
    ]).map((p) => p.manifest.name);
    assert.deepEqual(order, [
      "@lumiose/compiler-linux-x64-gnu",
      "@lumiose/compiler",
      "lumiose",
      "@lumiose/vite",
      "@lumiose/cli",
      "create-lumiose",
    ]);
  });

  it("rejects dependency cycles", () => {
    assert.throws(
      () =>
        publishOrder([
          item("a", { dependencies: { b: "1.0.0" } }),
          item("b", { peerDependencies: { a: "1.0.0" } }),
        ]),
      /dependency cycle/,
    );
  });
});

describe("distTag", () => {
  it("tags prereleases next and releases latest", () => {
    assert.equal(distTag("0.1.0"), "latest");
    assert.equal(distTag("0.2.0-rc.1"), "next");
  });
});

describe("publishTarballs", () => {
  it("skips versions npm already has, without calling npm publish", () => {
    const asked: string[] = [];
    const packed = [
      item("lumiose"),
      item("@lumiose/vite", { dependencies: { lumiose: "1.0.0" } }),
    ].map((p) => ({ ...p, name: p.manifest.name, tarball: "/nonexistent.tgz" }));
    const failures = publishTarballs(packed, {
      dryRun: true,
      published: (name, version) => (asked.push(`${name}@${version}`), true),
    });
    assert.deepEqual(failures, []);
    assert.deepEqual(asked, ["lumiose@1.0.0", "@lumiose/vite@1.0.0"]);
  });
});
