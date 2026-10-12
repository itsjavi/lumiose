// `pnpm bench:jsfb:ab`: an A/B of js-framework-benchmark CPU benchmarks in one browser session, for
// comparing variants on a busy machine. It uses krausest's own steps, CPU throttling, tracing and
// trace analysis (the webdriver-ts build that `pnpm bench:jsfb` checks out), but the frameworks
// alternate run by run (the order flips every iteration), so machine load hits every variant
// alike. It prints the medians, quartiles and paired differences against the first framework, and
// with --heap the JS heap after creating 1,000 rows (krausest's 22_run-memory way). It writes
// nothing to RESULTS.md.
//
// Run `pnpm bench:jsfb --build --frameworks lumiose,lumiose-hand` first: it checks out krausest and
// builds both into .krausest/frameworks/keyed, where any other directory with an index.html and
// dist/main.js can be a variant.
//
// Options:
//   --frameworks lumiose,lumiose-hand   directories under .krausest/frameworks/keyed (first: baseline)
//   --benchmarks 03_,04_                CPU benchmark id prefixes (default: 03_,04_)
//   --count N                           alternating iterations (default: 30)
//   --heap N                            also N heap samples per framework (default: 0)
//   --port N                            krausest server port (default 8131; env JSFB_PORT)
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const PKG = fileURLToPath(new URL("..", import.meta.url));
const KRAUSEST = join(PKG, ".krausest");
const DIST = join(KRAUSEST, "webdriver-ts/dist");

const { values: options } = parseArgs({
  options: {
    frameworks: { type: "string", default: "lumiose,lumiose-hand" },
    benchmarks: { type: "string", default: "03_,04_" },
    count: { type: "string", default: "30" },
    heap: { type: "string", default: "0" },
    port: { type: "string", default: process.env.JSFB_PORT ?? "8131" },
  },
});
const frameworks = options.frameworks.split(",");
const count = Number(options.count);
const port = Number(options.port);

// krausest's webdriver-ts modules (plain JS, untyped here).
const { startBrowser } = await import(join(DIST, "puppeteerAccess.js"));
const { benchmarks } = await import(join(DIST, "benchmarksPuppeteer.js"));
const { slowDownFactor } = await import(join(DIST, "benchmarksCommon.js"));
const { computeResultsCPU, computeResultsJS } = await import(join(DIST, "timeline.js"));
const { config } = await import(join(DIST, "common.js"));
config.LOG_PROGRESS = false;

interface Bench {
  benchmarkInfo: { id: string };
  init(page: unknown, framework: unknown): Promise<void>;
  run(page: unknown, framework: unknown): Promise<void>;
}
const selected = options.benchmarks.split(",").map((prefix) => {
  const bench = (benchmarks as Bench[]).find((b) => b.benchmarkInfo.id.startsWith(prefix));
  if (bench === undefined || !("init" in bench)) throw new Error(`no CPU benchmark ${prefix}`);
  return bench;
});

/** Starts the krausest server unless one already answers on the port; returns its stop function. */
async function startServer(): Promise<() => void> {
  const up = () =>
    fetch(`http://localhost:${port}/ls`).then(
      (response) => response.ok,
      () => false,
    );
  if (await up()) return () => {};
  const child = spawn(join(KRAUSEST, "server/node_modules/.bin/tsx"), ["index.ts"], {
    cwd: join(KRAUSEST, "server"),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "ignore", "inherit"],
  });
  for (let i = 0; i < 100; i++) {
    if (await up()) return () => child.kill();
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error(`The krausest server did not start on port ${port}.`);
}

function quantile(values: number[], p: number): number {
  const sorted = values.toSorted((a, b) => a - b);
  const k = (sorted.length - 1) * p;
  const low = Math.floor(k);
  const high = Math.min(low + 1, sorted.length - 1);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (k - low);
}

function stats(values: number[], digits = 2): string {
  const f = (p: number) => quantile(values, p).toFixed(digits);
  return `median ${f(0.5)}  IQR ${f(0.25)}–${f(0.75)}`;
}

const url = (name: string) => `http://localhost:${port}/frameworks/keyed/${name}/index.html`;
const traces = mkdtempSync(join(tmpdir(), "jsfb-ab-"));
const stop = await startServer();
// The krausest modules log every step; keep the output to the summary.
const log = console.log;
console.log = () => {};
const browser = await startBrowser({ headless: true });
const samples = new Map<string, { total: number; script: number }[]>();
const heap = new Map<string, number[]>();
try {
  for (let i = 0; i < count; i++) {
    const order = i % 2 === 0 ? frameworks : frameworks.toReversed();
    for (const bench of selected) {
      const id = bench.benchmarkInfo.id;
      for (const name of order) {
        const framework = {
          name,
          fullNameWithKeyedAndVersion: `${name}-keyed`,
          uri: `frameworks/keyed/${name}`,
          keyed: true,
          useShadowRoot: false,
          startLogicEventName: "click",
        };
        const page = await browser.newPage();
        try {
          await page.goto(url(name), { waitUntil: "networkidle0" });
          await bench.init(page, framework);
          const throttle = slowDownFactor(id, true);
          if (throttle) await page.emulateCPUThrottling(throttle);
          const trace = join(traces, `${name}_${id}_${i}.json`);
          await page.tracing.start({
            path: trace,
            screenshots: false,
            categories: [
              "disabled-by-default-v8.cpu_profiler",
              "blink.user_timing",
              "devtools.timeline",
              "disabled-by-default-devtools.timeline",
            ],
          });
          await new Promise((resolve) => setTimeout(resolve, 50));
          await page.evaluate("window.gc({type:'major',execution:'sync',flavor:'last-resort'})");
          await bench.run(page, framework);
          await new Promise((resolve) => setTimeout(resolve, 100));
          await page.tracing.stop();
          const cpu = await computeResultsCPU(trace, "click");
          const script: number = await computeResultsJS(cpu, config, trace);
          rmSync(trace, { force: true });
          const key = `${id} ${name}`;
          samples.set(key, [...(samples.get(key) ?? []), { total: cpu.duration, script }]);
        } finally {
          await page.close();
        }
      }
    }
    process.stderr.write(`${i + 1}/${count}\r`);
  }
  for (let i = 0; i < Number(options.heap); i++) {
    for (const name of i % 2 === 0 ? frameworks : frameworks.toReversed()) {
      const page = await browser.newPage();
      try {
        await page.goto(url(name), { waitUntil: "networkidle0" });
        await page.click("#run");
        await page.waitForSelector("tbody>tr:nth-of-type(1000)");
        await page.evaluate("window.gc({type:'major',execution:'sync',flavor:'last-resort'})");
        const { JSHeapUsedSize } = await page.metrics();
        heap.set(name, [...(heap.get(name) ?? []), JSHeapUsedSize / 1e6]);
      } finally {
        await page.close();
      }
    }
  }
} finally {
  console.log = log;
  await browser.close();
  stop();
  rmSync(traces, { recursive: true, force: true });
}

const [baseline] = frameworks;
for (const bench of selected) {
  const id = bench.benchmarkInfo.id;
  console.log(`\n${id}: ${count} alternating runs, total and script ms`);
  for (const name of frameworks) {
    const runs = samples.get(`${id} ${name}`) ?? [];
    console.log(
      `  ${name.padEnd(16)} total ${stats(runs.map((r) => r.total))} | script ${stats(runs.map((r) => r.script))}`,
    );
  }
  const base = samples.get(`${id} ${baseline}`) ?? [];
  for (const name of frameworks.slice(1)) {
    const runs = samples.get(`${id} ${name}`) ?? [];
    const diffs = runs.map((r, i) => r.total - base[i]!.total);
    console.log(`  paired ${name} − ${baseline}: total ${stats(diffs)}`);
  }
}
if (heap.size > 0) {
  console.log(`\nJS heap after 1,000 rows and a GC (MB)`);
  for (const name of frameworks) {
    console.log(`  ${name.padEnd(16)} ${stats(heap.get(name) ?? [], 3)}`);
  }
}
