// `pnpm bench:jsfb`: runs krausest/js-framework-benchmark's own runner (webdriver-ts: Puppeteer,
// Chrome trace timing, CPU throttling and memory measurement exactly as upstream) for Lumiose and
// reference frameworks, then writes RESULTS.md.
//
// Steps: check out a pinned krausest commit (sparse, shallow) into .krausest/, install its server
// and runner, build the reference frameworks and the local ones (frameworks/keyed/<name>: krausest
// layout, copied into the checkout), build this package (Vite, production) into
// .krausest/frameworks/keyed/lumiose (and lumiose-hand), start the krausest server, run the benchmarks, summarize.
//
// Options:
//   --frameworks lumiose,vanillajs,...  default: lumiose, lumiose-hand, every reference and local framework
//   --benchmarks 01_,22_,40_          krausest id prefixes; default: all (CPU, memory, size)
//   --count N                         iterations per CPU benchmark (krausest default: 15)
//   --mem-count N                     iterations per memory benchmark (krausest default: 1)
//   --headed                          show the browser (default: headless)
//   --summary                         only rewrite RESULTS.md from existing results
//   --build                           only set up and build (for manual runs against the server)
//   --port N                          krausest server port (default 8131; env JSFB_PORT)
import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { cpus, platform, release } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { build } from "vite";

const PKG = fileURLToPath(new URL("..", import.meta.url));
const KRAUSEST = join(PKG, ".krausest");
const RUNNER = join(KRAUSEST, "webdriver-ts");
const SERVER = join(KRAUSEST, "server");
const REPO = "https://github.com/krausest/js-framework-benchmark";
/** Pinned upstream commit (2026-10, Chrome 154 results); bump deliberately. */
const COMMIT = "bf894b681fb56433ccb6efb4a3c93e35eda2b20d";
const REFERENCE = ["vanillajs", "solid", "svelte", "vue-vapor", "react-hooks"];
/**
 * Keyed implementations kept in this package (frameworks/keyed/<name>, krausest's layout: package.json
 * with `build-prod`, package-lock.json, index.html, src/) for frameworks krausest has no entry for.
 */
const LOCAL = ["remix-v3"];
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** krausest's CPU benchmarks, with their weights in the weighted geometric mean (webdriver-ts-results). */
const CPU = [
  ["01_run1k", "create rows", 0.64280248137063],
  ["02_replace1k", "replace all rows", 0.5607178150466176],
  ["03_update10th1k_x16", "partial update (4x slowdown)", 0.5643800750716564],
  ["04_select1k", "select row (4x slowdown)", 0.1925635870170522],
  ["05_swap1k", "swap rows (4x slowdown)", 0.13200612879341714],
  ["06_remove-one-1k", "remove row (2x slowdown)", 0.5277091212292658],
  ["07_create10k", "create many rows", 0.5644449600965534],
  ["08_create1k-after1k_x2", "append rows to large table", 0.5508359820582848],
  ["09_clear1k_x8", "clear rows (4x slowdown)", 0.4225836631419211],
] as const;
const MEMORY = [
  ["21_ready-memory", "ready memory"],
  ["22_run-memory", "run memory (1k rows)"],
  ["25_run-clear-memory", "create/clear 1k rows (5 cycles)"],
] as const;
const SIZE = [
  ["41_size-uncompressed", "uncompressed size (kB)"],
  ["42_size-compressed", "compressed size (kB)"],
  ["43_first-paint", "first paint (ms)"],
] as const;

const { values: options } = parseArgs({
  options: {
    frameworks: { type: "string" },
    benchmarks: { type: "string" },
    count: { type: "string" },
    "mem-count": { type: "string" },
    headed: { type: "boolean", default: false },
    summary: { type: "boolean", default: false },
    build: { type: "boolean", default: false },
    port: { type: "string", default: process.env.JSFB_PORT ?? "8131" },
  },
});
const frameworks = options.frameworks?.split(",") ?? [
  "lumiose",
  "lumiose-hand",
  ...REFERENCE,
  ...LOCAL,
];
const benchmarks = options.benchmarks?.split(",");
const port = Number(options.port);

function sh(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      // The runner drives the installed Chrome; skip every browser download.
      CHROMEDRIVER_SKIP_DOWNLOAD: "true",
      PUPPETEER_SKIP_DOWNLOAD: "true",
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1",
    },
  });
  if (result.status !== 0) {
    throw new Error(`\`${command} ${args.join(" ")}\` failed in ${cwd}`);
  }
}

const readJSON = (path: string): any => JSON.parse(readFileSync(path, "utf8"));

// ---- setup ----------------------------------------------------------------------------------------

function checkout(): void {
  if (existsSync(join(KRAUSEST, ".git"))) {
    return;
  }
  mkdirSync(KRAUSEST, { recursive: true });
  sh("git", ["init", "-q"], KRAUSEST);
  sh("git", ["remote", "add", "origin", REPO], KRAUSEST);
  const keep = ["/*", "!/*/", "/css/", "/server/", "/webdriver-ts/"];
  sh(
    "git",
    [
      "sparse-checkout",
      "set",
      "--no-cone",
      ...keep,
      ...REFERENCE.map((f) => `/frameworks/keyed/${f}/`),
    ],
    KRAUSEST,
  );
  sh("git", ["fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", COMMIT], KRAUSEST);
  sh("git", ["checkout", "-q", "FETCH_HEAD"], KRAUSEST);
}

function install(): void {
  // The server lists frameworks from both directories.
  mkdirSync(join(KRAUSEST, "frameworks/non-keyed"), { recursive: true });
  if (!existsSync(join(SERVER, "node_modules"))) {
    sh("npm", ["ci", "--no-audit", "--no-fund"], SERVER);
  }
  if (!existsSync(join(RUNNER, "dist/benchmarkRunner.js"))) {
    sh("npm", ["ci", "--no-audit", "--no-fund"], RUNNER);
    sh("npm", ["run", "compile"], RUNNER);
  }
  for (const name of frameworks) {
    const dir = join(KRAUSEST, "frameworks/keyed", name);
    if (LOCAL.includes(name)) {
      installLocal(name, dir);
      continue;
    }
    if (name in LUMIOSE || !existsSync(dir)) {
      continue;
    }
    const pkg = readJSON(join(dir, "package.json"));
    const hasDeps = pkg.dependencies !== undefined || pkg.devDependencies !== undefined;
    if (hasDeps && !existsSync(join(dir, "dist"))) {
      sh("npm", ["ci", "--no-audit", "--no-fund"], dir);
      sh("npm", ["run", "build-prod"], dir);
    }
  }
}

function lockfile(dir: string): string | undefined {
  const path = join(dir, "package-lock.json");
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

/**
 * Copies a local implementation into the checkout, installs its dependencies when its lockfile
 * changed, and runs its production build (every time, so source edits are always measured).
 */
function installLocal(name: string, dest: string): void {
  const source = join(PKG, "frameworks/keyed", name);
  const stale = !existsSync(join(dest, "node_modules")) || lockfile(source) !== lockfile(dest);
  mkdirSync(dest, { recursive: true });
  rmSync(join(dest, "src"), { recursive: true, force: true });
  for (const entry of ["index.html", "package.json", "package-lock.json", "src"]) {
    cpSync(join(source, entry), join(dest, entry), { recursive: true });
  }
  if (stale) {
    sh("npm", ["ci", "--no-audit", "--no-fund"], dest);
  }
  sh("npm", ["run", "build-prod"], dest);
}

/** Lumiose's krausest implementations: directory name → Vite build mode and output directory. */
const LUMIOSE: Record<string, { mode: string; outDir: string }> = {
  // src/App.stsx compiled by @lumiose/vite: the implementation.
  lumiose: { mode: "production", outDir: "dist" },
  // The hand-compiled reference written from the compiler-runtime contract (src/hand-compiled.js).
  "lumiose-hand": { mode: "hand", outDir: "dist-hand" },
};

/** Builds a Lumiose app and lays it out as krausest's frameworks/keyed/<name>. */
async function buildLumiose(name: string): Promise<void> {
  const { mode, outDir } = LUMIOSE[name]!;
  await build({ root: PKG, configFile: join(PKG, "vite.config.ts"), mode, logLevel: "warn" });
  const dest = join(KRAUSEST, "frameworks/keyed", name);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(join(dest, "dist"), { recursive: true });
  copyFileSync(join(PKG, "index.html"), join(dest, "index.html"));
  copyFileSync(join(PKG, outDir, "main.js"), join(dest, "dist/main.js"));
  const version = readJSON(join(PKG, "../../packages/lumiose/package.json")).version as string;
  const manifest = {
    name: `js-framework-benchmark-${name}`,
    version,
    private: true,
    "js-framework-benchmark": { frameworkVersion: version, language: "JavaScript" },
  };
  writeFileSync(join(dest, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  // The server only lists directories that also have a lockfile.
  writeFileSync(
    join(dest, "package-lock.json"),
    `${JSON.stringify({ name: manifest.name, version, lockfileVersion: 3, requires: true, packages: {} })}\n`,
  );
}

// ---- server and runner ----------------------------------------------------------------------------

interface ListedFramework {
  directory: string;
  frameworkVersionString: string;
}

async function listFrameworks(): Promise<ListedFramework[] | undefined> {
  try {
    const response = await fetch(`http://localhost:${port}/ls`);
    return response.ok ? ((await response.json()) as ListedFramework[]) : undefined;
  } catch {
    return undefined;
  }
}

/** Starts the krausest server unless one already answers on the port; returns its stop function. */
async function startServer(): Promise<() => void> {
  if ((await listFrameworks()) !== undefined) {
    return () => {};
  }
  const child = spawn(join(SERVER, "node_modules/.bin/tsx"), ["index.ts"], {
    cwd: SERVER,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "ignore", "inherit"],
  });
  for (let i = 0; i < 100; i++) {
    if ((await listFrameworks()) !== undefined) {
      return () => child.kill();
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error(`The krausest server did not start on port ${port}.`);
}

/** Version-qualified result names (`solid-v1.9.3-keyed`) of the selected frameworks. */
async function resultNames(): Promise<Map<string, string>> {
  const listed = (await listFrameworks()) ?? [];
  const names = new Map<string, string>();
  for (const name of frameworks) {
    const entry = listed.find((f) => f.directory === name);
    if (entry !== undefined) {
      names.set(name, entry.frameworkVersionString);
    }
  }
  return names;
}

function selected(id: string): boolean {
  return benchmarks === undefined || benchmarks.some((prefix) => id.startsWith(prefix));
}

async function runBenchmarks(names: Map<string, string>): Promise<number> {
  const results = join(RUNNER, "results");
  mkdirSync(results, { recursive: true });
  // Drop stale results of what is about to run (size results are named 41_…43_ but run as 40_).
  const ids = [...CPU, ...MEMORY, ...SIZE].map(([id]) => id);
  for (const name of names.values()) {
    for (const id of ids) {
      if (selected(id) || (id.startsWith("4") && selected("40_"))) {
        rmSync(join(results, `${name}_${id}.json`), { force: true });
      }
    }
  }
  // krausest's `--count` sets both CPU and memory iterations; run them separately so each gets its own.
  const cpu = CPU.map(([id]) => id).filter(selected);
  const other = MEMORY.map(([id]) => id as string).filter(selected);
  if (SIZE.some(([id]) => selected(id)) || selected("40_")) {
    other.push("40_");
  }
  let code = 0;
  if (cpu.length > 0) {
    code ||= await runner(cpu, options.count);
  }
  if (other.length > 0) {
    code ||= await runner(other, options["mem-count"]);
  }
  return code;
}

function runner(ids: string[], count: string | undefined): Promise<number> {
  const args = ["dist/benchmarkRunner.js", "--framework", ...frameworks.map((f) => `keyed/${f}`)];
  args.push("--benchmark", ...ids);
  if (count !== undefined) {
    args.push("--count", count);
  }
  if (!options.headed) {
    args.push("--headless");
  }
  const child = spawn("node", args, {
    cwd: RUNNER,
    env: { ...process.env, PORT: String(port), LANG: "en_US.UTF-8" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  // The runner is very verbose: keep its per-benchmark summaries and errors.
  const keep =
    /^(==> Duration for benchmark|result .*(total|DEFAULT)|ERROR|Executing .* failed|run was not)/;
  for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on("line", (line) => {
      if (keep.test(line)) {
        console.log(line);
      }
    });
  }
  return new Promise((resolve) => child.on("close", (code) => resolve(code ?? 1)));
}

// ---- summary --------------------------------------------------------------------------------------

type Stats = { median: number; mean: number; values: number[] };
type Result = { values: Record<string, Stats> };

function median(values: number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function localResult(name: string, id: string): Result | undefined {
  const path = join(RUNNER, "results", `${name}_${id}.json`);
  return existsSync(path) ? (readJSON(path) as Result) : undefined;
}

/** Medians from krausest's published run (webdriver-ts/results.json, same Chrome and versions). */
function officialMedians(): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  const path = join(RUNNER, "results.json");
  if (!existsSync(path)) {
    return out;
  }
  for (const entry of readJSON(path) as {
    framework: string;
    benchmark: string;
    values: Record<string, number[]>;
  }[]) {
    if (!entry.framework.endsWith("-keyed") || entry.framework.endsWith("-non-keyed")) {
      continue;
    }
    const values = entry.values.total ?? entry.values.DEFAULT;
    if (values !== undefined) {
      let row = out.get(entry.benchmark);
      if (row === undefined) {
        out.set(entry.benchmark, (row = new Map()));
      }
      row.set(entry.framework, median(values));
    }
  }
  return out;
}

const weighted = (factors: (number | undefined)[]): number | undefined => {
  let sum = 0;
  let weights = 0;
  CPU.forEach(([, , weight], i) => {
    const factor = factors[i];
    if (factor !== undefined) {
      sum += weight * Math.log(factor);
      weights += weight;
    }
  });
  return weights === 0 ? undefined : Math.exp(sum / weights);
};

function bundleSizes(path: string): { min: number; gzip: number; brotli: number } | undefined {
  if (!existsSync(path)) {
    return undefined;
  }
  const code = readFileSync(path);
  return {
    min: code.length,
    gzip: gzipSync(code, { level: 9 }).length,
    brotli: brotliCompressSync(code, {
      params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
    }).length,
  };
}

function chromeVersion(): string {
  const result = spawnSync(CHROME, ["--version"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "unknown Chrome";
}

const fmt = (n: number | undefined, digits = 1): string =>
  n === undefined ? "–" : n.toFixed(digits);
const kB = (bytes: number): string => (bytes / 1024).toFixed(2);

function summarize(names: Map<string, string>): string {
  const columns = frameworks.filter((f) => names.has(f));
  const header = (first: string): string =>
    `| ${first} | ${columns.join(" | ")} |\n|---|${columns.map(() => "---:").join("|")}|`;
  const official = officialMedians();
  const lines: string[] = [];

  // CPU: median total duration (ms) and factor versus the fastest local framework.
  const factors = new Map<string, (number | undefined)[]>(columns.map((f) => [f, []]));
  const projected = new Map<string, (number | undefined)[]>(columns.map((f) => [f, []]));
  const published = new Map<string, (number | undefined)[]>(columns.map((f) => [f, []]));
  const cpuRows: string[] = [];
  const scriptRows: string[] = [];
  for (const [id, label] of CPU) {
    const totals = columns.map((f) => localResult(names.get(f)!, id)?.values.total?.median);
    const scripts = columns.map((f) => localResult(names.get(f)!, id)?.values.script?.median);
    const min = Math.min(...totals.filter((t): t is number => t !== undefined));
    const vanilla = totals[columns.indexOf("vanillajs")];
    const officialRow = official.get(id);
    const officialMin = officialRow === undefined ? undefined : Math.min(...officialRow.values());
    const officialVanilla = officialRow?.get("vanillajs-keyed");
    columns.forEach((f, i) => {
      const total = totals[i];
      factors.get(f)!.push(total === undefined ? undefined : total / min);
      const officialTotal = officialRow?.get(names.get(f)!);
      published
        .get(f)!
        .push(
          officialTotal === undefined || officialMin === undefined
            ? undefined
            : officialTotal / officialMin,
        );
      // Calibrated to the published table: local ratio to vanillajs times vanillajs's published factor.
      projected
        .get(f)!
        .push(
          total === undefined ||
            vanilla === undefined ||
            officialMin === undefined ||
            officialVanilla === undefined
            ? undefined
            : (total / vanilla) * (officialVanilla / officialMin),
        );
    });
    cpuRows.push(
      `| ${id} ${label} | ${totals.map((t) => (t === undefined ? "–" : `${fmt(t)} (${fmt(t / min, 2)})`)).join(" | ")} |`,
    );
    scriptRows.push(`| ${id} | ${scripts.map((s) => fmt(s)).join(" | ")} |`);
  }
  const geo = (map: Map<string, (number | undefined)[]>): string =>
    columns.map((f) => fmt(weighted(map.get(f)!), 3)).join(" | ");

  // Memory (MB) and size.
  const memoryRows = MEMORY.map(
    ([id, label]) =>
      `| ${id} ${label} | ${columns.map((f) => fmt(localResult(names.get(f)!, id)?.values.DEFAULT?.median, 2)).join(" | ")} |`,
  );
  const sizeRows = SIZE.map(
    ([id, label]) =>
      `| ${id} ${label} | ${columns.map((f) => fmt(localResult(names.get(f)!, id)?.values.DEFAULT?.median, 1)).join(" | ")} |`,
  );
  const sample = localResult(names.get(columns[0]!)!, CPU[0][0])?.values.total?.values.length;
  const memorySample = localResult(names.get(columns[0]!)!, MEMORY[1][0])?.values.DEFAULT?.values
    .length;

  lines.push(
    "# js-framework-benchmark results",
    "",
    "Generated by `pnpm bench:jsfb` (benchmarks/js-framework-benchmark/scripts/jsfb.ts): krausest's own",
    "webdriver-ts runner (Puppeteer, Chrome trace timing, upstream CPU throttling and memory",
    `measurement), krausest commit \`${COMMIT.slice(0, 7)}\`, ${options.headed ? "headed" : "headless"} Chrome.`,
    "",
    `- Date: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
    `- Machine: ${cpus()[0]?.model ?? "unknown CPU"} (${cpus().length} cores), ${platform()} ${release()}`,
    `- Browser: ${chromeVersion()}`,
    `- Iterations: ${sample ?? "?"} per CPU benchmark, ${memorySample ?? "?"} per memory benchmark (medians shown)`,
    "- lumiose: src/App.stsx compiled by @lumiose/vite; lumiose-hand: the same app hand-compiled from the",
    "  compiler-runtime contract (src/hand-compiled.js), the target for the compiler's output",
    ...(columns.includes("remix-v3")
      ? [
          "- remix-v3: frameworks/keyed/remix-v3, remix@3.0.0 (remix/component 1.0) bundled and minified",
          "  by esbuild like the Remix team's own benchmark app; krausest has no Remix 3 entry, so it has",
          "  no published factor",
        ]
      : []),
    "",
    "## CPU (median total ms, factor vs the fastest framework here)",
    "",
    header("benchmark"),
    ...cpuRows,
    `| **weighted geometric mean** (local factors) | ${geo(factors)} |`,
    `| **projected published factor** | ${geo(projected)} |`,
    `| published factor (krausest's table) | ${geo(published)} |`,
    "",
    "The projected factor calibrates each local time against vanillajs's factor in krausest's",
    "published table (webdriver-ts/results.json, same Chrome major and framework versions):",
    "`(local / local vanillajs) × (published vanillajs / published fastest)`, then krausest's",
    "weighted geometric mean. It is the number to compare with the spec targets (doc-1 §11:",
    "CPU ≤ 1.12; published vanillajs 1.05, Solid 1.13).",
    "",
    "### Script time (median ms)",
    "",
    header("benchmark"),
    ...scriptRows,
    "",
    "## Memory (MB, median)",
    "",
    header("benchmark"),
    ...memoryRows,
    "",
    "Spec target: run memory ≤ 2.7 MB (stretch 2.5).",
    "",
    "## Size and startup",
    "",
    header("benchmark"),
    ...sizeRows,
    "",
  );
  for (const [name, { outDir }] of Object.entries(LUMIOSE)) {
    const bundle = bundleSizes(join(PKG, outDir, "main.js"));
    if (bundle !== undefined) {
      lines.push(
        `- ${name} bundle (${outDir}/main.js, runtime and app): min ${kB(bundle.min)} kB, gzip ${kB(bundle.gzip)} kB, brotli ${kB(bundle.brotli)} kB (budget ≤ 8 kB)`,
      );
    }
  }
  for (const name of LOCAL.filter((f) => columns.includes(f))) {
    const bundle = bundleSizes(join(KRAUSEST, "frameworks/keyed", name, "dist/main.js"));
    if (bundle !== undefined) {
      lines.push(
        `- ${name} bundle (frameworks/keyed/${name}, build-prod output): min ${kB(bundle.min)} kB, gzip ${kB(bundle.gzip)} kB, brotli ${kB(bundle.brotli)} kB`,
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}

// ---- main -----------------------------------------------------------------------------------------

if (!options.summary) {
  checkout();
  install();
  for (const name of frameworks.filter((f) => f in LUMIOSE)) {
    await buildLumiose(name);
  }
  if (options.build) {
    process.exit(0);
  }
}
const stop = await startServer();
let code = 0;
try {
  const names = await resultNames();
  if (!options.summary) {
    code = await runBenchmarks(names);
  }
  writeFileSync(join(PKG, "RESULTS.md"), summarize(names));
  console.log(`Wrote ${join(PKG, "RESULTS.md")}`);
} finally {
  stop();
}
if (code !== 0) {
  console.error("Some benchmarks failed; see the runner output above.");
  process.exitCode = code;
}
