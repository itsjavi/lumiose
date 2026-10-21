// `pnpm pack:check`: packs every publishable package (each `prepack` builds its dist/) and checks
// the tarballs as npm would publish them: built files only (no sources, tests or fixtures), every
// export and bin present, no `workspace:` specifiers left, one shared version (except the
// packages outside lockstep, `INDEPENDENT_PACKAGES`), and `npm publish
// --dry-run` accepts them in publish order (the path scripts/publish.ts takes for real; versions
// already on npm are skipped there, the tarballs are still checked and smoke-tested). With
// `--smoke`, it also creates an app with the packed create-lumiose, adds a page that uses the
// packed @lumiose/ui (scripts/fixtures/pack-ui), installs the packed packages into it from the
// tarballs, and runs `lumiose check` and `lumiose build` there, then its Playwright test in
// Chromium under `lumiose dev` and `lumiose preview` (TASK-390: Lumiose packages installed in
// node_modules are compiled; `playwright install chromium` first). Nothing is published.
//
//   node scripts/pack.ts [--out <dir>] [--smoke] [--skip-npm]

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const REPO = fileURLToPath(new URL("..", import.meta.url));
/**
 * `npm install` in the smoke app, whose dependencies outside the tarballs come from the registry.
 * A connection reset on the CI runner outlasted npm's default 2 fetch retries (TASK-511): 5 then.
 */
const NPM_INSTALL = ["install", "--no-audit", "--no-fund", "--loglevel=error", "--fetch-retries=5"];

export interface Manifest {
  name: string;
  version: string;
  private?: boolean;
  main?: string;
  files?: string[];
  os?: string[];
  cpu?: string[];
  exports?: Record<string, unknown>;
  bin?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

/**
 * Packages with versions of their own, outside the lockstep version of the others (decision-54):
 * `pnpm release:version <x.y.z> --package <name>` releases one alone, with its own changelog and a
 * `<name>@<x.y.z>` tag (scripts/release.ts).
 */
export const INDEPENDENT_PACKAGES: ReadonlySet<string> = new Set(["@lumiose/ui"]);

/**
 * Packages that ship their component sources (`.ts`, `.tsx`, `.css`) for the app's Lumiose compiler
 * to compile with the app's options, instead of compiled JavaScript (@lumiose/ui, TASK-353): their
 * exports may name TypeScript files.
 */
export const SOURCE_PACKAGES: ReadonlySet<string> = new Set(["@lumiose/ui"]);

/** Paths that must never be published. */
const FORBIDDEN = [
  /^src\//,
  /\.test\.[cm]?[jt]sx?$/,
  /\.test\.d\.ts$/,
  /(^|\/)(__fixtures__|__tests__|\.fixtures)\//,
  /(^|\/)test-(links|client)\.(js|d\.ts)$/,
  /(^|\/)tsconfig(\.build)?\.json$/,
  /(^|\/)vitest\.config\.ts$/,
];

/** Every file an export or bin of `manifest` names (wildcard exports are checked by prefix). */
function targets(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (value !== null && typeof value === "object") {
    for (const inner of Object.values(value)) targets(inner, out);
  }
  return out;
}

/**
 * Problems of a packed package: `manifest` is the tarball's package.json, `files` its paths
 * relative to the package root (without the `package/` prefix).
 */
export function tarballProblems(manifest: Manifest, files: string[]): string[] {
  const problems: string[] = [];
  const has = new Set(files);
  if (manifest.private) problems.push("is private");
  if (!has.has("LICENSE")) problems.push("no LICENSE");
  // npm shows the README as the package's page.
  if (!has.has("README.md")) problems.push("no README.md");
  // Platform packages carry os/cpu (publishConfig, so the workspace installs them everywhere).
  if (
    manifest.main?.endsWith(".node") &&
    (manifest.os === undefined || manifest.cpu === undefined)
  ) {
    problems.push("a native binary without os and cpu");
  }
  // The WASI fallback carries cpu wasm32, so that package managers install it only where wasm32
  // is enabled (`supportedArchitectures`, `npm install --cpu=wasm32`), not next to a native
  // binary (TASK-289).
  if (manifest.main?.endsWith(".wasi.cjs") && manifest.cpu?.join() !== "wasm32") {
    problems.push("a WASI binary without cpu wasm32");
  }
  for (const file of files) {
    if (FORBIDDEN.some((pattern) => pattern.test(file))) problems.push(`ships ${file}`);
  }
  const named = [
    ...targets(manifest.exports),
    ...Object.values(manifest.bin ?? {}),
    ...(manifest.main === undefined ? [] : [manifest.main]),
  ];
  for (const target of named) {
    const path = target.replace(/^\.\//, "");
    if (path.includes("*")) {
      const prefix = path.slice(0, path.indexOf("*"));
      if (!files.some((file) => file.startsWith(prefix)))
        problems.push(`export ${target}: no files`);
    } else if (!has.has(path)) problems.push(`export or bin ${target}: missing`);
    if (path.endsWith(".ts") && !path.endsWith(".d.ts") && !SOURCE_PACKAGES.has(manifest.name))
      problems.push(`export or bin ${target}: TypeScript source`);
  }
  for (const field of ["dependencies", "peerDependencies", "optionalDependencies"] as const) {
    for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
      if (/^(workspace|link|file):/.test(spec)) problems.push(`${field}.${name}: ${spec}`);
    }
  }
  return problems;
}

/** The directories of the per-platform compiler packages (`@lumiose/compiler-<platform>`). */
export function platformPackages(repo = REPO): string[] {
  const dir = join(repo, "packages/compiler/npm");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => existsSync(join(dir, name, "package.json")))
    .map((name) => join(dir, name))
    .toSorted();
}

/** The workspace packages that are published (not private), as directories. */
export function publishable(repo = REPO): string[] {
  const dir = join(repo, "packages");
  const packages = readdirSync(dir)
    .filter((name) => existsSync(join(dir, name, "package.json")))
    .filter((name) => !readManifest(join(dir, name)).private)
    .map((name) => join(dir, name));
  return [...packages, ...platformPackages(repo)].toSorted();
}

export function readManifest(dir: string): Manifest {
  return JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest;
}

/**
 * Copies the compiler binaries built in packages/compiler (`pnpm build:compiler`, `build:wasm`)
 * into their platform packages, and returns the platform packages whose files are all there: the
 * others (binaries of other platforms, which the Binaries workflow builds) are not packed here.
 */
export function stageBinaries(repo = REPO): Set<string> {
  const compiler = join(repo, "packages/compiler");
  const ready = new Set<string>();
  for (const dir of platformPackages(repo)) {
    const files = readManifest(dir).files ?? [];
    for (const file of files) {
      if (existsSync(join(compiler, file))) copyFileSync(join(compiler, file), join(dir, file));
    }
    if (files.every((file) => existsSync(join(dir, file)))) ready.add(dir);
  }
  return ready;
}

function run(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  });
}

export interface Packed {
  name: string;
  tarball: string;
  manifest: Manifest;
}

/** Packs `dir` into `out` and checks the tarball (a private package only for the smoke app). */
function pack(dir: string, out: string, smokeOnly = false): Packed {
  const before = new Set(readdirSync(out));
  run("pnpm", ["pack", "--pack-destination", out], dir);
  const created = readdirSync(out).filter((file) => file.endsWith(".tgz") && !before.has(file));
  if (created.length !== 1) throw new Error(`pnpm pack in ${dir} wrote ${created.length} tarballs`);
  const tarball = join(out, created[0]!);
  const manifest = JSON.parse(
    run("tar", ["-xOzf", tarball, "package/package.json"], out),
  ) as Manifest;
  const files = run("tar", ["-tzf", tarball], out)
    .split("\n")
    .filter(Boolean)
    .map((file) => file.replace(/^package\//, ""));
  const problems = tarballProblems(smokeOnly ? { ...manifest, private: false } : manifest, files);
  if (problems.length > 0) {
    throw new Error(`${manifest.name}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  }
  console.log(`${manifest.name}@${manifest.version}: ${files.length} files`);
  return { name: manifest.name, tarball, manifest };
}

/** The app files that use the packed @lumiose/ui, with their Playwright test (TASK-390). */
const PACK_UI_FIXTURE = join(REPO, "scripts/fixtures/pack-ui");

/** The Playwright version of the repository's browser tests, whose Chromium CI caches. */
function playwrightVersion(): string {
  const manifest = readManifest(join(REPO, "examples/ui-e2e"));
  return manifest.devDependencies!["@playwright/test"]!;
}

/**
 * Creates an app with the packed create-lumiose, adds a page that uses the packed @lumiose/ui,
 * checks and builds it with the packed packages, and runs its browser test in dev and build.
 */
function smoke(packed: Packed[], out: string): void {
  const dir = mkdtempSync(join(tmpdir(), "lumiose-pack-"));
  // @lumiose/ui is private until TASK-389, so packAll leaves it out.
  if (!packed.some((p) => p.name === "@lumiose/ui")) {
    packed = [...packed, pack(join(REPO, "packages/ui"), out, true)];
  }
  try {
    const file = (name: string) => `file:${packed.find((p) => p.name === name)!.tarball}`;
    const overrides = Object.fromEntries(packed.map((p) => [p.name, file(p.name)]));
    // The scaffolder, installed as `npm create lumiose` would.
    const tools = join(dir, "tools");
    mkdirSync(tools);
    writeFileSync(
      join(tools, "package.json"),
      JSON.stringify({
        private: true,
        dependencies: { "create-lumiose": file("create-lumiose") },
        overrides,
      }),
    );
    run("npm", NPM_INSTALL, tools);
    run(
      process.execPath,
      [join(tools, "node_modules/create-lumiose/dist/bin.js"), "app", "--template", "ssr", "--yes"],
      dir,
    );
    const app = join(dir, "app");
    const manifest = JSON.parse(
      readFileSync(join(app, "package.json"), "utf8"),
    ) as Required<Manifest>;
    for (const deps of [manifest.dependencies, manifest.devDependencies]) {
      for (const name of Object.keys(deps)) if (name in overrides) deps[name] = overrides[name]!;
    }
    manifest.dependencies["@lumiose/ui"] = file("@lumiose/ui");
    manifest.devDependencies["@playwright/test"] = playwrightVersion();
    writeFileSync(join(app, "package.json"), JSON.stringify({ ...manifest, overrides }, null, 2));
    cpSync(PACK_UI_FIXTURE, app, { recursive: true });
    run("npm", NPM_INSTALL, app);
    const bin = join(app, "node_modules/@lumiose/cli/dist/bin.js");
    const playwright = join(app, "node_modules/@playwright/test/cli.js");
    const steps: [string, string[]][] = [
      ["lumiose check", [bin, "check"]],
      ["lumiose build", [bin, "build"]],
      ["playwright test (lumiose dev, lumiose preview)", [playwright, "test"]],
    ];
    for (const [step, args] of steps) {
      try {
        run(process.execPath, args, app);
      } catch (error) {
        const { stdout, stderr } = error as { stdout?: string; stderr?: string };
        throw new Error(`${step} failed in the packed app:\n${stdout ?? ""}${stderr ?? ""}`, {
          cause: error,
        });
      }
      if (step === "lumiose build" && !existsSync(join(app, "dist/server")))
        throw new Error("lumiose build wrote no dist/server");
    }
    console.log(
      `smoke: create-lumiose --template ssr with @lumiose/ui, lumiose check, lumiose build and the browser test in dev and build pass (${out})`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Packs every publishable package into `out`, or those whose name `include` accepts. Platform
 * packages whose binary is not built here are skipped, or reported when `allBinaries` (a release
 * needs every one).
 */
export function packAll(
  out: string,
  allBinaries = false,
  include: (name: string) => boolean = () => true,
): { packed: Packed[]; failures: string[] } {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const packed: Packed[] = [];
  const failures: string[] = [];
  const ready = stageBinaries();
  const platforms = platformPackages();
  for (const dir of publishable()) {
    if (!include(readManifest(dir).name)) continue;
    if (platforms.includes(dir) && !ready.has(dir)) {
      const message = `${readManifest(dir).name}: its binary is not built here`;
      if (allBinaries) failures.push(message);
      else console.log(`${message} (skipped)`);
      continue;
    }
    try {
      packed.push(pack(dir, out));
    } catch (error) {
      failures.push((error as Error).message);
    }
  }
  const lockstep = packed.filter((p) => !INDEPENDENT_PACKAGES.has(p.name));
  const versions = new Set(lockstep.map((p) => p.manifest.version));
  if (versions.size > 1)
    failures.push(`the packages do not share one version: ${[...versions].join(", ")}`);
  return { packed, failures };
}

/** The names of the internal packages `manifest` depends on (any dependency field). */
function internalDependencies(manifest: Manifest, names: Set<string>): string[] {
  const fields = [manifest.dependencies, manifest.optionalDependencies, manifest.peerDependencies];
  return fields.flatMap((deps) => Object.keys(deps ?? {})).filter((name) => names.has(name));
}

/** `packages` ordered so each comes after the internal packages it depends on (then by name). */
export function publishOrder<T extends { manifest: Manifest }>(packages: T[]): T[] {
  const names = new Set(packages.map((p) => p.manifest.name));
  const byName = new Map(packages.map((p) => [p.manifest.name, p]));
  const order: T[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (item: T): void => {
    const name = item.manifest.name;
    if (state.get(name) === "done") return;
    if (state.get(name) === "visiting") throw new Error(`dependency cycle through ${name}`);
    state.set(name, "visiting");
    for (const dependency of internalDependencies(item.manifest, names).toSorted()) {
      visit(byName.get(dependency)!);
    }
    state.set(name, "done");
    order.push(item);
  };
  for (const item of packages.toSorted((a, b) => (a.manifest.name < b.manifest.name ? -1 : 1))) {
    visit(item);
  }
  return order;
}

/** The npm dist-tag of `version`: `next` for prereleases, else `latest`. */
export function distTag(version: string): string {
  return version.includes("-") ? "next" : "latest";
}

/** Whether npm already has `name@version` (npm refuses to publish over it, even as a dry run). */
export function isPublished(name: string, version: string): boolean {
  try {
    return run("npm", ["view", `${name}@${version}`, "version"], REPO).trim() === version;
  } catch {
    return false;
  }
}

/**
 * `npm publish` of each tarball in publish order (platform packages before @lumiose/compiler, the
 * runtime before the tooling). `dryRun` publishes nothing; a real run asks npm for provenance.
 * Versions npm already has are skipped, so the check passes on a released version and a release
 * that stopped halfway can be run again.
 */
export function publishTarballs(
  packed: Packed[],
  options: { dryRun: boolean; published?: (name: string, version: string) => boolean },
): string[] {
  const published = options.published ?? isPublished;
  const failures: string[] = [];
  for (const { name, tarball, manifest } of publishOrder(packed)) {
    if (published(name, manifest.version)) {
      console.log(`${name}@${manifest.version} is already on npm (skipped)`);
      continue;
    }
    const args = ["publish", tarball, "--access", "public", "--tag", distTag(manifest.version)];
    args.push(options.dryRun ? "--dry-run" : "--provenance");
    try {
      run("npm", args, dirname(tarball));
      console.log(`${options.dryRun ? "would publish" : "published"} ${name}@${manifest.version}`);
    } catch (error) {
      const { stderr } = error as { stderr?: string };
      failures.push(`${name}: npm ${args.join(" ")} failed\n${stderr ?? ""}`);
      // Later packages depend on this one: stop at the first failure.
      break;
    }
  }
  return failures;
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      out: { type: "string" },
      smoke: { type: "boolean", default: false },
      "skip-npm": { type: "boolean", default: false },
    },
  });
  const out = resolve(values.out ?? join(REPO, ".local/pack"));
  const { packed, failures } = packAll(out);
  if (failures.length === 0 && !values["skip-npm"]) {
    failures.push(...publishTarballs(packed, { dryRun: true }));
  }
  if (failures.length === 0 && values.smoke) {
    try {
      smoke(packed, out);
    } catch (error) {
      failures.push((error as Error).message);
    }
  }
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
  }
  console.log(`pack:check: ${packed.length} packages in ${out}`);
}
