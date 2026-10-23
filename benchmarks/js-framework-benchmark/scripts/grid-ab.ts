// `pnpm bench:grid:ab [<a>] [<b>]`: an in-process A/B of nested keyed lists in Chrome (TASK-522).
// Both runtime builds load into one page and are measured alternately (the order flips every
// round), so machine load hits both alike. Each sample mounts one build's grid (src/grid/main.tsx:
// 10 keyed rows of 8 keyed cards), replaces every row, and times it until the next frame has
// painted (a `requestAnimationFrame`, then a task), at a CPU slowdown, with a full GC before each
// sample. It prints the medians, quartiles and the median of the paired differences, plus the DOM
// mutations of one replace (MutationObserver records and nodes). It writes no results file.
//
// <a> and <b> are each a git ref, whose packages/lumiose/src is exported with `git archive`, or
// `.` (this working tree, uncommitted changes included); the defaults are HEAD and `.`. The page
// itself is always this checkout's src/grid/main.tsx, compiled by this checkout's @lumiose/vite.
//
// Options:
//   --rounds N     alternating rounds (default 40)
//   --warmup N     untimed rounds first (default 5)
//   --cpu N        CPU slowdown (default 4)
//   --shapes LIST  fragment,element (default both)
//   CHROME_PATH    the Chrome binary (default: the macOS install, as scripts/jsfb.ts)
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable, Writable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import lumiose from "@lumiose/vite";
import { build } from "vite";

const PKG = fileURLToPath(new URL("..", import.meta.url));
const REPO = join(PKG, "../..");
const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    rounds: { type: "string", default: "40" },
    warmup: { type: "string", default: "5" },
    cpu: { type: "string", default: "4" },
    shapes: { type: "string", default: "fragment,element" },
  },
});
const [refA = "HEAD", refB = "."] = positionals;
const rounds = Number(options.rounds);
const warmup = Number(options.warmup);
const cpu = Number(options.cpu);
const shapes = options.shapes.split(",");

const work = mkdtempSync(join(tmpdir(), "lumiose-grid-ab-"));

/** The runtime sources (packages/lumiose/src) of `ref`. */
function runtime(ref: string, name: string): string {
  if (ref === ".") return join(REPO, "packages/lumiose/src");
  const dir = join(work, `src-${name}`);
  mkdirSync(dir);
  const tar = join(work, `${name}.tar`);
  const archive = spawnSync("git", ["archive", "-o", tar, ref, "packages/lumiose/src"], {
    cwd: REPO,
    encoding: "utf8",
  });
  if (archive.status !== 0) throw new Error(`git archive ${ref}: ${archive.stderr}`);
  const untar = spawnSync("tar", ["-xf", tar, "-C", dir], { encoding: "utf8" });
  if (untar.status !== 0) throw new Error(`tar: ${untar.stderr}`);
  return join(dir, "packages/lumiose/src");
}

/** Builds the grid page against the runtime in `src`, as one classic script `<name>.js`. */
async function bundle(src: string, name: string): Promise<void> {
  await build({
    configFile: false,
    root: PKG,
    logLevel: "warn",
    mode: "production",
    plugins: [lumiose()],
    resolve: {
      alias: [
        { find: /^lumiose$/, replacement: join(src, "index.ts") },
        { find: /^lumiose\/dom$/, replacement: join(src, "dom/index.ts") },
      ],
    },
    build: {
      outDir: join(work, "page"),
      emptyOutDir: false,
      target: "esnext",
      lib: {
        entry: join(PKG, "src/grid/main.tsx"),
        formats: ["iife"],
        name: `grid_${name}`,
        fileName: () => `${name}.js`,
      },
    },
  });
}

const CSS = `
body { margin: 0; font: 14px/1.4 system-ui, sans-serif; }
.grid { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 12px; padding: 12px; }
.grid > .spacer { grid-column: 1 / -1; height: 40px; }
.rows > .row { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 12px; padding: 6px 12px; }
.rows > .spacer { height: 40px; }
.card { display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px solid #ddd; border-radius: 8px; background: #fff; }
.card:hover { border-color: #888; }
.card > :not(:last-child) { margin-bottom: 2px; }
.pick { display: flex; flex-direction: column; align-items: stretch; gap: 4px; padding: 0; border: 0; background: none; font: inherit; text-align: start; cursor: pointer; }
.thumb { display: block; aspect-ratio: 1; border-radius: 4px; background: linear-gradient(135deg, #eee, #ccc); }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.tag { align-self: flex-start; padding: 0 6px; border-radius: 999px; background: #fde68a; font-size: 12px; }
.card footer { display: flex; justify-content: space-between; color: #555; }
.card footer > * + * { margin-inline-start: 4px; }
.grid > :nth-child(8n + 2), .rows > .row > :first-child { border-color: #bbb; }
.card:has(.tag) .name { color: #92400e; }
.grid:has(.card:focus-within), .rows:has(.card:focus-within) { outline: 2px solid #93c5fd; }
`;

// ---- a minimal Chrome DevTools Protocol client over --remote-debugging-pipe -------------------

interface Message {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: { message: string };
  sessionId?: string;
}

function launchChrome(profile: string) {
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-pipe",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--window-size=1280,900",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] },
  );
  const input = chrome.stdio[3] as Writable;
  const output = chrome.stdio[4] as Readable;
  const pending = new Map<number, (message: Message) => void>();
  const listeners: ((message: Message) => void)[] = [];
  let buffer = "";
  let seq = 0;
  output.setEncoding("utf8");
  output.on("data", (chunk: string) => {
    buffer += chunk;
    let end: number;
    while ((end = buffer.indexOf("\0")) !== -1) {
      const message = JSON.parse(buffer.slice(0, end)) as Message;
      buffer = buffer.slice(end + 1);
      if (message.id !== undefined) pending.get(message.id)?.(message);
      else for (const listener of listeners) listener(message);
    }
  });
  const send = (
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string,
  ): Promise<Record<string, unknown>> =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, (message) => {
        pending.delete(id);
        if (message.error) reject(new Error(`${method}: ${message.error.message}`));
        else resolve(message.result ?? {});
      });
      input.write(`${JSON.stringify({ id, method, params, sessionId })}\0`);
    });
  const once = (method: string): Promise<Message> =>
    new Promise((resolve) => {
      const listener = (message: Message) => {
        if (message.method !== method) return;
        listeners.splice(listeners.indexOf(listener), 1);
        resolve(message);
      };
      listeners.push(listener);
    });
  return { send, once, close: () => chrome.kill() };
}

// ---- in-page measurement ----------------------------------------------------------------------

/** One sample: mounts build `index` with `shape`, replaces every row, times it until painted. */
const SAMPLE = `async (index, shape) => {
  const api = globalThis.lumioseGrid[index];
  const root = document.getElementById("root");
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  api.mount(root, shape);
  await frame();
  await frame();
  const start = performance.now();
  api.replace();
  const script = performance.now() - start;
  root.offsetHeight;
  const layout = performance.now() - start;
  await frame();
  const total = performance.now() - start;
  api.unmount();
  await frame();
  return [total, layout, script];
}`;

/** The mutations one replace makes under the grid: records, added and removed nodes. */
const MUTATIONS = `async (index, shape) => {
  const api = globalThis.lumioseGrid[index];
  const root = document.getElementById("root");
  api.mount(root, shape);
  const counts = { records: 0, added: 0, removed: 0 };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      counts.records++;
      counts.added += record.addedNodes.length;
      counts.removed += record.removedNodes.length;
    }
  });
  observer.observe(root.firstChild, { childList: true, subtree: true });
  api.replace();
  await Promise.resolve();
  observer.disconnect();
  api.unmount();
  return counts;
}`;

function quantile(sorted: number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const lo = Math.floor(position);
  const hi = Math.ceil(position);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (position - lo);
}

function stats(values: number[]): { median: number; p25: number; p75: number } {
  const sorted = values.toSorted((x, y) => x - y);
  return {
    median: quantile(sorted, 0.5),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
  };
}

const fmt = (ms: number) => ms.toFixed(2);

async function main(): Promise<void> {
  const refs = [refA, refB];
  const names = ["a", "b"];
  for (let i = 0; i < 2; i++) await bundle(runtime(refs[i]!, names[i]!), names[i]!);
  const page = join(work, "page");
  writeFileSync(
    join(page, "index.html"),
    `<!doctype html><meta charset="utf-8"><style>${CSS}</style><div id="root"></div><script src="a.js"></script><script src="b.js"></script>`,
  );

  const chrome = launchChrome(join(work, "profile"));
  try {
    const { targetId } = await chrome.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = (await chrome.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    })) as { sessionId: string };
    const send = (method: string, params?: Record<string, unknown>) =>
      chrome.send(method, params, sessionId);
    await send("Page.enable");
    const loaded = chrome.once("Page.loadEventFired");
    await send("Page.navigate", { url: pathToFileURL(join(page, "index.html")).href });
    await loaded;
    await send("Emulation.setCPUThrottlingRate", { rate: cpu });
    const evaluate = async <T>(fn: string, ...args: unknown[]): Promise<T> => {
      const { result, exceptionDetails } = (await send("Runtime.evaluate", {
        expression: `(${fn})(${args.map((arg) => JSON.stringify(arg)).join(", ")})`,
        awaitPromise: true,
        returnByValue: true,
      })) as { result: { value: T }; exceptionDetails?: { text: string } };
      if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails));
      return result.value;
    };
    const builds = await evaluate<number>("() => globalThis.lumioseGrid.length");
    if (builds !== 2) throw new Error(`expected 2 builds in the page, found ${builds}`);

    console.log(`grid A/B: a = ${refA}, b = ${refB}; ${rounds} rounds, ${cpu}x CPU slowdown`);
    for (const shape of shapes) {
      // Per build: until painted, script with style and layout (forced), script alone.
      const metrics: number[][][] = [
        [[], [], []],
        [[], [], []],
      ];
      for (let round = -warmup; round < rounds; round++) {
        const order = round % 2 === 0 ? [0, 1] : [1, 0];
        for (const index of order) {
          await send("HeapProfiler.collectGarbage");
          const values = await evaluate<number[]>(SAMPLE, index, shape);
          if (round >= 0) values.forEach((ms, m) => metrics[index]![m]!.push(ms));
        }
      }
      console.log(`\n${shape} rows: replace 10 rows x 8 cards (ms)`);
      const labels = ["until painted", "script, style and layout (forced)", "script"];
      for (let m = 0; m < labels.length; m++) {
        const label = labels[m]!;
        const samples = [metrics[0]![m]!, metrics[1]![m]!];
        const [a, b] = samples.map(stats) as [ReturnType<typeof stats>, ReturnType<typeof stats>];
        const diffs = stats(samples[1]!.map((ms, i) => ms - samples[0]![i]!));
        console.log(`  ${label}`);
        console.log(`    a ${fmt(a.median)} (p25 ${fmt(a.p25)}, p75 ${fmt(a.p75)})`);
        console.log(`    b ${fmt(b.median)} (p25 ${fmt(b.p25)}, p75 ${fmt(b.p75)})`);
        console.log(
          `    b - a, paired: median ${fmt(diffs.median)} (p25 ${fmt(diffs.p25)}, p75 ${fmt(diffs.p75)}); b / a ${(b.median / a.median).toFixed(3)}`,
        );
      }
      await send("Emulation.setCPUThrottlingRate", { rate: 1 });
      for (let index = 0; index < 2; index++) {
        const counts = await evaluate<Record<string, number>>(MUTATIONS, index, shape);
        console.log(
          `  ${names[index]} mutations: ${counts.records} records, ${counts.added} nodes added, ${counts.removed} removed`,
        );
      }
      await send("Emulation.setCPUThrottlingRate", { rate: cpu });
    }
  } finally {
    chrome.close();
    rmSync(work, { recursive: true, force: true });
  }
}

await main();
