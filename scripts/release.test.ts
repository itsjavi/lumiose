// Tests for scripts/release.ts (TASK-183): `node --test scripts/release.test.ts`.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import {
  compareVersions,
  parseCommit,
  pinInternalDependencies,
  prependChangelog,
  release,
  renderChangelog,
  renderScale,
  scaleRegressions,
  setCargoLockVersions,
  setCargoVersion,
  setDocsVersion,
  setLoaderVersion,
  setPackageVersion,
  type ScaleResult,
} from "./release.ts";

/** A runner of the A/B that must not run. */
function never(): ScaleResult {
  throw new Error("the A/B ran");
}

/** A large-app A/B result with the given ratios (buildMs, devColdStartMs, hmrMs, serverMemoryMb). */
function scaleResult(ratios: [number, number, number, number]): ScaleResult {
  const keys = ["buildMs", "devColdStartMs", "hmrMs", "serverMemoryMb"];
  return {
    machine: {
      platform: "darwin 27.0.0 arm64",
      cpu: "Apple M1 Max",
      cores: 10,
      memoryGb: 32,
      node: "v26.8.1",
    },
    options: { rounds: 3 },
    builds: {
      a: { label: "v0.1.0 (abc12345)", version: "0.1.0", commit: "abc12345" },
      b: { label: "working tree", version: "0.1.0", commit: "def67890" },
    },
    metrics: Object.fromEntries(
      keys.map((key, i) => [key, { a: 100, b: 100 * ratios[i]!, ratio: ratios[i]! }]),
    ),
  };
}

const temps: string[] = [];
after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

describe("versions", () => {
  it("compares semver, prereleases below their release", () => {
    assert.equal(compareVersions("0.1.0", "0.0.9"), 1);
    assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
    assert.equal(compareVersions("0.10.0", "0.9.0"), 1);
    assert.equal(compareVersions("1.0.0-rc.1", "1.0.0"), -1);
    assert.equal(compareVersions("1.0.0-rc.2", "1.0.0-rc.1"), 1);
  });

  it("sets a package.json version, keeping its formatting", () => {
    const text =
      '{\n  "name": "x",\n  "version": "0.0.0",\n  "files": ["dist"],\n  "dependencies": { "y": { "version": "1" } }\n}\n';
    assert.equal(setPackageVersion(text, "0.1.0"), text.replace('"0.0.0"', '"0.1.0"'));
  });

  it("pins internal dependencies that are not workspace: to the version", () => {
    const text = JSON.stringify(
      {
        name: "@lumiose/compiler",
        version: "0.1.0",
        dependencies: { lumiose: "workspace:*", vite: "^8.0.0" },
        optionalDependencies: { "@lumiose/compiler-linux-x64-gnu": "0.0.0" },
      },
      null,
      2,
    );
    const names = new Set(["lumiose", "@lumiose/compiler-linux-x64-gnu"]);
    const pinned = JSON.parse(pinInternalDependencies(text, names, "0.1.0"));
    assert.deepEqual(pinned.dependencies, { lumiose: "workspace:*", vite: "^8.0.0" });
    assert.deepEqual(pinned.optionalDependencies, { "@lumiose/compiler-linux-x64-gnu": "0.1.0" });
  });

  it("sets the Cargo workspace version and the workspace crates in Cargo.lock", () => {
    const toml =
      '[workspace]\nmembers = ["crates/*"]\n\n[workspace.package]\nversion = "0.0.0"\nedition = "2024"\n';
    assert.match(setCargoVersion(toml, "0.1.0"), /\[workspace\.package\]\nversion = "0\.1\.0"/);
    const lock = [
      "version = 4",
      "",
      "[[package]]",
      'name = "lumiose_compiler"',
      'version = "0.0.0"',
      "dependencies = []",
      "",
      "[[package]]",
      'name = "oxc"',
      'version = "0.0.0"',
      'source = "registry+https://github.com/rust-lang/crates.io-index"',
      "",
    ].join("\n");
    const next = setCargoLockVersions(lock, new Set(["lumiose_compiler", "oxc"]), "0.1.0");
    assert.match(next, /name = "lumiose_compiler"\nversion = "0\.1\.0"/);
    assert.match(next, /name = "oxc"\nversion = "0\.0\.0"/);
  });
});

describe("versioned files", () => {
  it("updates the napi loader's version check and the llms docs", () => {
    const loader = [
      'if (bindingPackageVersion !== "0.1.0" && process.env.X) {',
      "  throw new Error(`Native binding package version mismatch, expected 0.1.0 but got ${v}.`);",
      "}",
    ].join("\n");
    const next = setLoaderVersion(loader, "0.1.0", "0.2.0");
    assert.match(next, /!== "0\.2\.0"/);
    assert.match(next, /expected 0\.2\.0 but/);
    assert.doesNotMatch(next, /0\.1\.0/);
    assert.equal(
      setDocsVersion("These docs match lumiose 0.1.0. Installed", "0.1.0", "0.2.0"),
      "These docs match lumiose 0.2.0. Installed",
    );
  });
});

describe("changelog", () => {
  it("parses Conventional Commits, with ! or BREAKING CHANGE for breaking ones", () => {
    assert.deepEqual(parseCommit("a1", "feat(dom): claim cursor for lists (TASK-1)"), {
      hash: "a1",
      type: "feat",
      scope: "dom",
      subject: "claim cursor for lists (TASK-1)",
      breaking: false,
    });
    assert.equal(parseCommit("a2", "fix!: drop the old API")?.breaking, true);
    assert.equal(parseCommit("a3", "refactor: x\n\nBREAKING CHANGE: y")?.breaking, true);
    assert.equal(parseCommit("a4", "Merge branch 'main'"), undefined);
  });

  it("lists breaking changes, features, fixes and performance; leaves the rest out", () => {
    const commits = [
      parseCommit("a1", "feat(dom): lists")!,
      parseCommit("a2", "fix: a crash")!,
      parseCommit("a3", "chore: tidy")!,
      parseCommit("a4", "perf(core): faster")!,
      parseCommit("a5", "feat!: new config")!,
    ];
    assert.equal(
      renderChangelog("0.1.0", "2026-10-10", commits),
      [
        "## 0.1.0 (2026-10-10)",
        "",
        "### Breaking changes",
        "",
        "- new config (a5)",
        "",
        "### Features",
        "",
        "- **dom:** lists (a1)",
        "",
        "### Fixes",
        "",
        "- a crash (a2)",
        "",
        "### Performance",
        "",
        "- **core:** faster (a4)",
        "",
      ].join("\n"),
    );
    assert.match(renderChangelog("0.1.1", "2026-10-11", []), /No user-facing changes/);
  });

  it("adds each release above the previous ones", () => {
    const first = prependChangelog(undefined, "## 0.1.0\n");
    const second = prependChangelog(first, "## 0.2.0\n");
    assert.match(second, /^# Changelog\n[\s\S]*## 0\.2\.0\n\n## 0\.1\.0\n$/);
  });
});

/** A repository with two lockstep packages, a platform package, a crate and a few commits. */
function fixture(): string {
  const repo = mkdtempSync(join(tmpdir(), "lumiose-release-"));
  temps.push(repo);
  const write = (path: string, content: string | object) => {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(
      join(repo, path),
      typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`,
    );
  };
  write("packages/lumiose/package.json", { name: "lumiose", version: "0.0.0" });
  write("packages/vite/package.json", {
    name: "@lumiose/vite",
    version: "0.0.0",
    dependencies: { lumiose: "workspace:*", "@lumiose/compiler": "workspace:*" },
  });
  write("packages/compiler/package.json", {
    name: "@lumiose/compiler",
    version: "0.0.0",
    optionalDependencies: { "@lumiose/compiler-linux-x64-gnu": "workspace:*" },
  });
  write("packages/compiler/npm/linux-x64-gnu/package.json", {
    name: "@lumiose/compiler-linux-x64-gnu",
    version: "0.0.0",
  });
  write("packages/site/package.json", { name: "site", version: "0.0.0", private: true });
  write("Cargo.toml", '[workspace.package]\nversion = "0.0.0"\n');
  write("packages/compiler/index.js", 'if (bindingPackageVersion !== "0.0.0") {}\n');
  write("packages/lumiose/docs/llms.txt", "These docs match lumiose 0.0.0. More.\n");
  write("crates/lumiose_compiler/Cargo.toml", '[package]\nname = "lumiose_compiler"\n');
  write("Cargo.lock", 'version = 4\n\n[[package]]\nname = "lumiose_compiler"\nversion = "0.0.0"\n');
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: "pipe" }).trim();
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@localhost");
  git("add", "-A");
  git("commit", "-q", "-m", "chore: initial");
  write("packages/lumiose/src.ts", "export {};\n");
  git("add", "-A");
  git("commit", "-q", "-m", "feat(core): signals");
  return repo;
}

const git = (repo: string, ...args: string[]) =>
  execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: "pipe" }).trim();
const version = (repo: string, path: string) =>
  (JSON.parse(readFileSync(join(repo, path), "utf8")) as { version: string }).version;

describe("release", () => {
  it("--dry-run reports the plan and changes nothing", () => {
    const repo = fixture();
    const lines: string[] = [];
    release(repo, "0.1.0", { dryRun: true, date: "2026-10-10", log: (l) => lines.push(l) });
    const output = lines.join("\n");
    assert.match(output, /dry run: 0\.0\.0 -> 0\.1\.0/);
    assert.match(output, /packages\/compiler\/npm\/linux-x64-gnu\/package\.json/);
    assert.match(output, /- \*\*core:\*\* signals/);
    assert.equal(version(repo, "packages/lumiose/package.json"), "0.0.0");
    assert.equal(git(repo, "status", "--porcelain"), "");
    assert.equal(git(repo, "tag", "--list"), "");
  });

  it("bumps every published package, Cargo and the changelog, then commits and tags", () => {
    const repo = fixture();
    release(repo, "0.1.0", { date: "2026-10-10", log: () => {} });
    for (const path of [
      "packages/lumiose/package.json",
      "packages/vite/package.json",
      "packages/compiler/package.json",
      "packages/compiler/npm/linux-x64-gnu/package.json",
    ]) {
      assert.equal(version(repo, path), "0.1.0", path);
    }
    assert.equal(version(repo, "packages/site/package.json"), "0.0.0");
    assert.match(readFileSync(join(repo, "Cargo.toml"), "utf8"), /version = "0\.1\.0"/);
    assert.match(readFileSync(join(repo, "packages/compiler/index.js"), "utf8"), /!== "0\.1\.0"/);
    assert.match(
      readFileSync(join(repo, "packages/lumiose/docs/llms.txt"), "utf8"),
      /match lumiose 0\.1\.0\./,
    );
    assert.match(readFileSync(join(repo, "Cargo.lock"), "utf8"), /version = "0\.1\.0"/);
    assert.match(readFileSync(join(repo, "CHANGELOG.md"), "utf8"), /## 0\.1\.0 \(2026-10-10\)/);
    assert.equal(git(repo, "log", "-1", "--format=%s"), "chore(release): v0.1.0");
    assert.equal(git(repo, "tag", "--list"), "v0.1.0");
    assert.equal(git(repo, "status", "--porcelain"), "");

    // The next release lists only the commits after the tag.
    writeFileSync(join(repo, "packages/lumiose/fix.ts"), "export {};\n");
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "fix(dom): a crash");
    const runs: string[] = [];
    release(repo, "0.1.1", {
      date: "2026-10-11",
      log: () => {},
      runScale: (_repo, previous) => {
        runs.push(previous);
        return scaleResult([1, 1.05, 0.98, 1.2]);
      },
    });
    assert.deepEqual(runs, ["v0.1.0"]);
    const changelog = readFileSync(join(repo, "CHANGELOG.md"), "utf8");
    const latest = changelog.slice(changelog.indexOf("## 0.1.1"), changelog.indexOf("## 0.1.0"));
    assert.match(latest, /a crash/);
    assert.doesNotMatch(latest, /signals/);
    // The scale gate's numbers are the release notes' last section.
    assert.match(latest, /\S\n\n### Scale\n\nThe large-app benchmark/);
    assert.match(latest, /\| Server memory, peak RSS \(MB\) \| 100 \| 120 \| 1\.200 \|/);
    // The first release had nothing to compare with.
    assert.match(changelog, /## 0\.1\.0[\s\S]*Not measured: there is no previous release/);
  });

  it("stops before writing anything when a metric regresses by more than 20%", () => {
    const repo = fixture();
    release(repo, "0.1.0", { date: "2026-10-10", log: () => {} });
    const head = git(repo, "rev-parse", "HEAD");
    assert.throws(
      () =>
        release(repo, "0.1.1", {
          log: () => {},
          runScale: () => scaleResult([1, 1.21, 1, 1]),
        }),
      /scale gate stopped the release[\s\S]*Dev cold start \(ms\): 100 -> 121 \(1\.210\)/,
    );
    assert.equal(git(repo, "rev-parse", "HEAD"), head);
    assert.equal(git(repo, "status", "--porcelain"), "");
    assert.equal(git(repo, "tag", "--list"), "v0.1.0");
    assert.equal(version(repo, "packages/lumiose/package.json"), "0.1.0");
  });

  it("can skip the gate, which the notes record; a dry run never runs it", () => {
    const repo = fixture();
    release(repo, "0.1.0", { date: "2026-10-10", log: () => {} });
    const lines: string[] = [];
    release(repo, "0.1.1", { dryRun: true, runScale: never, log: (l) => lines.push(l) });
    assert.match(lines.join("\n"), /a release runs the scale gate first/);
    release(repo, "0.1.1", { skipScaleGate: true, runScale: never, log: () => {} });
    assert.match(readFileSync(join(repo, "CHANGELOG.md"), "utf8"), /scale gate was skipped/);
  });
});

/** The fixture plus @lumiose/ui, a package outside lockstep at its own version, and commits to each. */
function fixtureWithUi(options: { private?: boolean } = {}): string {
  const repo = fixture();
  mkdirSync(join(repo, "packages/ui"), { recursive: true });
  writeFileSync(
    join(repo, "packages/ui/package.json"),
    `${JSON.stringify(
      {
        name: "@lumiose/ui",
        version: "0.3.0",
        ...(options.private ? { private: true } : {}),
        peerDependencies: { lumiose: "workspace:^" },
      },
      null,
      2,
    )}\n`,
  );
  mkdirSync(join(repo, "backlog/tasks"), { recursive: true });
  writeFileSync(join(repo, "backlog/tasks/task-1.md"), "Done\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "feat(ui): dialog");
  writeFileSync(join(repo, "packages/lumiose/fix.ts"), "export {};\n");
  git(repo, "add", "-A");
  git(repo, "commit", "-q", "-m", "fix(dom): a crash");
  return repo;
}

describe("packages outside lockstep (@lumiose/ui)", () => {
  it("a lockstep release leaves them and their commits alone", () => {
    const repo = fixtureWithUi();
    release(repo, "0.1.0", { date: "2026-10-10", log: () => {} });
    assert.equal(version(repo, "packages/lumiose/package.json"), "0.1.0");
    assert.equal(version(repo, "packages/ui/package.json"), "0.3.0");
    const changelog = readFileSync(join(repo, "CHANGELOG.md"), "utf8");
    assert.match(changelog, /except those released outside lockstep \(@lumiose\/ui\)/);
    assert.match(changelog, /signals/);
    assert.match(changelog, /a crash/);
    assert.doesNotMatch(changelog, /dialog/);
  });

  it("--package releases one at its own version, changelog and tag, without the scale gate", () => {
    const repo = fixtureWithUi();
    release(repo, "0.1.0", { date: "2026-10-10", log: () => {} });
    const lines: string[] = [];
    release(repo, "0.4.0", {
      package: "@lumiose/ui",
      dryRun: true,
      runScale: never,
      log: (line) => lines.push(line),
    });
    assert.match(lines.join("\n"), /dry run: @lumiose\/ui 0\.3\.0 -> 0\.4\.0/);
    assert.doesNotMatch(lines.join("\n"), /scale gate/);
    assert.equal(version(repo, "packages/ui/package.json"), "0.3.0");

    release(repo, "0.4.0", {
      package: "@lumiose/ui",
      date: "2026-10-12",
      runScale: never,
      log: () => {},
    });
    assert.equal(version(repo, "packages/ui/package.json"), "0.4.0");
    assert.equal(version(repo, "packages/lumiose/package.json"), "0.1.0");
    assert.equal(version(repo, "packages/compiler/npm/linux-x64-gnu/package.json"), "0.1.0");
    assert.match(readFileSync(join(repo, "Cargo.toml"), "utf8"), /version = "0\.1\.0"/);
    const own = readFileSync(join(repo, "packages/ui/CHANGELOG.md"), "utf8");
    assert.match(own, /^# Changelog\n\n@lumiose\/ui has its own versions/);
    assert.match(own, /## 0\.4\.0 \(2026-10-12\)\n\n### Features\n\n- \*\*ui:\*\* dialog/);
    assert.doesNotMatch(own, /signals|a crash/);
    assert.doesNotMatch(readFileSync(join(repo, "CHANGELOG.md"), "utf8"), /0\.4\.0/);
    assert.equal(git(repo, "log", "-1", "--format=%s"), "chore(release): @lumiose/ui@0.4.0");
    assert.deepEqual(git(repo, "tag", "--list").split("\n"), ["@lumiose/ui@0.4.0", "v0.1.0"]);
    assert.equal(git(repo, "status", "--porcelain"), "");

    // The next release of the package lists only its commits after its own tag, wherever they
    // changed files (its docs, its examples).
    writeFileSync(join(repo, "packages/lumiose/ui.md"), "Menu\n");
    git(repo, "add", "-A");
    git(repo, "commit", "-q", "-m", "feat(ui): menu");
    release(repo, "0.5.0", { package: "@lumiose/ui", date: "2026-10-13", log: () => {} });
    const next = readFileSync(join(repo, "packages/ui/CHANGELOG.md"), "utf8");
    const latest = next.slice(next.indexOf("## 0.5.0"), next.indexOf("## 0.4.0"));
    assert.match(latest, /menu/);
    assert.doesNotMatch(latest, /dialog/);
    assert.match(next, /## 0\.4\.0[\s\S]*dialog/);
    // ... and the next lockstep release leaves it out.
    release(repo, "0.2.0", { date: "2026-10-14", skipScaleGate: true, log: () => {} });
    const lockstep = readFileSync(join(repo, "CHANGELOG.md"), "utf8");
    assert.doesNotMatch(lockstep.slice(0, lockstep.indexOf("## 0.1.0")), /menu/);
    assert.equal(version(repo, "packages/ui/package.json"), "0.5.0");
  });

  it("refuses a lockstep package, a private or missing one and a version that is not higher", () => {
    const repo = fixtureWithUi();
    const ui = (v: string) => () => release(repo, v, { package: "@lumiose/ui", log: () => {} });
    assert.throws(
      () => release(repo, "0.1.0", { package: "lumiose", log: () => {} }),
      /lumiose is released in lockstep/,
    );
    assert.throws(ui("0.3.0"), /not above the current version 0\.3\.0 of @lumiose\/ui/);
    rmSync(join(repo, "packages/ui"), { recursive: true });
    git(repo, "commit", "-q", "-am", "chore: drop ui");
    assert.throws(ui("0.4.0"), /no package named @lumiose\/ui/);
    const hidden = fixtureWithUi({ private: true });
    assert.throws(
      () => release(hidden, "0.4.0", { package: "@lumiose/ui", log: () => {} }),
      /@lumiose\/ui is private/,
    );
  });
});

describe("scale gate", () => {
  it("flags ratios above 1.2 and missing metrics", () => {
    assert.deepEqual(scaleRegressions(scaleResult([1.2, 1, 1, 1])), []);
    assert.deepEqual(scaleRegressions(scaleResult([1.25, 1, 0.5, 1.3])), [
      "Production build (ms): 100 -> 125 (1.250)",
      "Server memory, peak RSS (MB): 100 -> 130 (1.300)",
    ]);
    const missing = scaleResult([1, 1, 1, 1]);
    delete missing.metrics.hmrMs;
    assert.deepEqual(scaleRegressions(missing), ["HMR latency (ms): not measured"]);
  });

  it("renders the numbers for the release notes", () => {
    const section = renderScale(scaleResult([1, 1.1, 0.9, 1]));
    assert.match(section, /working tree against v0\.1\.0 \(abc12345\)/);
    assert.match(section, /medians of 3 rounds on Apple M1 Max/);
    assert.match(section, /\| HMR latency \(ms\) \| 100 \| 90 \| 0\.900 \|/);
  });

  it("refuses a dirty tree, a version that is not higher, and an existing tag", () => {
    const repo = fixture();
    assert.throws(() => release(repo, "0.0.0", { log: () => {} }), /not above the current/);
    assert.throws(() => release(repo, "1.0", { log: () => {} }), /not a version/);
    writeFileSync(join(repo, "dirty.txt"), "x");
    assert.throws(() => release(repo, "0.1.0", { log: () => {} }), /working tree has changes/);
    rmSync(join(repo, "dirty.txt"));
    git(repo, "tag", "v0.1.0");
    assert.throws(() => release(repo, "0.1.0", { log: () => {} }), /already exists/);
  });
});
