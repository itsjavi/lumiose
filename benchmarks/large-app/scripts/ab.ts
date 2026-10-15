// The large-app benchmark (decision-55, TASK-319): an A/B of two Lumiose builds on the synthetic
// app of scripts/generate.ts, alternated in one run on one machine. Four metrics:
//
// - buildMs: `lumiose build`, from process start to the end of the build.
// - devColdStartMs: `lumiose dev` from process start (Vite's dependency cache removed) until the
//   first page's HTML has arrived.
// - hmrMs: from saving a component until the dev server serves the page with the edit (a server
//   component, then an island component, alternately; the median of the edits).
// - serverMemoryMb: peak resident memory of the build served by @lumiose/adapter-node while it
//   answers `--requests` requests to the server-rendered routes, `--concurrency` at a time.
//
//   node scripts/ab.ts [options] <a> <b>     (pnpm --filter @lumiose/bench-large-app ab …)
//
// <a> and <b> are each a git ref (a temporary worktree gets `pnpm install` and its compiler),
// `.` (this working tree, as it is), or the directory of a prepared checkout (dependencies
// installed, `pnpm build:compiler` run). Every round runs each build once, in an order rotated
// every round, each measurement in a process of its own; the result is each metric's median per
// build and their ratio b/a (above 1: b is slower or uses more memory). With --json, stdout is
// only the result as JSON (TASK-320 reads it); progress goes to stderr.
//
// Options:
//   --rounds N        rounds (default 3)
//   --edits N         HMR edits per round and build (default 4)
//   --requests N      requests of the memory measurement (default 2000)
//   --concurrency N   requests in flight at once (default 16)
//   --routes N, --components N, --seed N   the app (defaults 1500, 5000, 1)
//   --json            print the result as JSON only
//   --keep            keep the work directory (apps, worktrees) and print where it is
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { cpus, loadavg, platform, release, arch, tmpdir, totalmem } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { generateApp, type GeneratedApp } from "./generate.ts";

const RUNNER = fileURLToPath(new URL("runner.ts", import.meta.url));
/** How long an edit may take to show before the run fails. */
const TIMEOUT_MS = 30_000;
const PKG = fileURLToPath(new URL("..", import.meta.url));

const { values: options, positionals: targets } = parseArgs({
  allowPositionals: true,
  options: {
    rounds: { type: "string", default: "3" },
    edits: { type: "string", default: "4" },
    requests: { type: "string", default: "2000" },
    concurrency: { type: "string", default: "16" },
    routes: { type: "string", default: "1500" },
    components: { type: "string", default: "5000" },
    seed: { type: "string", default: "1" },
    json: { type: "boolean", default: false },
    keep: { type: "boolean", default: false },
  },
});

/** Progress: stderr with --json, else stdout. */
const log = (text: string) => (options.json ? process.stderr : process.stdout).write(`${text}\n`);

interface Build {
  /** "a" or "b". */
  name: "a" | "b";
  label: string;
  /** The checkout whose packages the app links. */
  checkout: string;
  version: string;
  commit: string;
  /** The generated app, linked to the checkout. */
  app: string;
}

type Metric = "buildMs" | "devColdStartMs" | "hmrMs" | "serverMemoryMb";
const METRICS: Metric[] = ["buildMs", "devColdStartMs", "hmrMs", "serverMemoryMb"];

function run(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed in ${cwd}:\n${result.stderr}${result.stdout}`,
    );
  }
  return result.stdout.trim();
}

/** The checkout of a target: this working tree, a prepared directory, or a fresh worktree. */
function prepare(
  target: string,
  work: string,
  repo: string,
  worktrees: string[],
): {
  checkout: string;
  label: string;
} {
  if (target === ".") {
    log("Building the compiler of the working tree…");
    run("pnpm", ["build:compiler"], repo);
    return { checkout: repo, label: "working tree" };
  }
  if (existsSync(join(target, "packages/vite/package.json"))) {
    return { checkout: realpathSync(target), label: target };
  }
  const sha = run("git", ["rev-parse", "--verify", `${target}^{commit}`], repo);
  const checkout = join(work, `worktree-${sha.slice(0, 8)}`);
  log(`Preparing ${target} (${sha.slice(0, 8)}): worktree, pnpm install, compiler…`);
  run("git", ["worktree", "add", "--detach", checkout, sha], repo);
  worktrees.push(checkout);
  run("pnpm", ["install", "--frozen-lockfile"], checkout);
  run("pnpm", ["build:compiler"], checkout);
  return { checkout, label: `${target} (${sha.slice(0, 8)})` };
}

/** Links the checkout's Lumiose packages into the app, as an install would. */
function link(app: string, checkout: string): void {
  mkdirSync(join(app, "node_modules/@lumiose"), { recursive: true });
  symlinkSync(join(checkout, "packages/lumiose"), join(app, "node_modules/lumiose"), "junction");
  for (const name of ["vite", "cli", "compiler", "adapter-node"]) {
    symlinkSync(
      join(checkout, "packages", name),
      join(app, `node_modules/@lumiose/${name}`),
      "junction",
    );
  }
}

/** A runner process, with its stdout read line by line as JSON. */
function start(command: string, app: string, gc = false) {
  const child = spawn(process.execPath, [...(gc ? ["--expose-gc"] : []), RUNNER, command, app], {
    stdio: ["pipe", "pipe", "pipe"],
  }) as ChildProcessWithoutNullStreams;
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  const next = async <T>(): Promise<T> => {
    const { value, done } = await lines.next();
    if (done) throw new Error(`runner ${command} ended without a result:\n${stderr}`);
    return JSON.parse(value as string) as T;
  };
  const exited = new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
  return { child, next, exited };
}

async function measureBuild(build: Build): Promise<number> {
  rmSync(join(build.app, "dist"), { recursive: true, force: true });
  const runner = start("build", build.app);
  const { ms } = await runner.next<{ ms: number }>();
  await runner.exited;
  return ms;
}

async function measureMemory(build: Build, app: GeneratedApp): Promise<number> {
  const runner = start("serve", build.app, true);
  const { url } = await runner.next<{ url: string }>();
  const requests = Number(options.requests);
  let sent = 0;
  const worker = async () => {
    while (sent < requests) {
      const path = app.serverPaths[sent++ % app.serverPaths.length]!;
      const response = await fetch(url + path);
      await response.arrayBuffer();
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
    }
  };
  await Promise.all(Array.from({ length: Number(options.concurrency) }, worker));
  runner.child.stdin.write("stop\n");
  const { peakRssMb } = await runner.next<{ peakRssMb: number }>();
  await runner.exited;
  return peakRssMb;
}

async function measureDev(
  build: Build,
  app: GeneratedApp,
  edits: number,
): Promise<{ coldStart: number; hmr: number[] }> {
  // Cold: no dependency optimizer cache, no generated types.
  rmSync(join(build.app, "node_modules/.vite"), { recursive: true, force: true });
  rmSync(join(build.app, ".lumiose"), { recursive: true, force: true });
  const started = performance.now();
  const runner = start("dev", build.app);
  try {
    const { url } = await runner.next<{ url: string }>();
    const page = new URL(app.firstPage.slice(1), url).href;
    const first = await fetch(page);
    await first.text();
    const coldStart = performance.now() - started;
    if (!first.ok) throw new Error(`${page}: ${first.status}`);

    const socket = new WebSocket(url.replace(/^http/, "ws"), "vite-hmr");
    const messages: Array<{ type: string; event?: string }> = [];
    let wake: (() => void) | undefined;
    socket.addEventListener("message", (event) => {
      messages.push(JSON.parse(String(event.data)));
      wake?.();
    });
    await new Promise((resolveOpen) =>
      socket.addEventListener("open", resolveOpen, { once: true }),
    );
    const reacted = async (from: number) => {
      const deadline = performance.now() + TIMEOUT_MS;
      while (
        !messages
          .slice(from)
          .some(
            (m) =>
              m.type === "full-reload" ||
              m.type === "update" ||
              m.event === "lumiose:server-update",
          )
      ) {
        if (performance.now() > deadline) throw new Error("No HMR message after an edit");
        await new Promise<void>((resolveWake) => {
          wake = resolveWake;
          setTimeout(resolveWake, 1000);
        });
      }
    };
    const hmr: number[] = [];
    for (let edit = 0; edit < edits; edit++) {
      const file = join(build.app, edit % 2 === 0 ? app.hmr.serverComponent : app.hmr.island);
      const source = readFileSync(file, "utf8");
      const marker = `edit-${edit}-${Date.now()}`;
      // A visible change: the text before the first `{props.label}`.
      const edited = source.replace("{props.label}", `${marker} {props.label}`);
      const from = messages.length;
      const t0 = performance.now();
      writeFileSync(file, edited);
      await reacted(from);
      let body = "";
      const deadline = performance.now() + TIMEOUT_MS;
      while (!body.includes(marker)) {
        if (performance.now() > deadline) throw new Error(`${page} never showed the edit`);
        body = await (await fetch(page)).text();
      }
      hmr.push(performance.now() - t0);
      const back = messages.length;
      writeFileSync(file, source);
      await reacted(back);
    }
    socket.close();
    return { coldStart, hmr };
  } finally {
    runner.child.stdin.end();
    await runner.exited;
  }
}

/** One decimal. */
const oneDecimal = (value: number) => Math.round(value * 10) / 10;

const median = (values: number[]) => {
  const sorted = values.toSorted((x, y) => x - y);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

async function main(): Promise<void> {
  if (targets.length !== 2) {
    console.error(
      "Usage: node scripts/ab.ts [options] <a> <b>  (a git ref, `.`, or a prepared checkout)",
    );
    process.exit(2);
  }
  const repo = run("git", ["rev-parse", "--show-toplevel"], PKG);
  const work = mkdtempSync(join(tmpdir(), "lumiose-large-app-"));
  const worktrees: string[] = [];
  const cleanup = () => {
    if (options.keep) {
      log(`Kept the work directory: ${work}`);
      return;
    }
    for (const worktree of worktrees)
      spawnSync("git", ["worktree", "remove", "--force", worktree], { cwd: repo });
    spawnSync("git", ["worktree", "prune"], { cwd: repo });
    rmSync(work, { recursive: true, force: true });
  };
  process.once("SIGINT", () => {
    cleanup();
    process.exit(130);
  });
  try {
    const generate = {
      routes: Number(options.routes),
      components: Number(options.components),
      seed: Number(options.seed),
    };
    let app: GeneratedApp | undefined;
    const builds: Build[] = [];
    for (const [index, target] of targets.entries()) {
      const name = index === 0 ? "a" : "b";
      const { checkout, label } = prepare(target, work, repo, worktrees);
      const dir = join(work, `app-${name}`);
      app = generateApp(dir, generate);
      link(dir, checkout);
      const version = (
        JSON.parse(readFileSync(join(checkout, "packages/lumiose/package.json"), "utf8")) as {
          version: string;
        }
      ).version;
      const commit = run("git", ["rev-parse", "HEAD"], checkout);
      const dirty = run("git", ["status", "--porcelain"], checkout) !== "";
      builds.push({
        name,
        label,
        checkout,
        version,
        commit: `${commit.slice(0, 12)}${dirty ? " (modified)" : ""}`,
        app: dir,
      });
    }
    log(
      `App: ${app!.routes} routes, ${app!.components} components, ${app!.islands} islands. ${options.rounds} rounds.`,
    );
    const samples: Record<"a" | "b", Record<Metric, number[]>> = {
      a: { buildMs: [], devColdStartMs: [], hmrMs: [], serverMemoryMb: [] },
      b: { buildMs: [], devColdStartMs: [], hmrMs: [], serverMemoryMb: [] },
    };
    const load = [loadavg()[0]!];
    for (let round = 0; round < Number(options.rounds); round++) {
      const order = round % 2 === 0 ? builds : builds.toReversed();
      for (const build of order) {
        const buildMs = await measureBuild(build);
        const serverMemoryMb = await measureMemory(build, app!);
        const { coldStart, hmr } = await measureDev(build, app!, Number(options.edits));
        samples[build.name].buildMs.push(buildMs);
        samples[build.name].serverMemoryMb.push(serverMemoryMb);
        samples[build.name].devColdStartMs.push(coldStart);
        samples[build.name].hmrMs.push(...hmr);
        log(
          `Round ${round + 1}, ${build.name} (${build.label}): build ${Math.round(buildMs)} ms, dev cold start ${Math.round(coldStart)} ms, HMR ${hmr.map(Math.round).join("/")} ms, server memory ${serverMemoryMb} MB`,
        );
        load.push(loadavg()[0]!);
      }
    }
    const metrics = Object.fromEntries(
      METRICS.map((metric) => {
        const a = median(samples.a[metric]);
        const b = median(samples.b[metric]);
        return [
          metric,
          { a: oneDecimal(a), b: oneDecimal(b), ratio: Math.round((b / a) * 1000) / 1000 },
        ];
      }),
    ) as Record<Metric, { a: number; b: number; ratio: number }>;
    const result = {
      date: new Date().toISOString(),
      machine: {
        platform: `${platform()} ${release()} ${arch()}`,
        cpu: cpus()[0]?.model ?? "unknown",
        cores: cpus().length,
        memoryGb: Math.round(totalmem() / 1024 ** 3),
        node: process.version,
        loadAverage: { min: Math.min(...load), max: Math.max(...load) },
      },
      app: {
        routes: app!.routes,
        components: app!.components,
        islands: app!.islands,
        seed: generate.seed,
      },
      options: {
        rounds: Number(options.rounds),
        edits: Number(options.edits),
        requests: Number(options.requests),
        concurrency: Number(options.concurrency),
      },
      builds: Object.fromEntries(
        builds.map((build) => [
          build.name,
          { label: build.label, version: build.version, commit: build.commit },
        ]),
      ),
      metrics,
      samples,
    };
    if (options.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      log("");
      log(`Metric            ${"a".padStart(10)} ${"b".padStart(10)}   b/a`);
      for (const metric of METRICS) {
        const { a, b, ratio } = metrics[metric];
        log(
          `${metric.padEnd(17)} ${String(a).padStart(10)} ${String(b).padStart(10)}   ${ratio.toFixed(3)}`,
        );
      }
      log(`a: ${result.builds.a!.label}, b: ${result.builds.b!.label}`);
    }
  } finally {
    cleanup();
  }
}

await main();
