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
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { bundle, openPage, printPaired, runtime } from "./chrome-ab.ts";

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

async function main(): Promise<void> {
  const refs = [refA, refB];
  const names = ["a", "b"];
  const page = join(work, "page");
  for (let i = 0; i < 2; i++) {
    await bundle("src/grid/main.tsx", runtime(refs[i]!, names[i]!, work), names[i]!, page);
  }
  writeFileSync(
    join(page, "index.html"),
    `<!doctype html><meta charset="utf-8"><style>${CSS}</style><div id="root"></div><script src="a.js"></script><script src="b.js"></script>`,
  );

  const { send, evaluate, close } = await openPage(
    join(page, "index.html"),
    join(work, "profile"),
    cpu,
  );
  try {
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
        printPaired(labels[m]!, metrics[0]![m]!, metrics[1]![m]!);
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
    close();
    rmSync(work, { recursive: true, force: true });
  }
}

await main();
