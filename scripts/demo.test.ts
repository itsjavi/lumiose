// Tests for scripts/demo.ts (TASK-184): `node --test scripts/demo.test.ts`.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import {
  discover,
  findUrl,
  formatList,
  portMode,
  rank,
  resolve,
  steps,
  type Demo,
} from "./demo.ts";

const repo = join(import.meta.dirname, "..");

function workspace(packages: Record<string, object>, globs: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "demo-test-"));
  writeFileSync(
    join(root, "pnpm-workspace.yaml"),
    `packages:\n${globs.map((g) => `  - ${g}`).join("\n")}\nallowBuilds:\n  foo: false\n`,
  );
  for (const [dir, manifest] of Object.entries(packages)) {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, dir, "package.json"), JSON.stringify(manifest));
  }
  return root;
}

const fixture = workspace(
  {
    "examples/shop": {
      name: "@x-examples/shop",
      scripts: { dev: "lumiose dev", build: "lumiose build", preview: "lumiose preview" },
    },
    "examples/router-e2e": { name: "@x/router-e2e", scripts: { dev: "lumiose dev" } },
    "examples/no-server": { name: "@x/no-server", scripts: { build: "vite build" } },
    "examples/hidden": { name: "@x/hidden", demo: false, scripts: { dev: "vite" } },
    "apps/web": { name: "@x/web", demo: { title: "Website" }, scripts: { dev: "lumiose dev" } },
    "bench/app": {
      name: "@b/app",
      demo: { name: "tracker", title: "Tracker", kind: "benchmark", setup: ["seed"] },
      scripts: {
        seed: "seed",
        dev: "next dev --port ${PORT:-4103}",
        build: "next build",
        start: "node server.ts",
      },
    },
    "tools/viewer": {
      name: "viewer",
      demo: { kind: "eval", port: "flag" },
      scripts: { view: "node src/view.ts" },
    },
    "other/ignored": { name: "ignored", scripts: { dev: "vite" } },
  },
  ["examples/*", "apps/*", "bench/app", "tools/viewer", "missing/*"],
);
after(() => rmSync(fixture, { recursive: true, force: true }));

describe("discover", () => {
  const demos = discover(fixture);
  const byName = (name: string) => demos.find((demo) => demo.name === name);

  it("finds the workspace packages with a serving script, grouped by kind", () => {
    assert.deepEqual(
      demos.map((demo) => [demo.name, demo.kind]),
      [
        ["shop", "example"],
        ["web", "site"],
        ["tracker", "benchmark"],
        ["viewer", "eval"],
        ["router-e2e", "e2e"],
      ],
    );
  });

  it("reads the metadata and picks the scripts", () => {
    assert.equal(byName("web")!.title, "Website");
    assert.deepEqual(byName("shop")!.prod, { build: "build", serve: "preview" });
    assert.equal(byName("router-e2e")!.prod, null);
    assert.deepEqual(byName("tracker")!.prod, { build: "build", serve: "start" });
    assert.deepEqual(byName("viewer")!.prod, { build: null, serve: "view" });
    assert.equal(byName("viewer")!.dev, "view");
  });

  it("lists every HTML-serving package of this repo", () => {
    const names = discover(repo).map((demo) => demo.name);
    for (const name of [
      "spa-chiptune",
      "ssr-bookshelf",
      "ssg-travel-journal",
      "web",
      "playground",
      "bench-viewer",
      "tracker-lumiose",
      "tracker-next",
      "eval-viewer",
      "islands-e2e",
      "spa-router-e2e",
    ]) {
      assert.ok(names.includes(name), `${name} is listed`);
    }
    assert.ok(!names.includes("compiler"));
  });

  it("formats a grouped, numbered list", () => {
    const list = formatList(demos);
    assert.match(list, /^Examples\n {3}1\. shop/);
    assert.match(list, /E2E test apps\n {3}5\. router-e2e/);
  });
});

describe("matching", () => {
  const demos = discover(repo);
  const pick = (query: string) => {
    const found = resolve(demos, query);
    return "demo" in found ? found.demo.name : found.candidates.map((demo) => demo.name);
  };

  it("matches exact names, prefixes, words, substrings and subsequences", () => {
    assert.equal(pick("web"), "web");
    assert.equal(pick("chip"), "spa-chiptune");
    assert.equal(pick("bookshelf"), "ssr-bookshelf");
    assert.equal(pick("journal"), "ssg-travel-journal");
    assert.equal(pick("tnext"), "tracker-next");
    assert.equal(pick("eval"), "eval-viewer");
    assert.equal(pick("dotmatrix"), "spa-dotmatrix");
  });

  it("reports ambiguous and unknown queries", () => {
    assert.ok(Array.isArray(pick("tracker")));
    assert.deepEqual(pick("zzzz"), []);
    assert.equal(rank(demos, "zzzz").length, 0);
  });
});

const demo = (overrides: Partial<Demo>): Demo => ({
  name: "x",
  title: "X",
  kind: "example",
  pkg: "x",
  dir: "x",
  dev: "dev",
  prod: { build: "build", serve: "preview" },
  scripts: { dev: "lumiose dev", build: "lumiose build", preview: "lumiose preview" },
  port: null,
  setup: [],
  ...overrides,
});

describe("running", () => {
  it("decides how a script takes a port", () => {
    assert.equal(portMode("lumiose dev"), "flag");
    assert.equal(portMode("node src/seed.ts && lumiose dev"), "flag");
    assert.equal(portMode("next dev --port ${PORT:-4103}"), "env");
    assert.equal(portMode("NODE_ENV=production node server.ts"), "flag");
    assert.equal(portMode("node server.ts"), "env");
  });

  it("plans dev and production runs", () => {
    assert.deepEqual(steps(demo({}), { prod: false, port: 5000 }), [
      { script: "dev", args: ["--port", "5000"] },
    ]);
    assert.deepEqual(steps(demo({}), { prod: true }), [
      { script: "build", args: [] },
      { script: "preview", args: [] },
    ]);
    const tracker = demo({
      setup: ["seed"],
      prod: { build: "build", serve: "start" },
      scripts: {
        dev: "next dev --port ${PORT:-4103}",
        build: "next build",
        start: "node server.ts",
      },
    });
    assert.deepEqual(steps(tracker, { prod: false, port: 5000 }), [
      { script: "seed", args: [] },
      { script: "dev", args: [] },
    ]);
    assert.deepEqual(
      steps(demo({ port: "flag", dev: "view", scripts: { view: "node v.ts" } }), {
        prod: false,
        port: 9,
      }),
      [{ script: "view", args: ["--port", "9"] }],
    );
    assert.throws(() => steps(demo({ prod: null }), { prod: true }), /no production server/);
  });

  it("finds the URL a server prints", () => {
    assert.equal(
      findUrl(
        "  \u001b[32m➜\u001b[39m  Local:   \u001b[36mhttp://localhost:\u001b[1m5199\u001b[22m/\u001b[39m",
      ),
      "http://localhost:5199/",
    );
    assert.equal(findUrl("Results viewer: http://127.0.0.1:4100/"), "http://127.0.0.1:4100/");
    assert.equal(findUrl("listening on http://0.0.0.0:3000."), "http://localhost:3000");
    assert.equal(findUrl('{"url":"http://localhost:4173/"}'), "http://localhost:4173/");
    assert.equal(findUrl("no url here"), null);
  });
});
