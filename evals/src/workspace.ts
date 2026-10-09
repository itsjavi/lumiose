// Isolated projects for eval runs. Each run gets a fresh project in a temp directory: a
// create-lumen template (or an empty package), the task's starting files, and node_modules
// installed by pnpm from the local store (offline). Lumen itself comes from a read-only snapshot
// of this repo's packages ("vendor"), linked with `link:` because Lumen ships TypeScript sources,
// which Node only runs outside node_modules.
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { Ablation, Task } from "./tasks.ts";

export const EVALS = fileURLToPath(new URL("../", import.meta.url));
export const REPO = fileURLToPath(new URL("../../", import.meta.url));
const PACKAGES = join(REPO, "packages");

/** The Lumen packages a project can link, by package name. */
const VENDORED = { lumen: "lumen", "@lumen/adapter-node": "adapter-node", "@lumen/compiler": "compiler" };

/** Third-party tools every eval project installs, at the versions this repo uses. */
function toolVersions(): Record<string, string> {
  const require = createRequire(join(PACKAGES, "create/package.json"));
  const fromRepo = createRequire(join(REPO, "package.json"));
  const version = (name: string, req = require) =>
    (JSON.parse(readFileSync(req.resolve(`${name}/package.json`), "utf8")) as { version: string })
      .version;
  return {
    typescript: version("typescript"),
    vite: version("vite"),
    oxlint: version("oxlint", fromRepo),
    oxfmt: version("oxfmt", fromRepo),
    vitest: version("vitest", fromRepo),
    "happy-dom": version("happy-dom", fromRepo),
    "@types/node": version("@types/node", fromRepo),
  };
}

/** The commit Lumen is evaluated at: HEAD unless `LUMEN_EVAL_REV` names another revision. */
export function lumenRev(): string {
  return execFileSync("git", ["rev-parse", "--short", process.env.LUMEN_EVAL_REV ?? "HEAD"], {
    cwd: REPO,
    encoding: "utf8",
  }).trim();
}

/** Packages copied into the vendor snapshot: the linked ones plus create-lumen (the runner's scaffolder). */
const COPIED = [...Object.values(VENDORED), "create"];

/**
 * The repo at `rev` (not the working tree, which may hold other agents' unfinished work), with the
 * compiler's native binding built from that revision. Cached per revision; the Cargo target dir is
 * shared across revisions so later builds are incremental.
 */
function source(cacheDir: string, rev: string): string {
  const dir = join(cacheDir, `src-${rev}`);
  if (existsSync(join(dir, ".complete"))) return dir;
  rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  mkdirSync(dir, { recursive: true });
  const paths = ["Cargo.toml", "Cargo.lock", "rust-toolchain.toml", "crates", ...COPIED.map((p) => `packages/${p}`)];
  execFileSync("sh", ["-c", `git archive ${rev} ${paths.join(" ")} | tar -x -C "${dir}"`], { cwd: REPO });
  console.log(`[evals] building the compiler binding at ${rev} (cached afterwards)…`);
  execFileSync("cargo", ["build", "--quiet", "--release", "-p", "lumen_napi"], {
    cwd: dir,
    stdio: ["ignore", "ignore", "inherit"],
    env: { ...process.env, CARGO_TARGET_DIR: join(cacheDir, "target") },
  });
  const ext = process.platform === "darwin" ? "dylib" : process.platform === "win32" ? "dll" : "so";
  const lib = join(cacheDir, "target/release", `${process.platform === "win32" ? "" : "lib"}lumen_napi.${ext}`);
  const platform =
    process.platform === "linux" ? `linux-${process.arch}-gnu` : process.platform === "win32" ? `win32-${process.arch}-msvc` : `${process.platform}-${process.arch}`;
  cpSync(lib, join(dir, "packages/compiler", `compiler.${platform}.node`));
  writeFileSync(join(dir, ".complete"), "");
  return dir;
}

/**
 * A read-only copy of the Lumen packages at the evaluated revision (published files only) whose
 * own dependencies are symlinked to this repo's installed ones. Cached per revision and docs
 * variant.
 */
export function vendor(cacheDir: string, ablation: Ablation): string {
  const variant = ablation.llms ? "full" : "no-llms";
  const rev = lumenRev();
  const dir = join(cacheDir, `vendor2-${rev}-${variant}`);
  if (existsSync(join(dir, ".complete"))) return dir;
  const src = source(cacheDir, rev);
  rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  for (const folder of COPIED) {
    const from = join(src, "packages", folder);
    const installed = join(PACKAGES, folder);
    const target = join(dir, folder);
    const manifest = JSON.parse(readFileSync(join(from, "package.json"), "utf8")) as {
      files?: string[];
      dependencies?: Record<string, string>;
    };
    mkdirSync(target, { recursive: true });
    for (const entry of [...(manifest.files ?? []), "package.json"]) {
      for (const name of readdirSync(from)) {
        if (!matches(name, entry)) continue;
        cpSync(join(from, name), join(target, name), {
          recursive: true,
          filter: (path) => !/\.test\.tsx?$|[/\\]__fixtures__([/\\]|$)/.test(path),
        });
      }
    }
    // The package's dependencies: Lumen siblings point into the vendor dir, the rest to the
    // repo's installed copies (resolved from the package's own node_modules).
    const modules = join(target, "node_modules");
    for (const name of Object.keys(manifest.dependencies ?? {})) {
      const link = join(modules, name);
      mkdirSync(dirname(link), { recursive: true });
      const sibling = VENDORED[name as keyof typeof VENDORED];
      symlinkSync(
        sibling ? join(dir, sibling) : realpathSync(join(installed, "node_modules", name)),
        link,
        "dir",
      );
    }
    // lumen's peer: the same Vite the repo builds with.
    if (folder === "lumen") {
      symlinkSync(realpathSync(join(installed, "node_modules/vite")), join(modules, "vite"), "dir");
    }
  }
  if (!ablation.llms) {
    for (const file of ["llms.txt", "llms-full.txt"]) rmSync(join(dir, "lumen/docs", file), { force: true });
  }
  makeReadOnly(dir);
  chmodSync(dir, 0o755);
  writeFileSync(join(dir, ".complete"), "");
  chmodSync(dir, 0o555);
  return dir;
}

function matches(name: string, pattern: string): boolean {
  if (!pattern.includes("*")) return name === pattern;
  const regex = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*")}$`);
  return regex.test(name);
}

/** Drops write permission on files and directories (symlinks are left alone). */
function makeReadOnly(path: string): void {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) return;
  if (stat.isDirectory()) {
    for (const name of readdirSync(path)) makeReadOnly(join(path, name));
    chmodSync(path, 0o555);
  } else chmodSync(path, 0o444);
}

export interface RunProject {
  dir: string;
  /** Files of the starting state, project-relative (for the diff stats). */
  files: string[];
}

/**
 * Creates the project for one run: template, the task's `start/` files, the package.json
 * rewired to the vendor snapshot, agent files per the ablation, an offline install and a git
 * commit of the starting state.
 */
export async function createProject(
  task: Task,
  ablation: Ablation,
  vendorDir: string,
  dir: string,
): Promise<RunProject> {
  mkdirSync(dir, { recursive: true });
  if (task.template !== "none") {
    // create-lumen from the vendor snapshot, so templates and agent files match the evaluated revision.
    const { scaffold } = (await import(join(vendorDir, "create/src/scaffold.ts"))) as typeof import("create-lumen/src/scaffold.ts");
    await scaffold({ dir, template: task.template, name: "eval-app", force: true });
  }
  const start = join(task.dir, "start");
  if (existsSync(start)) cpSync(start, dir, { recursive: true });
  for (const file of task.remove ?? []) rmSync(join(dir, file), { recursive: true, force: true });
  if (!ablation.agents) {
    for (const file of ["AGENTS.md", "CLAUDE.md", ".claude"]) rmSync(join(dir, file), { recursive: true, force: true });
  }
  writePackageJson(dir, vendorDir);
  cpSync(lockfile(vendorDir), join(dir, "pnpm-lock.yaml"));
  install(dir);
  execFileSync("git", ["init", "-q"], { cwd: dir });
  writeFileSync(join(dir, ".gitignore"), "node_modules\ndist\n.lumen\n", { flag: "a" });
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync(
    "git",
    ["-c", "user.name=eval", "-c", "user.email=eval@localhost", "commit", "-q", "-m", "start"],
    { cwd: dir },
  );
  return { dir, files: listFiles(dir) };
}

function writePackageJson(dir: string, vendorDir: string): void {
  const path = join(dir, "package.json");
  const manifest = existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>)
    : { name: "eval-app", version: "0.0.0", private: true, type: "module" };
  const tools = toolVersions();
  const link = (name: keyof typeof VENDORED) => `link:${join(vendorDir, VENDORED[name])}`;
  const dependencies = { ...(manifest.dependencies as Record<string, string> | undefined) };
  const devDependencies = { ...(manifest.devDependencies as Record<string, string> | undefined) };
  for (const deps of [dependencies, devDependencies]) {
    for (const name of Object.keys(deps)) {
      if (name in VENDORED) deps[name] = link(name as keyof typeof VENDORED);
      else if (name in tools) deps[name] = tools[name]!;
    }
  }
  dependencies.lumen = link("lumen");
  for (const name of ["typescript", "vite", "vitest", "happy-dom", "@types/node"] as const) {
    if (!(name in dependencies)) devDependencies[name] = tools[name]!;
  }
  manifest.dependencies = dependencies;
  manifest.devDependencies = devDependencies;
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * A lockfile shared by every run of a vendor snapshot, resolved once (downloading into the local
 * store what it lacks), so each run installs the same versions offline.
 */
function lockfile(vendorDir: string): string {
  const dir = `${vendorDir}-deps`;
  const lock = join(dir, "pnpm-lock.yaml");
  if (existsSync(lock)) return lock;
  mkdirSync(dir, { recursive: true });
  writePackageJson(dir, vendorDir);
  const path = join(dir, "package.json");
  const manifest = JSON.parse(readFileSync(path, "utf8")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  manifest.dependencies["@lumen/adapter-node"] = `link:${join(vendorDir, VENDORED["@lumen/adapter-node"])}`;
  Object.assign(manifest.devDependencies, toolVersions());
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  pnpm(dir, ["install", "--prefer-offline", "--ignore-workspace"]);
  return lock;
}

/** `pnpm install` from the local store only: no network, so runs are reproducible. */
export function install(dir: string): void {
  pnpm(dir, ["install", "--offline", "--ignore-workspace", "--no-frozen-lockfile"]);
}

function pnpm(dir: string, args: string[]): void {
  try {
    execFileSync("pnpm", args, { cwd: dir, stdio: "pipe", env: { ...process.env, CI: "1" } });
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(`pnpm ${args.join(" ")} failed in ${dir}:\n${stdout ?? ""}${stderr ?? ""}`, { cause: error });
  }
}

function listFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === ".lumen") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...listFiles(path, base));
    else out.push(relative(base, path));
  }
  return out.toSorted();
}
