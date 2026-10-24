// `pnpm bench:rows:ab`: an in-process A/B of keyed rows whose entries are re-derived on every
// change (TASK-555): 10 rows of 8 cards (src/rows/main.tsx), as a virtual grid renders its visible
// window. Both builds (and React with --react) load into one Chrome page and are measured
// alternately, the order flipping every round, with a full GC before each sample, so machine load
// hits every build alike. Each sample mounts a build's grid, runs one operation and times it:
//
// - `replace`: new ids, so every row and card is new;
// - `rederive`: the same items in new row entries (new objects, same keys);
// - `refetch`: new item objects with the same ids (a refetch), in new row entries.
//
// It prints, per operation and build, the medians and quartiles of the time until the next frame
// has painted (a requestAnimationFrame, then a task), of the script with forced style and layout,
// and of the script alone, the paired differences against the first build, and the DOM nodes one
// operation adds and removes under the grid. It writes no results file.
//
//   node scripts/rows-ab.ts build <out.js>       bundle the page with this checkout (compiler and runtime)
//   node scripts/rows-ab.ts [<a>] [<b>] [options]
//
// <a> and <b> are each a bundle from `build` (a path ending in `.js`), a git ref whose runtime
// (packages/lumiose/src) is compiled with this checkout's compiler, or `.` (this working tree); the
// defaults are HEAD and `.`. A change to the compiler's output needs `build` bundles: build `a` in
// a checkout of the old commit and `b` here.
//
// Options:
//   --rounds N       alternating rounds (default 30)
//   --warmup N       untimed rounds first (default 3)
//   --cpu N          CPU slowdown (default 4)
//   --ops LIST       replace,rederive,refetch (default all)
//   --react DIR      also measure React: a node_modules directory with react and react-dom
//   CHROME_PATH      the Chrome binary (default: the macOS install, as scripts/jsfb.ts)
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { build } from "vite";
import { PKG, bundle, openPage, printPaired, runtime, stats } from "./chrome-ab.ts";

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    rounds: { type: "string", default: "30" },
    warmup: { type: "string", default: "3" },
    cpu: { type: "string", default: "4" },
    ops: { type: "string", default: "replace,rederive,refetch" },
    react: { type: "string" },
  },
});

const ENTRY = "src/rows/main.tsx";
const CSS = `
body { margin: 0; font: 14px/1.4 system-ui, sans-serif; }
.rows { position: relative; height: 2600px; }
.row { position: absolute; inset-inline: 0; display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 12px; padding: 6px 12px; }
.card { display: flex; flex-direction: column; gap: 4px; padding: 8px; border: 1px solid #ddd; border-radius: 8px; color: inherit; text-decoration: none; }
.tile { margin: 0; aspect-ratio: 1; background: #f4f4f5; border-radius: 6px; }
.tile img { width: 100%; height: 100%; object-fit: contain; }
.types { display: flex; justify-content: space-between; align-items: center; }
.type-icons { display: flex; gap: 2px; }
.type { display: inline-flex; width: 18px; height: 18px; border-radius: 50%; background: #e4e4e7; }
.icon { width: 14px; height: 14px; margin: auto; }
.names { display: flex; flex-direction: column; }
.species { font-weight: 600; }
.form, .blank { font-size: 12px; color: #555; }
`;

/** One sample: mounts build `index`, runs `op`, times it until painted, counts DOM nodes. */
const SAMPLE = `async (index, op) => {
  const api = index < 0 ? globalThis.reactRows : globalThis.lumioseRows[index];
  const root = document.getElementById("root");
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  api.mount(root);
  await frame();
  await frame();
  let added = 0;
  let removed = 0;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      added += record.addedNodes.length;
      removed += record.removedNodes.length;
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  const start = performance.now();
  api[op]();
  const script = performance.now() - start;
  root.offsetHeight;
  const layout = performance.now() - start;
  await frame();
  const total = performance.now() - start;
  observer.disconnect();
  api.unmount();
  await frame();
  return [total, layout, script, added, removed];
}`;

/** How a build is named in the output: a bundle by its file name, a ref as given. */
const show = (ref: string): string => (ref.endsWith(".js") ? basename(ref) : ref);

/** Bundles the page with this checkout's compiler and runtime into `out` (`build`). */
async function buildPage(out: string): Promise<void> {
  const work = mkdtempSync(join(tmpdir(), "lumiose-rows-build-"));
  try {
    await bundle(ENTRY, runtime(".", "build", work), "page", work);
    mkdirSync(dirname(resolve(out)), { recursive: true });
    copyFileSync(join(work, "page.js"), resolve(out));
    console.log(`Wrote ${resolve(out)}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Bundles the React page against the react and react-dom of `modules` into `<page>/react.js`. */
async function buildReact(modules: string, page: string): Promise<void> {
  const dir = resolve(modules);
  await build({
    configFile: false,
    root: PKG,
    logLevel: "warn",
    mode: "production",
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    resolve: {
      alias: [
        { find: /^react$/, replacement: join(dir, "react/index.js") },
        { find: /^react-dom\/client$/, replacement: join(dir, "react-dom/client.js") },
        { find: /^react-dom$/, replacement: join(dir, "react-dom/index.js") },
      ],
    },
    build: {
      outDir: page,
      emptyOutDir: false,
      target: "esnext",
      lib: {
        entry: join(PKG, "src/rows/react.ts"),
        formats: ["iife"],
        name: "ab_react",
        fileName: () => "react.js",
      },
    },
  });
}

async function main(): Promise<void> {
  const [refA = "HEAD", refB = "."] = positionals;
  const rounds = Number(options.rounds);
  const warmup = Number(options.warmup);
  const cpu = Number(options.cpu);
  const ops = options.ops.split(",");
  const work = mkdtempSync(join(tmpdir(), "lumiose-rows-ab-"));
  const page = join(work, "page");
  mkdirSync(page);
  const refs = [refA, refB];
  const names = ["a", "b"];
  try {
    for (let i = 0; i < 2; i++) {
      const ref = refs[i]!;
      if (ref.endsWith(".js")) copyFileSync(resolve(ref), join(page, `${names[i]}.js`));
      else await bundle(ENTRY, runtime(ref, names[i]!, work), names[i]!, page);
    }
    const react = options.react !== undefined;
    if (react) await buildReact(options.react!, page);
    const scripts = [...names, ...(react ? ["react"] : [])];
    writeFileSync(
      join(page, "index.html"),
      `<!doctype html><meta charset="utf-8"><style>${CSS}</style><div id="root"></div>${scripts.map((s) => `<script src="${s}.js"></script>`).join("")}`,
    );
    const { send, evaluate, close } = await openPage(
      join(page, "index.html"),
      join(work, "profile"),
      cpu,
    );
    try {
      const builds = await evaluate<number>("() => globalThis.lumioseRows.length");
      if (builds !== 2) throw new Error(`expected 2 builds in the page, found ${builds}`);
      // Build indices: 0 (a), 1 (b), -1 (React).
      const indices = react ? [0, 1, -1] : [0, 1];
      const label = (index: number) => (index < 0 ? "react" : names[index]!);
      console.log(
        `rows A/B: a = ${show(refA)}, b = ${show(refB)}${react ? ", react" : ""}; ${rounds} rounds, ${cpu}x CPU slowdown`,
      );
      for (const op of ops) {
        // Per build: until painted, script with style and layout (forced), script; nodes.
        const metrics = new Map(indices.map((index) => [index, [[], [], []] as number[][]]));
        const nodes = new Map<number, [number, number]>();
        for (let round = -warmup; round < rounds; round++) {
          const order = round % 2 === 0 ? indices : indices.toReversed();
          for (const index of order) {
            await send("HeapProfiler.collectGarbage");
            const [total, layout, script, added, removed] = await evaluate<number[]>(
              SAMPLE,
              index,
              op,
            );
            if (round < 0) continue;
            [total, layout, script].forEach((ms, m) => metrics.get(index)![m]!.push(ms!));
            nodes.set(index, [added!, removed!]);
          }
        }
        console.log(`\n${op} (ms)`);
        const labels = ["until painted", "script, style and layout (forced)", "script"];
        for (let m = 0; m < labels.length; m++) {
          printPaired(labels[m]!, metrics.get(0)![m]!, metrics.get(1)![m]!);
          if (react) {
            const s = stats(metrics.get(-1)![m]!);
            console.log(
              `    react ${s.median.toFixed(2)} (p25 ${s.p25.toFixed(2)}, p75 ${s.p75.toFixed(2)})`,
            );
          }
        }
        for (const index of indices) {
          const [added, removed] = nodes.get(index)!;
          console.log(`  ${label(index)} DOM nodes: ${added} added, ${removed} removed`);
        }
      }
    } finally {
      close();
    }
  } finally {
    // Chrome may still be writing its profile while it exits.
    rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

if (positionals[0] === "build") {
  if (positionals[1] === undefined) throw new Error("usage: rows-ab.ts build <out.js>");
  await buildPage(positionals[1]);
} else {
  await main();
}
