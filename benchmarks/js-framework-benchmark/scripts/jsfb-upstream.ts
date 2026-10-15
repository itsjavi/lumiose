// `pnpm bench:jsfb:upstream`: checks the entry prepared for krausest/js-framework-benchmark
// (TASK-316) the way its maintainers do, with the published Lumiose packages from npm.
//
// Steps: check out the pinned krausest commit (sparse, shallow) into .krausest-upstream/, install
// its CLI, server and runner, assemble frameworks/keyed/lumiose from upstream/frameworks/keyed/
// lumiose (package.json, package-lock.json, index.html, vite.config.js) plus src/App.stsx and
// src/main.tsx, start the server on port 8080 (the checks use its default port), and run
// `npm run rebuild-ci keyed/lumiose`: `npm ci`, `npm run build-prod`, a smoke run of every
// benchmark, `isKeyed` and `checkCSP`.
//
// Options:
//   --export DIR   also copy the assembled entry to DIR (the folder to submit upstream)
//   --lock         refresh upstream/.../package-lock.json with `npm install` before checking
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const PKG = fileURLToPath(new URL("..", import.meta.url));
const ENTRY = join(PKG, "upstream/frameworks/keyed/lumiose");
const KRAUSEST = join(PKG, ".krausest-upstream");
const REPO = "https://github.com/krausest/js-framework-benchmark";
/** The commit scripts/jsfb.ts measures against; bump both together. */
const COMMIT = "bf894b681fb56433ccb6efb4a3c93e35eda2b20d";
const PORT = 8080;

const { values: options } = parseArgs({
  options: { export: { type: "string" }, lock: { type: "boolean", default: false } },
});

function sh(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`\`${command} ${args.join(" ")}\` failed in ${cwd}`);
}

function checkout(): void {
  if (existsSync(join(KRAUSEST, ".git"))) return;
  mkdirSync(KRAUSEST, { recursive: true });
  sh("git", ["init", "-q"], KRAUSEST);
  sh("git", ["remote", "add", "origin", REPO], KRAUSEST);
  const keep = ["/*", "!/*/", "/cli/", "/css/", "/server/", "/webdriver-ts/"];
  sh("git", ["sparse-checkout", "set", "--no-cone", ...keep], KRAUSEST);
  sh("git", ["fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", COMMIT], KRAUSEST);
  sh("git", ["checkout", "-q", "FETCH_HEAD"], KRAUSEST);
  mkdirSync(join(KRAUSEST, "frameworks/non-keyed"), { recursive: true });
}

/** `npm ci` in `dir`, unless it is installed. */
function npmCi(dir: string, ...extra: string[]): void {
  if (!existsSync(join(dir, "node_modules"))) {
    sh("npm", ["ci", "--no-audit", "--no-fund", ...extra], dir);
  }
}

function install(): void {
  // The CLI imports a dev dependency (semver), and the root's lint dependencies conflict.
  npmCi(KRAUSEST, "--legacy-peer-deps");
  npmCi(join(KRAUSEST, "server"));
  const runner = join(KRAUSEST, "webdriver-ts");
  if (!existsSync(join(runner, "dist/isKeyed.js"))) {
    npmCi(runner);
    sh("npm", ["run", "compile"], runner);
  }
}

/** Lays out frameworks/keyed/lumiose: the entry's files and the app's sources. */
function assemble(): string {
  const dest = join(KRAUSEST, "frameworks/keyed/lumiose");
  rmSync(dest, { recursive: true, force: true });
  cpSync(ENTRY, dest, { recursive: true });
  mkdirSync(join(dest, "src"));
  for (const file of ["App.stsx", "main.tsx"]) {
    cpSync(join(PKG, "src", file), join(dest, "src", file));
  }
  if (options.lock) {
    rmSync(join(dest, "package-lock.json"), { force: true });
    sh("npm", ["install", "--no-audit", "--no-fund"], dest);
    cpSync(join(dest, "package-lock.json"), join(ENTRY, "package-lock.json"));
  }
  return dest;
}

async function serve(): Promise<() => void> {
  const server = spawn("npm", ["start"], { cwd: join(KRAUSEST, "server"), stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/ls`)).ok) return () => server.kill();
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  server.kill();
  throw new Error(`The krausest server did not start on port ${PORT} (is the port in use?).`);
}

checkout();
install();
const entry = assemble();
const stop = await serve();
try {
  sh("npm", ["run", "rebuild-ci", "keyed/lumiose"], KRAUSEST);
} finally {
  stop();
}
if (options.export !== undefined) {
  const out = join(options.export, "lumiose");
  rmSync(out, { recursive: true, force: true });
  cpSync(entry, out, {
    recursive: true,
    filter: (path) => !/[/\\](node_modules|dist)$/.test(path),
  });
  console.log(`Exported the entry to ${out}`);
}
