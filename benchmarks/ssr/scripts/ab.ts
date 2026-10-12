// In-process A/B of Lumiose's SSR across git refs. Separate processes on a busy machine differ by
// several percent between identical builds, so this loads every build into one Node process and
// measures them alternately: slow load changes then hit every build alike.
//
//   node scripts/ab.ts [options] <ref> [<ref>…]      (pnpm --filter @lumiose/bench-ssr ab …)
//
// The first ref is the reference; `.` is the working tree, uncommitted changes included, and a
// single ref is compared with it (`ab.ts HEAD`: is my change faster?). For each ref, a temporary
// git worktree provides that ref's compiler (crates/*_napi, built in debug: codegen does not
// depend on the profile) to compile the ref's benchmark page, and a private copy of its runtime
// (packages/*/src), so no two builds share a module. Every build renders the same data
// (src/data.ts of this checkout). A second copy of the reference is the same-build control: its
// ratio shows the noise.
//
// Measurement, as scripts/run.ts measures (results awaited, then flattened by reading a character,
// unless --no-flatten): after a warmup of each build, every round measures each build once for
// --ms, in an order rotated every round, with a full GC before each run. Where a build sits in the
// process (which one loaded first) can shift it by a few percent, so the rounds run in several
// passes, each a fresh process that loads the builds in a rotated order; the ratios of all passes
// are pooled, and each pass's median is printed too. Worktrees and build output (a few GB of
// cargo target) are removed at the end, unless --keep.
//
// Options:
//   --passes N      passes, each in a fresh process (default: one per build, control included)
//   --rounds N      rounds per pass (default 16)
//   --ms N          length of each run, ms (default 250)
//   --warmup N      warmup per build and pass, ms (default 3000)
//   --no-flatten    do not flatten results (the method before TASK-246)
//   --keep          keep the worktrees and build output, and print where they are

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { cpus, loadavg, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const SCRIPT = fileURLToPath(import.meta.url);
const PKG = fileURLToPath(new URL("..", import.meta.url));
const DATA = new URL("../src/data.ts", import.meta.url).href;

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    passes: { type: "string" },
    rounds: { type: "string", default: "16" },
    ms: { type: "string", default: "250" },
    warmup: { type: "string", default: "3000" },
    "no-flatten": { type: "boolean", default: false },
    keep: { type: "boolean", default: false },
    // Internal: the child processes that compile one page and that measure one pass.
    compile: { type: "boolean", default: false },
    measure: { type: "string" },
    offset: { type: "string", default: "0" },
  },
});

/** A build to measure: `dir` holds its `render.js`. */
interface Variant {
  label: string;
  dir: string;
}

if (options.compile) compilePage(positionals);
else if (options.measure !== undefined) await measurePass(options.measure, Number(options.offset));
else orchestrate(positionals.length === 1 ? [positionals[0]!, "."] : positionals);

// --- Builds --------------------------------------------------------------------------------------

function run(command: string, args: string[], cwd: string, env = process.env): string {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", maxBuffer: 1 << 26 });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function orchestrate(refs: string[]): void {
  if (refs.length < 2) {
    console.error("Usage: node scripts/ab.ts [options] <ref> [<ref>…]  (`.` is the working tree)");
    process.exit(1);
  }
  const repo = run("git", ["rev-parse", "--show-toplevel"], PKG);
  const work = mkdtempSync(join(tmpdir(), "lumiose-ssr-ab-"));
  const worktrees: string[] = [];
  const cleanup = () => {
    if (options.keep) {
      console.log(`Kept the worktrees and build output in ${work}`);
      return;
    }
    for (const worktree of worktrees) {
      spawnSync("git", ["worktree", "remove", "--force", worktree], { cwd: repo });
    }
    spawnSync("git", ["worktree", "prune"], { cwd: repo });
    rmSync(work, { recursive: true, force: true });
  };
  process.once("SIGINT", () => {
    cleanup();
    process.exit(130);
  });
  try {
    const variants: Variant[] = [];
    for (const [index, ref] of refs.entries()) {
      let source = repo;
      let label = "working tree";
      if (ref !== ".") {
        const sha = run("git", ["rev-parse", "--verify", `${ref}^{commit}`], repo);
        const short = sha.slice(0, 8);
        label = sha.startsWith(ref) ? short : `${ref} (${short})`;
        source = join(work, `worktree-${index}`);
        run("git", ["worktree", "add", "--detach", source, sha], repo);
        worktrees.push(source);
      }
      console.log(`Building ${label}…`);
      const compiler = buildCompiler(
        source,
        join(work, "target"),
        join(work, `compiler-${index}.node`),
      );
      variants.push(makeVariant(source, compiler, join(work, `variant-${index}`), label));
      if (index === 0) {
        variants.push(
          makeVariant(source, compiler, join(work, "variant-control"), `${label}, control`),
        );
      }
    }
    writeFileSync(join(work, "variants.json"), JSON.stringify(variants));
    const passes = Number(options.passes ?? variants.length);
    const results: PassResult[] = [];
    for (let pass = 0; pass < passes; pass++) {
      const args = ["--expose-gc", SCRIPT, "--measure", work, "--offset", String(pass)];
      for (const name of ["rounds", "ms", "warmup"] as const) args.push(`--${name}`, options[name]);
      if (options["no-flatten"]) args.push("--no-flatten");
      const output = run(process.execPath, args, PKG, { ...process.env, NODE_ENV: "production" });
      const lines = output.split("\n");
      for (const line of lines.slice(0, -1)) console.log(line);
      results.push(JSON.parse(lines.at(-1)!) as PassResult);
      console.log(`Pass ${pass + 1} of ${passes} done.`);
    }
    report(variants, results);
  } finally {
    cleanup();
  }
}

/** Builds the napi compiler of the checkout at `source` (debug) and copies it to `out`. */
function buildCompiler(source: string, target: string, out: string): string {
  // Before the rename (TASK-182) the crates were lumen_*.
  const crate = ["lumiose_napi", "lumen_napi"].find((name) =>
    existsSync(join(source, "crates", name)),
  );
  if (crate === undefined)
    throw new Error(`${source}: no crates/lumiose_napi or crates/lumen_napi`);
  run("cargo", ["build", "--quiet", "-p", crate], source, {
    ...process.env,
    CARGO_TARGET_DIR: target,
  });
  const file =
    process.platform === "win32"
      ? `${crate}.dll`
      : `lib${crate}.${process.platform === "darwin" ? "dylib" : "so"}`;
  // Copied at once: the next ref's build writes the same file in the shared target directory.
  copyFileSync(join(target, "debug", file), out);
  return out;
}

/** Copies the runtime of `source` into `dir` and compiles the benchmark page against it. */
function makeVariant(source: string, compiler: string, dir: string, label: string): Variant {
  const pkg = existsSync(join(source, "packages/lumiose")) ? "lumiose" : "lumen";
  cpSync(join(source, "packages", pkg, "src"), join(dir, "src"), { recursive: true });
  const ownPage = join(source, "benchmarks/ssr/src", pkg, "Page.stsx");
  const page = existsSync(ownPage) ? ownPage : join(PKG, "src/lumiose/Page.stsx");
  const server = pathToFileURL(join(dir, "src/server/index.ts")).href;
  // In a child process: napi addons of several refs are not loaded into one process.
  run(process.execPath, [SCRIPT, "--compile", compiler, page, join(dir, "Page.js"), server], PKG);
  writeFileSync(
    join(dir, "render.js"),
    `import { createComponent, renderToString } from ${JSON.stringify(server)};
import { Page } from "./Page.js";
export const render = (data) => renderToString(() => createComponent(Page, { data }));
`,
  );
  return { label, dir };
}

/** `--compile <compiler.node> <page> <out> <server URL>`, as scripts/build.ts compiles it. */
function compilePage([compiler, page, out, server]: string[]): void {
  interface CompileResult {
    code: string;
    diagnostics: { severity: string; message: string }[];
  }
  const { compile } = createRequire(import.meta.url)(compiler!) as {
    compile: (source: string, file: string, options: object) => CompileResult;
  };
  const result = compile(readFileSync(page!, "utf8"), page!, {
    target: "server",
    sourceMap: false,
    styleImport: false,
    emitCss: false,
    root: PKG,
  });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length > 0) throw new Error(errors.map((error) => error.message).join("\n"));
  const code = result.code
    .replaceAll(/(["'])(?:lumiose|lumen)\/server\1/g, JSON.stringify(server))
    .replaceAll(/(["'])\.\.\/data\.ts\1/g, JSON.stringify(DATA));
  writeFileSync(out!, code);
}

// --- Measurement ---------------------------------------------------------------------------------

type Render = (data: unknown) => string | Promise<string>;

/** One pass: renders/s per build (in `variants.json` order) and run, and the load around it. */
interface PassResult {
  rates: number[][];
  load: [number, number];
}

function quantile(values: number[], p: number): number {
  return values.toSorted((x, y) => x - y)[Math.round(p * (values.length - 1))]!;
}

function percent(ratio: number): string {
  return `${ratio >= 1 ? "+" : ""}${((ratio - 1) * 100).toFixed(1)}%`;
}

/**
 * `--measure <work> --offset k`: one pass in this process, which loads the builds rotated by `k`,
 * then prints a `PassResult` as its last line.
 */
async function measurePass(work: string, offset: number): Promise<void> {
  const variants = JSON.parse(readFileSync(join(work, "variants.json"), "utf8")) as Variant[];
  const rounds = Number(options.rounds);
  const ms = Number(options.ms);
  const warmup = Number(options.warmup);
  const flatten = !options["no-flatten"];
  const { createPageData } = (await import(DATA)) as { createPageData: () => unknown };
  const data = createPageData();
  const renders: Render[] = [];
  for (let k = 0; k < variants.length; k++) {
    const index = (k + offset) % variants.length;
    const url = pathToFileURL(join(variants[index]!.dir, "render.js")).href;
    renders[index] = ((await import(url)) as { render: Render }).render;
  }

  let sink = 0;
  /** Renders until `time` ms elapsed; renders per second. */
  async function rate(render: Render, time: number): Promise<number> {
    let count = 0;
    const start = performance.now();
    const end = start + time;
    let now = start;
    while (now < end) {
      let html = render(data);
      if (typeof html !== "string") html = await html;
      if (flatten) sink ^= html.charCodeAt(html.length >> 1);
      count++;
      now = performance.now();
    }
    return (count * 1000) / (now - start);
  }

  if (offset === 0) {
    const reference = await renders[0]!(data);
    for (const [index, render] of renders.entries()) {
      const html = await render(data);
      if (html !== reference) {
        console.log(
          `Note: ${variants[index]!.label} renders different HTML (${html.length} vs ${reference.length} characters).`,
        );
      }
    }
  }
  const loadBefore = loadavg()[0]!;
  for (let cycle = 0; cycle < 3; cycle++)
    for (const render of renders) await rate(render, warmup / 3);
  const rates: number[][] = variants.map(() => []);
  for (let round = 0; round < rounds; round++) {
    for (let k = 0; k < renders.length; k++) {
      const index = (k + round) % renders.length;
      (globalThis as { gc?: () => void }).gc?.();
      rates[index]!.push(await rate(renders[index]!, ms));
    }
  }
  const result: PassResult = { rates, load: [loadBefore, loadavg()[0]!] };
  console.log(JSON.stringify(result));
  if (sink === -1) console.log(sink);
}

/** Pools the passes: each build's median renders/s and its per-round ratio to the reference. */
function report(variants: Variant[], passes: PassResult[]): void {
  const rounds = passes.reduce((sum, pass) => sum + pass.rates[0]!.length, 0);
  const loads = passes.flatMap((pass) => pass.load);
  const flatten = !options["no-flatten"];
  /** Ratio of build `index` to the reference, round by round. */
  const ratios = (pass: PassResult, index: number) =>
    pass.rates[index]!.map((value, round) => value / pass.rates[0]![round]!);
  const width = Math.max(...variants.map((variant) => variant.label.length));
  console.log(
    `\nSSR A/B, one process per pass: ${passes.length} passes × ${passes[0]!.rates[0]!.length} rounds ` +
      `× ${options.ms} ms per build, after ${options.warmup} ms of warmup; results ` +
      `${flatten ? "flattened" : "not flattened"}. Load average ${Math.min(...loads).toFixed(1)} to ` +
      `${Math.max(...loads).toFixed(1)} (${cpus().length} CPUs).\n`,
  );
  console.log(
    `${"Build".padEnd(width)}  renders/s  vs ${variants[0]!.label}: median of ${rounds} rounds ` +
      "(quartiles; min to max); median per pass",
  );
  for (const [index, variant] of variants.entries()) {
    const rates = passes.flatMap((pass) => pass.rates[index]!);
    const line = `${variant.label.padEnd(width)}  ${quantile(rates, 0.5).toFixed(1).padStart(9)}`;
    if (index === 0) {
      console.log(line);
      continue;
    }
    const all = passes.flatMap((pass) => ratios(pass, index));
    const perPass = passes.map((pass) => percent(quantile(ratios(pass, index), 0.5)));
    console.log(
      `${line}  ${percent(quantile(all, 0.5)).padStart(6)} (${percent(quantile(all, 0.25))} to ` +
        `${percent(quantile(all, 0.75))}; ${percent(Math.min(...all))} to ` +
        `${percent(Math.max(...all))}); ${perPass.join(", ")}`,
    );
  }
  console.log(
    "\nThe control is the reference built twice: differences within its spread are noise." +
      (Math.max(...loads) > cpus().length
        ? " The load average exceeded the CPU count: rerun when the machine is quieter."
        : ""),
  );
}
