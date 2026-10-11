// The measurements of doc-4 §4. Each function measures one app once (one iteration) and returns
// plain numbers; bench.ts loops, records and summarises.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { cpus, loadavg, tmpdir } from "node:os";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import autocannon from "autocannon";
import type { Browser, Page } from "@playwright/test";
import { type App, REPO, baseUrl, sampleRoutes, sleep, startServer } from "./apps.ts";

declare global {
  interface Window {
    __benchReady?: number;
    benchLongTasks?: [number, number][];
    benchLcp?: number;
  }
}

/** Waits for the readiness mark (doc-4 §4) and returns it. */
async function readyMark(page: Page): Promise<number> {
  // oxlint-disable-next-line no-underscore-dangle -- the readiness mark of doc-4 §4
  const handle = await page.waitForFunction(() => window.__benchReady, undefined, {
    timeout: 60_000,
  });
  return (await handle.jsonValue()) as number;
}

async function navigationTiming(page: Page): Promise<{ ttfb: number; dcl: number; load: number }> {
  await page.waitForFunction(() => {
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    return nav !== undefined && nav.loadEventEnd > 0;
  });
  return page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return { ttfb: nav.responseStart, dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd };
  });
}

// ---- dev ----

/** One page load in a fresh browser context: TTFB and `load` (navigation timing, ms). */
export async function devPageLoad(
  browser: Browser,
  url: string,
): Promise<{ ttfb: number; load: number }> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load", timeout: 120_000 });
    const { ttfb, load } = await navigationTiming(page);
    return { ttfb, load };
  } finally {
    await context.close();
  }
}

async function footerHas(page: Page, token: string): Promise<boolean> {
  try {
    return await page.evaluate(
      (t) =>
        document.querySelector('[data-testid="app-footer"]')?.textContent?.includes(t) ?? false,
      token,
    );
  } catch {
    return false; // navigating (a full reload is also a way to show the edit)
  }
}

/** Edits the HMR probe text and times until the open page's DOM shows it; restores the file. */
export async function hmr(browser: Browser, app: App): Promise<number> {
  const original = readFileSync(app.hmr.file, "utf8");
  if (!original.includes(app.hmr.find)) {
    throw new Error(`${app.id}: HMR probe "${app.hmr.find}" not found in ${app.hmr.file}`);
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  const token = `hmr${Date.now().toString(36)}`;
  try {
    await page.goto(`${baseUrl(app)}/`, { waitUntil: "load", timeout: 120_000 });
    await readyMark(page);
    await sleep(500); // let the HMR client connect
    const started = performance.now();
    writeFileSync(app.hmr.file, original.replace(app.hmr.find, `${app.hmr.find} ${token}`));
    while (!(await footerHas(page, token))) {
      if (performance.now() - started > 60_000)
        throw new Error(`${app.id}: HMR update not seen in 60 s`);
      await sleep(5);
    }
    return performance.now() - started;
  } finally {
    writeFileSync(app.hmr.file, original);
    for (let i = 0; i < 600 && (await footerHas(page, token)); i++) await sleep(50);
    await context.close();
  }
}

// ---- build ----

export function dirSize(path: string): number {
  let stats;
  try {
    stats = statSync(path);
  } catch {
    return 0;
  }
  // Precompressed copies (`.br`, `.gz` from lumiose build) are alternatives, not more output.
  if (!stats.isDirectory()) return /\.(?:br|gz)$/.test(path) ? 0 : stats.size;
  return readdirSync(path).reduce((sum, entry) => sum + dirSize(join(path, entry)), 0);
}

export interface Payload {
  jsRaw: number;
  jsGzip: number;
  jsBrotli: number;
  cssRaw: number;
  cssGzip: number;
  cssBrotli: number;
  htmlRaw: number;
  htmlGzip: number;
  requests: number;
}

const gzip = (body: Buffer): number => gzipSync(body, { level: 6 }).length;
const brotli = (body: Buffer): number =>
  brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;

/** Bytes the browser downloads for a first load (until ready and network idle), by type. */
export async function payload(browser: Browser, url: string): Promise<Payload> {
  const context = await browser.newContext();
  const result: Payload = {
    jsRaw: 0,
    jsGzip: 0,
    jsBrotli: 0,
    cssRaw: 0,
    cssGzip: 0,
    cssBrotli: 0,
    htmlRaw: 0,
    htmlGzip: 0,
    requests: 0,
  };
  const pending: Promise<void>[] = [];
  try {
    const page = await context.newPage();
    page.on("response", (response) => {
      result.requests++;
      const type = response.request().resourceType();
      pending.push(
        response
          .body()
          .then((body) => {
            if (type === "script") {
              result.jsRaw += body.length;
              result.jsGzip += gzip(body);
              result.jsBrotli += brotli(body);
            } else if (type === "stylesheet") {
              result.cssRaw += body.length;
              result.cssGzip += gzip(body);
              result.cssBrotli += brotli(body);
            } else if (type === "document") {
              result.htmlRaw += body.length;
              result.htmlGzip += gzip(body);
            }
          })
          .catch(() => {}),
      );
    });
    await page.goto(url, { waitUntil: "load" });
    await readyMark(page);
    await page.waitForLoadState("networkidle");
    await Promise.all(pending);
    return result;
  } finally {
    await context.close();
  }
}

// ---- load ----

export interface LoadTiming {
  ttfb: number;
  fcp: number;
  lcp: number;
  dcl: number;
  load: number;
  tbt: number;
  ready: number;
}

export interface LoadOptions {
  cpuThrottling: number;
  /** Optional network profile: latency (ms) and throughput (bytes/s). */
  network?: { latency: number; download: number; upload: number };
}

export const NETWORK_PROFILES: Record<string, LoadOptions["network"]> = {
  // Lighthouse's "Slow 4G" values.
  slow4g: { latency: 150, download: (1.6 * 1024 * 1024) / 8, upload: (750 * 1024) / 8 },
  fast3g: { latency: 562.5, download: (1.44 * 1024 * 1024) / 8, upload: (675 * 1024) / 8 },
};

/**
 * One production page load in a fresh context with CPU throttling: navigation timing, paint
 * timing, the readiness mark, and total blocking time (long tasks between FCP and ready/load,
 * each counting its time over 50 ms, as Lighthouse does).
 */
export async function pageLoad(
  browser: Browser,
  url: string,
  options: LoadOptions,
): Promise<LoadTiming> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: options.cpuThrottling });
    if (options.network !== undefined) {
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: options.network.latency,
        downloadThroughput: options.network.download,
        uploadThroughput: options.network.upload,
      });
    }
    await page.addInitScript(() => {
      window.benchLongTasks = [];
      window.benchLcp = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          window.benchLongTasks!.push([entry.startTime, entry.duration]);
      }).observe({ type: "longtask", buffered: true });
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        window.benchLcp = entries[entries.length - 1]!.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    await page.goto(url, { waitUntil: "load", timeout: 120_000 });
    const ready = await readyMark(page);
    const { ttfb, dcl, load } = await navigationTiming(page);
    // Let pending observer callbacks run before reading them.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 100))),
    );
    const { fcp, lcp, tasks } = await page.evaluate(() => ({
      fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0,
      lcp: window.benchLcp ?? 0,
      tasks: window.benchLongTasks ?? [],
    }));
    const end = Math.max(ready, load);
    let tbt = 0;
    for (const [start, duration] of tasks) {
      const from = Math.max(start, fcp);
      const to = Math.min(start + duration, end);
      if (to - from > 50) tbt += to - from - 50;
    }
    return { ttfb, fcp, lcp, dcl, load, tbt, ready };
  } finally {
    await context.close();
  }
}

// ---- server ----

export interface Throughput {
  rps: number;
  p50: number;
  p99: number;
  errors: number;
}

export async function loadTest(
  url: string,
  durationS: number,
  connections = 50,
): Promise<Throughput> {
  const result = await autocannon({ url, connections, duration: durationS });
  return {
    rps: result.requests.average,
    p50: result.latency.p50,
    p99: result.latency.p99,
    errors: result.errors + result.timeouts + result.non2xx,
  };
}

export interface IdleOptions {
  /** Pause before checking, so the previous round's sockets and GC settle. */
  coolDownMs: number;
  /** Highest 1-minute load average per core that counts as idle. */
  maxLoadPerCore: number;
  /** Give up waiting after this long (the round then runs anyway and is reported). */
  timeoutMs: number;
}

export interface IdleState {
  /** 1-minute load average when the round started. */
  load: number;
  /** Whether it was at or under the threshold. */
  idle: boolean;
  waitedMs: number;
}

/**
 * Cool-down, then waits until the machine is idle (1-minute load average per core at or under
 * `maxLoadPerCore`) before a load-test round, so a transient spike from another process does not
 * land on one framework's rounds.
 */
export async function waitForIdle(options: IdleOptions): Promise<IdleState> {
  const started = performance.now();
  await sleep(options.coolDownMs);
  const limit = options.maxLoadPerCore * cpus().length;
  let load = loadavg()[0]!;
  while (load > limit && performance.now() - started < options.timeoutMs) {
    await sleep(1000);
    load = loadavg()[0]!;
  }
  return { load, idle: load <= limit, waitedMs: performance.now() - started };
}

// ---- other ----

const CODE = new Set([
  ".ts",
  ".tsx",
  ".stsx",
  ".svelte",
  ".vue",
  ".astro",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".html",
  ".md",
  ".mdx",
]);

/** Source files under `dir` (tracked or not ignored by git) and their non-blank lines. */
function sourceSizeOf(dir: string): { files: number; lines: number } {
  const files = new Set(
    execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "."], {
      cwd: dir,
      encoding: "utf8",
    })
      .split("\n")
      .filter((file) => CODE.has(extname(file)) && !file.endsWith(".d.ts")),
  );
  let lines = 0;
  for (const file of files) {
    try {
      lines += readFileSync(join(dir, file), "utf8")
        .split("\n")
        .filter((line) => line.trim() !== "").length;
    } catch {}
  }
  return { files: files.size, lines };
}

/** The app's own sources and the shared UI packages it is built from (doc-4 §4 "Other"). */
export function sourceSize(app: App): {
  app: { files: number; lines: number };
  shared: { files: number; lines: number };
} {
  const shared = { files: 0, lines: 0 };
  for (const dir of app.sharedSources) {
    const size = sourceSizeOf(dir);
    shared.files += size.files;
    shared.lines += size.lines;
  }
  return { app: sourceSizeOf(app.dir), shared };
}

const TRACE_HOOK = fileURLToPath(new URL("./trace-loads.ts", import.meta.url));
const HARNESS_DIR = fileURLToPath(new URL("..", import.meta.url));

/**
 * The package a loaded file belongs to: the directory after its last `node_modules/` (scoped
 * packages included), or, outside node_modules, its nearest package.json with a name (a
 * workspace package such as @bench/data).
 */
function packageRoot(file: string): string | undefined {
  const marker = "/node_modules/";
  const at = file.lastIndexOf(marker);
  if (at !== -1) {
    const [first = "", second = ""] = file.slice(at + marker.length).split("/");
    return (
      file.slice(0, at + marker.length) + (first.startsWith("@") ? `${first}/${second}` : first)
    );
  }
  for (let dir = dirname(file); dirname(dir) !== dir; dir = dirname(dir)) {
    const manifest = join(dir, "package.json");
    if (!existsSync(manifest)) continue;
    if ((JSON.parse(readFileSync(manifest, "utf8")) as { name?: string }).name) return dir;
  }
  return undefined;
}

/**
 * The packages the app's production server loads at runtime (doc-4 §4 "Other"): the server runs
 * with a module hook (trace-loads.ts) that records every file it resolves, by `import` or
 * `require`, while a browser loads the benchmark's pages and the other routes are requested once.
 * Each file maps to its package; the app itself and its build output (Nitro's
 * `.output/server/package.json`) are not dependencies, and files outside the repository (the
 * package manager running the script) are not the server's. Code a build inlined into its output
 * is not a package load, so a self-contained build counts 0.
 */
export async function runtimeDependencies(
  browser: Browser,
  app: App,
): Promise<{ count: number; packages: string[] }> {
  const log = join(tmpdir(), `bench-loads-${app.id}-${process.pid}-${Date.now()}.txt`);
  const server = await startServer(app, "start", {
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import ${TRACE_HOOK}`.trim(),
    BENCH_TRACE_LOADS: log,
  });
  try {
    const paths = await sampleRoutes(app);
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      for (const path of [paths.home, paths.project, paths.issue]) {
        await page.goto(baseUrl(app) + path, { waitUntil: "load", timeout: 120_000 });
        await readyMark(page);
        await page.waitForLoadState("networkidle");
      }
    } finally {
      await context.close();
    }
    const id = paths.issue.split("/").pop()!;
    for (const path of [
      "/issues/new",
      "/search?q=error",
      "/login",
      `/api/issues/${id}`,
      "/api/search?q=error",
      "/no/such/page",
    ]) {
      await (await fetch(baseUrl(app) + path)).arrayBuffer();
    }
  } finally {
    await server.stop();
  }
  const roots = new Set<string>();
  const appDir = realpathSync(app.dir);
  for (const url of existsSync(log) ? readFileSync(log, "utf8").split("\n") : []) {
    if (!url.startsWith("file:")) continue;
    const file = fileURLToPath(url);
    if (!file.startsWith(REPO)) continue;
    const root = packageRoot(file);
    if (root === undefined || root === HARNESS_DIR.replace(/\/$/, "")) continue;
    // The app and its build output are not dependencies; its node_modules are.
    if ((root === appDir || root.startsWith(`${appDir}/`)) && !root.includes("/node_modules/"))
      continue;
    roots.add(root);
  }
  rmSync(log, { force: true });
  const packages = [...roots]
    .map((root) => {
      const at = root.lastIndexOf("/node_modules/");
      return at === -1 ? relative(REPO, root) : root.slice(at + "/node_modules/".length);
    })
    .toSorted();
  return { count: roots.size, packages };
}
