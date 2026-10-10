// `pnpm demo`: list and start anything in the repo that serves HTML (TASK-184).
//
//   pnpm demo                      interactive picker, grouped by kind
//   pnpm demo <name>               start one (fuzzy: `pnpm demo chip` starts spa-chiptune)
//   pnpm demo --list [--json]      list without starting
//   pnpm demo <name> --prod        build, then run its production server (preview/start/serve)
//   pnpm demo <name> --port 5000   pick the port
//   pnpm demo <name> --open        open the browser once it answers
//
// Entries are discovered from the workspace packages (pnpm-workspace.yaml) that have a `dev`,
// `view`, `start`, `serve` or `preview` script, so new apps show up on their own. A package can
// describe itself with a `demo` field in its package.json:
//
//   "demo": { "title": "Chiptune tracker (SPA)", "kind": "example" }
//
// `kind` is example | site | benchmark | eval | e2e (default: from the folder), `setup` lists
// scripts to run first (e.g. `["seed"]`), `name` overrides
// the short name (default: the package name without its scope), `port` is "flag" (append
// `--port N`) or "env" (only set PORT; default: "env" for scripts that read PORT or run a plain
// `node` script, "flag" for CLIs such as lumiose, vite or next), and `"demo": false` hides it.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

export type Kind = "example" | "site" | "benchmark" | "eval" | "e2e" | "other";

export const KINDS: { kind: Kind; label: string }[] = [
  { kind: "example", label: "Examples" },
  { kind: "site", label: "Website and playground" },
  { kind: "benchmark", label: "Benchmarks" },
  { kind: "eval", label: "Evals" },
  { kind: "e2e", label: "E2E test apps" },
  { kind: "other", label: "Other" },
];

export interface Demo {
  /** Short name for the command line, e.g. `spa-chiptune`. */
  name: string;
  title: string;
  kind: Kind;
  /** Package name. */
  pkg: string;
  /** Package directory, relative to the repo root. */
  dir: string;
  /** Script that serves it in development (or the viewer's script). */
  dev: string;
  /** Production: optional build script, then the server script; null when there is none. */
  prod: { build: string | null; serve: string } | null;
  scripts: Record<string, string>;
  /** How its scripts take a port: forced by the `demo.port` metadata, or null to decide per script. */
  port: "flag" | "env" | null;
  /** Scripts to run first, in dev and production (`demo.setup`, e.g. `["seed"]`). */
  setup: string[];
}

interface Manifest {
  name?: string;
  description?: string;
  scripts?: Record<string, string>;
  demo?:
    | false
    | { name?: string; title?: string; kind?: Kind; port?: "flag" | "env"; setup?: string[] };
}

const SERVE_SCRIPTS = ["dev", "view", "start", "serve", "preview"] as const;

/** Package directories matched by the `packages` globs of pnpm-workspace.yaml. */
export function workspacePackages(root: string): string[] {
  const yaml = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
  const globs: string[] = [];
  let inPackages = false;
  for (const line of yaml.split("\n")) {
    if (/^\S/.test(line)) inPackages = /^packages:\s*$/.test(line);
    else if (inPackages) {
      const item = /^\s+-\s+["']?([^"'#]+?)["']?\s*$/.exec(line);
      if (item && !item[1]!.startsWith("!")) globs.push(item[1]!);
    }
  }
  const dirs: string[] = [];
  for (const glob of globs) {
    if (glob.endsWith("/*")) {
      const parent = join(root, glob.slice(0, -2));
      if (!existsSync(parent)) continue;
      for (const name of readdirSync(parent).toSorted()) {
        const dir = join(parent, name);
        if (statSync(dir).isDirectory() && existsSync(join(dir, "package.json"))) dirs.push(dir);
      }
    } else if (existsSync(join(root, glob, "package.json"))) dirs.push(join(root, glob));
  }
  return [...new Set(dirs)];
}

function defaultKind(dir: string, name: string): Kind {
  if (/(^|[-/])e2e($|[-/])/.test(name) || /(^|[-/])e2e($|[-/])/.test(dir)) return "e2e";
  if (dir.startsWith("examples/")) return "example";
  if (dir.startsWith("apps/")) return "site";
  if (dir.startsWith("benchmarks/")) return "benchmark";
  if (dir.startsWith("evals")) return "eval";
  return "other";
}

const order = (kind: Kind) => KINDS.findIndex((k) => k.kind === kind);

/** "flag" for CLIs that take `--port`; "env" when the script reads PORT or runs a plain node script. */
export function portMode(script: string): "flag" | "env" {
  if (/\bPORT\b/.test(script)) return "env";
  const last = script.split(/&&|;/).at(-1)!.trim();
  return /^node\s/.test(last) ? "env" : "flag";
}

/** Every HTML-serving package of the workspace. */
export function discover(root: string): Demo[] {
  const demos: Demo[] = [];
  for (const path of workspacePackages(root)) {
    const manifest = JSON.parse(readFileSync(join(path, "package.json"), "utf8")) as Manifest;
    if (manifest.demo === false) continue;
    const scripts = manifest.scripts ?? {};
    const dev = SERVE_SCRIPTS.find((script) => scripts[script] !== undefined);
    if (dev === undefined) continue;
    const meta = manifest.demo ?? {};
    const dir = relative(root, path).split("\\").join("/");
    const pkg = manifest.name ?? basename(path);
    const name = meta.name ?? pkg.replace(/^@[^/]+\//, "");
    const serve = (["preview", "start", "serve", "view"] as const).find(
      (s) => scripts[s] !== undefined,
    );
    demos.push({
      name,
      title: meta.title ?? name,
      kind: meta.kind ?? defaultKind(dir, name),
      pkg,
      dir,
      dev,
      prod:
        serve === undefined
          ? null
          : { build: serve !== "view" && scripts.build !== undefined ? "build" : null, serve },
      scripts,
      port: meta.port ?? null,
      setup: meta.setup ?? [],
    });
  }
  return demos.toSorted((a, b) => order(a.kind) - order(b.kind) || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- matching

/** How well `query` matches `text`: exact > prefix > word prefix > substring > subsequence; 0 = no match. */
function score(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800;
  const word = t.split(/[^a-z0-9]+/).findIndex((w) => w.startsWith(q));
  if (word > 0) return 600 - word;
  const at = t.indexOf(q);
  if (at >= 0) return 400 - at;
  // Subsequence: every query character in order; fewer gaps score higher.
  let i = 0;
  let gaps = 0;
  let last = -1;
  for (let j = 0; j < t.length && i < q.length; j++) {
    if (t[j] === q[i]) {
      if (last >= 0 && j > last + 1) gaps++;
      last = j;
      i++;
    }
  }
  return i === q.length ? Math.max(1, 200 - gaps * 20 - (t.length - q.length)) : 0;
}

export interface Match {
  demo: Demo;
  score: number;
}

/** Demos matching `query`, best first. The name counts most, then the title and package. */
export function rank(demos: Demo[], query: string): Match[] {
  return demos
    .map((demo) => ({
      demo,
      score: Math.max(
        score(query, demo.name) * 2,
        score(query, demo.title),
        score(query, demo.pkg),
        score(query, basename(demo.dir)),
      ),
    }))
    .filter((match) => match.score > 0)
    .toSorted((a, b) => b.score - a.score || a.demo.name.localeCompare(b.demo.name));
}

/** The one demo `query` means, or the candidates when it is ambiguous (or nothing matches). */
export function resolve(demos: Demo[], query: string): { demo: Demo } | { candidates: Demo[] } {
  const ranked = rank(demos, query);
  if (ranked.length === 1) return { demo: ranked[0]!.demo };
  if (ranked.length > 1 && ranked[0]!.score > ranked[1]!.score) return { demo: ranked[0]!.demo };
  return { candidates: ranked.map((match) => match.demo) };
}

// ---------------------------------------------------------------- running

export interface Step {
  script: string;
  args: string[];
}

/** The pnpm script runs that start `demo` (a build first in production). */
export function steps(demo: Demo, options: { prod: boolean; port?: number }): Step[] {
  if (options.prod && demo.prod === null) {
    throw new Error(`${demo.name} has no production server script (preview, start, serve or view)`);
  }
  const serve = options.prod ? demo.prod!.serve : demo.dev;
  const flag = (demo.port ?? portMode(demo.scripts[serve]!)) === "flag";
  // PORT is always set; CLIs that take `--port` get it too.
  const args = options.port !== undefined && flag ? ["--port", String(options.port)] : [];
  return [
    ...demo.setup.map((script) => ({ script, args: [] })),
    ...(options.prod && demo.prod!.build !== null ? [{ script: demo.prod!.build, args: [] }] : []),
    { script: serve, args },
  ];
}

const URL_PATTERN =
  /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(?::\d+)?(?:\/[^\s"'`)\]]*)?/;
// oxlint-disable-next-line no-control-regex -- strips terminal colors from server output
const ANSI = /\u001b\[[0-9;]*m/g;

/** The first local URL a server printed. */
export function findUrl(output: string): string | null {
  const match = URL_PATTERN.exec(output.replace(ANSI, ""));
  return match === null ? null : match[0].replace("0.0.0.0", "localhost").replace(/[.,;:]+$/, "");
}

async function answers(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000), redirect: "manual" });
    await response.body?.cancel();
    return true;
  } catch {
    return false;
  }
}

function openBrowser(url: string): void {
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  spawn(command, args, { stdio: "ignore", detached: true }).unref();
}

function run(root: string, demo: Demo, step: Step, port: number | undefined): ChildProcess {
  return spawn("pnpm", ["--dir", join(root, demo.dir), "run", step.script, ...step.args], {
    env: {
      ...process.env,
      ...(port === undefined ? {} : { PORT: String(port) }),
      FORCE_COLOR: process.env.FORCE_COLOR ?? "1",
    },
    stdio: ["inherit", "pipe", "pipe"],
    detached: true, // its own process group, so Ctrl+C stops the whole server tree
  });
}

async function start(
  root: string,
  demo: Demo,
  options: { prod: boolean; port?: number; open: boolean },
): Promise<number> {
  const plan = steps(demo, options);
  console.log(
    `\n▸ ${demo.title} (${demo.name}, ${demo.dir})${options.prod ? " · production" : ""}`,
  );
  let current: ChildProcess | undefined;
  let stopping = false;
  const stop = () => {
    if (current?.pid === undefined || current.exitCode !== null) process.exit(130);
    if (stopping) return;
    stopping = true;
    const group = -current.pid;
    const kill = (signal: NodeJS.Signals) => {
      try {
        process.kill(group, signal);
      } catch {}
    };
    kill("SIGINT");
    setTimeout(() => kill("SIGTERM"), 4000).unref();
    setTimeout(() => kill("SIGKILL"), 8000).unref();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  for (const [index, step] of plan.entries()) {
    const last = index === plan.length - 1;
    console.log(`  $ pnpm --dir ${demo.dir} run ${[step.script, ...step.args].join(" ")}`);
    const child = run(root, demo, step, options.port);
    current = child;
    let output = "";
    let announced = false;
    const watch = (chunk: Buffer, to: NodeJS.WriteStream) => {
      to.write(chunk);
      if (!last || announced) return;
      output += chunk.toString();
      const url =
        findUrl(output) ??
        (options.port === undefined ? null : `http://localhost:${options.port}/`);
      if (url === null) return;
      announced = true;
      void (async () => {
        for (let i = 0; i < 240 && child.exitCode === null; i++) {
          if (await answers(url)) {
            console.log(`\n✓ ${demo.title} is ready at ${url}  (Ctrl+C to stop)\n`);
            if (options.open) openBrowser(url);
            return;
          }
          await new Promise((done) => setTimeout(done, 500));
        }
      })();
    };
    child.stdout!.on("data", (chunk: Buffer) => watch(chunk, process.stdout));
    child.stderr!.on("data", (chunk: Buffer) => watch(chunk, process.stderr));
    const code = await new Promise<number>((done) =>
      child.on("close", (c, signal) => done(c ?? (signal ? 130 : 1))),
    );
    if (stopping) return 0; // stopped with Ctrl+C: not a failure
    if (code !== 0 || last) return code;
  }
  return 0;
}

// ---------------------------------------------------------------- listing and picking

export function formatList(demos: Demo[]): string {
  const width = Math.max(...demos.map((demo) => demo.name.length));
  const lines: string[] = [];
  let n = 0;
  for (const { kind, label } of KINDS) {
    const group = demos.filter((demo) => demo.kind === kind);
    if (group.length === 0) continue;
    lines.push(`\n${label}`);
    for (const demo of group) {
      n++;
      const prod =
        demo.prod === null
          ? ""
          : `  [--prod: ${demo.prod.build ? "build + " : ""}${demo.prod.serve}]`;
      lines.push(`  ${String(n).padStart(2)}. ${demo.name.padEnd(width)}  ${demo.title}${prod}`);
    }
  }
  return lines.join("\n").slice(1);
}

async function pick(demos: Demo[]): Promise<Demo | undefined> {
  console.log(formatList(demos));
  const ordered = KINDS.flatMap(({ kind }) => demos.filter((demo) => demo.kind === kind));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const answer = (
        await rl.question("\nStart which one? (number or name, empty to quit) ")
      ).trim();
      if (answer === "") return undefined;
      if (/^\d+$/.test(answer)) {
        const demo = ordered[Number(answer) - 1];
        if (demo) return demo;
        console.log(`No entry ${answer}.`);
        continue;
      }
      const found = resolve(demos, answer);
      if ("demo" in found) return found.demo;
      console.log(
        found.candidates.length === 0
          ? `Nothing matches "${answer}".`
          : `"${answer}" could be: ${found.candidates.map((demo) => demo.name).join(", ")}`,
      );
    }
  } finally {
    rl.close();
  }
}

async function main(): Promise<number> {
  const root = join(import.meta.dirname, "..");
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2).filter((arg) => arg !== "--"),
    allowPositionals: true,
    options: {
      list: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      prod: { type: "boolean", default: false },
      port: { type: "string" },
      open: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) {
    console.log(
      readFileSync(import.meta.filename, "utf8")
        .split("\n")
        .filter((l) => l.startsWith("//"))
        .slice(0, 9)
        .map((l) => l.slice(3))
        .join("\n"),
    );
    return 0;
  }
  const demos = discover(root);
  if (values.list || values.json) {
    console.log(values.json ? JSON.stringify(demos, null, 2) : formatList(demos));
    return 0;
  }
  const port = values.port === undefined ? undefined : Number(values.port);
  if (port !== undefined && !(Number.isInteger(port) && port > 0 && port < 65536)) {
    console.error(`--port must be a port number (got ${values.port})`);
    return 2;
  }
  let demo: Demo | undefined;
  const query = positionals.join(" ");
  if (query !== "") {
    const found = resolve(demos, query);
    if ("candidates" in found) {
      console.error(
        found.candidates.length === 0
          ? `Nothing matches "${query}". \`pnpm demo --list\` shows everything.`
          : `"${query}" is ambiguous: ${found.candidates.map((d) => d.name).join(", ")}`,
      );
      return 2;
    }
    demo = found.demo;
  } else if (process.stdin.isTTY) {
    demo = await pick(demos);
    if (demo === undefined) return 0;
  } else {
    console.log(formatList(demos));
    console.error("\nPass a name: pnpm demo <name> [--prod] [--port N] [--open]");
    return 2;
  }
  if (values.prod && demo.prod === null) {
    console.error(`${demo.name} has no production server script (preview, start, serve or view).`);
    return 2;
  }
  // The dev scripts of the examples need the native compiler; build it once if it is missing.
  if (!readdirSync(join(root, "packages/compiler")).some((file) => file.endsWith(".node"))) {
    console.log("Building the native compiler first (pnpm build:compiler)…");
    if (spawnSync("pnpm", ["build:compiler"], { cwd: root, stdio: "inherit" }).status !== 0)
      return 1;
  }
  return start(root, demo, {
    prod: values.prod,
    open: values.open,
    ...(port === undefined ? {} : { port }),
  });
}

if (import.meta.main) process.exitCode = await main();
