// `pnpm pack:check`: packs every publishable package (each `prepack` builds its dist/) and checks
// the tarballs as npm would publish them: built files only (no sources, tests or fixtures), every
// export and bin present, no `workspace:` specifiers left, and `npm publish --dry-run` accepts them.
// With `--smoke`, it also creates an app with the packed create-lumiose, installs the packed
// packages into it from the tarballs, and runs `lumiose check` and `lumiose build` there. Nothing is
// published.
//
//   node scripts/pack.ts [--out <dir>] [--smoke] [--skip-npm]

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const REPO = fileURLToPath(new URL("..", import.meta.url));

export interface Manifest {
  name: string;
  version: string;
  private?: boolean;
  exports?: Record<string, unknown>;
  bin?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

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
  for (const file of files) {
    if (FORBIDDEN.some((pattern) => pattern.test(file))) problems.push(`ships ${file}`);
  }
  const named = [...targets(manifest.exports), ...Object.values(manifest.bin ?? {})];
  for (const target of named) {
    const path = target.replace(/^\.\//, "");
    if (path.includes("*")) {
      const prefix = path.slice(0, path.indexOf("*"));
      if (!files.some((file) => file.startsWith(prefix)))
        problems.push(`export ${target}: no files`);
    } else if (!has.has(path)) problems.push(`export or bin ${target}: missing`);
    if (path.endsWith(".ts") && !path.endsWith(".d.ts"))
      problems.push(`export or bin ${target}: TypeScript source`);
  }
  for (const field of ["dependencies", "peerDependencies", "optionalDependencies"] as const) {
    for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
      if (/^(workspace|link|file):/.test(spec)) problems.push(`${field}.${name}: ${spec}`);
    }
  }
  return problems;
}

/** The workspace packages that are published (not private), as directories. */
export function publishable(repo = REPO): string[] {
  const dir = join(repo, "packages");
  return readdirSync(dir)
    .filter((name) => existsSync(join(dir, name, "package.json")))
    .filter(
      (name) =>
        !(JSON.parse(readFileSync(join(dir, name, "package.json"), "utf8")) as Manifest).private,
    )
    .map((name) => join(dir, name))
    .toSorted();
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

interface Packed {
  name: string;
  tarball: string;
}

function pack(dir: string, out: string): Packed {
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
  const problems = tarballProblems(manifest, files);
  if (problems.length > 0) {
    throw new Error(`${manifest.name}:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  }
  console.log(`${manifest.name}@${manifest.version}: ${files.length} files`);
  return { name: manifest.name, tarball };
}

/** Creates an app with the packed create-lumiose and builds it with the packed packages. */
function smoke(packed: Packed[], out: string): void {
  const dir = mkdtempSync(join(tmpdir(), "lumiose-pack-"));
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
    run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], tools);
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
    writeFileSync(join(app, "package.json"), JSON.stringify({ ...manifest, overrides }, null, 2));
    run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], app);
    const bin = join(app, "node_modules/@lumiose/cli/dist/bin.js");
    for (const command of [["check"], ["build"]]) {
      try {
        run(process.execPath, [bin, ...command], app);
      } catch (error) {
        const { stdout, stderr } = error as { stdout?: string; stderr?: string };
        throw new Error(
          `lumiose ${command.join(" ")} failed in the packed app:\n${stdout ?? ""}${stderr ?? ""}`,
          { cause: error },
        );
      }
    }
    if (!existsSync(join(app, "dist/server")))
      throw new Error("lumiose build wrote no dist/server");
    console.log(
      `smoke: create-lumiose --template ssr, lumiose check and lumiose build pass (${out})`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const packed: Packed[] = [];
  const failures: string[] = [];
  for (const dir of publishable()) {
    try {
      packed.push(pack(dir, out));
    } catch (error) {
      failures.push((error as Error).message);
    }
  }
  if (failures.length === 0 && !values["skip-npm"]) {
    for (const { name, tarball } of packed) {
      try {
        run("npm", ["publish", "--dry-run", "--access", "public", "--tag", "next", tarball], out);
      } catch (error) {
        const { stderr } = error as { stderr?: string };
        failures.push(`${name}: npm publish --dry-run failed\n${stderr ?? ""}`);
      }
    }
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
