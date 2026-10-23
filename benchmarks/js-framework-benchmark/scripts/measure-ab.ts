// `pnpm bench:measure:ab [<a>] [<b>]`: an in-process A/B of attachments that measure, then write
// (TASK-527, decision-80). Both runtime builds load into one page and are measured alternately
// (the order flips every round), with a full GC before each sample, at a CPU slowdown. Each sample
// mounts one build's list (src/measure/main.tsx: N keyed rows of 8 cards, each row's `attach`
// reads its getBoundingClientRect and writes a signal the page renders), then replaces every row
// and times it: the replace alone (attachments and their forced layouts included), then a forced
// final layout, then until the next frame has painted. Chrome's own counters
// (Performance.getMetrics LayoutCount and RecalcStyleCount) give the layouts and style
// recalculations of one replace, final layout included. It writes no results file.
//
// <a> and <b> are each a git ref, whose packages/lumiose/src is exported with `git archive`, or
// `.` (this working tree, uncommitted changes included); the defaults are HEAD and `.`. The page
// itself is always this checkout's src/measure/main.tsx, compiled by this checkout's @lumiose/vite.
//
// Options:
//   --rounds N     alternating rounds (default 30)
//   --warmup N     untimed rounds first (default 5)
//   --cpu N        CPU slowdown (default 4)
//   --rows LIST    row counts (default 10,80)
//   CHROME_PATH    the Chrome binary (default: the macOS install, as scripts/jsfb.ts)
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { bundle, openPage, printPaired, runtime, stats } from "./chrome-ab.ts";

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    rounds: { type: "string", default: "30" },
    warmup: { type: "string", default: "5" },
    cpu: { type: "string", default: "4" },
    rows: { type: "string", default: "10,80" },
  },
});
const [refA = "HEAD", refB = "."] = positionals;
const rounds = Number(options.rounds);
const warmup = Number(options.warmup);
const cpu = Number(options.cpu);
const rowCounts = options.rows.split(",").map(Number);

const work = mkdtempSync(join(tmpdir(), "lumiose-measure-ab-"));

const CSS = `
body { margin: 0; font: 14px/1.4 system-ui, sans-serif; }
.rows > .row { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 12px; padding: 6px 12px; }
.rows > .spacer { height: 40px; }
.card { display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px solid #ddd; border-radius: 8px; background: #fff; }
.thumb { display: block; aspect-ratio: 1; border-radius: 4px; background: linear-gradient(135deg, #eee, #ccc); }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.card footer { display: flex; justify-content: space-between; color: #555; }
.rows:has(.card:focus-within) { outline: 2px solid #93c5fd; }
`;

const FRAME = `() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))`;

/** Mounts build `index` with `n` rows and waits until it has painted. */
const MOUNT = `async (index, n) => {
  const frame = ${FRAME};
  globalThis.lumioseMeasure[index].mount(document.getElementById("root"), n);
  await frame();
  await frame();
}`;

/** Replaces every row of build `index`: the replace, then with a forced layout, then painted. */
const REPLACE = `async (index) => {
  const api = globalThis.lumioseMeasure[index];
  const root = document.getElementById("root");
  const frame = ${FRAME};
  const start = performance.now();
  api.replace();
  const script = performance.now() - start;
  root.offsetHeight;
  const layout = performance.now() - start;
  await frame();
  const total = performance.now() - start;
  return [total, layout, script, api.total()];
}`;

const UNMOUNT = `async (index) => {
  const frame = ${FRAME};
  globalThis.lumioseMeasure[index].unmount();
  await frame();
}`;

async function main(): Promise<void> {
  const refs = [refA, refB];
  const names = ["a", "b"];
  const page = join(work, "page");
  for (let i = 0; i < 2; i++) {
    await bundle("src/measure/main.tsx", runtime(refs[i]!, names[i]!, work), names[i]!, page);
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
    const builds = await evaluate<number>("() => globalThis.lumioseMeasure.length");
    if (builds !== 2) throw new Error(`expected 2 builds in the page, found ${builds}`);
    await send("Performance.enable");
    const counters = async (): Promise<Record<string, number>> => {
      const { metrics } = (await send("Performance.getMetrics")) as {
        metrics: { name: string; value: number }[];
      };
      return Object.fromEntries(metrics.map((metric) => [metric.name, metric.value]));
    };

    console.log(`measure A/B: a = ${refA}, b = ${refB}; ${rounds} rounds, ${cpu}x CPU slowdown`);
    for (const n of rowCounts) {
      // Per build: until painted, with the final layout, replace alone; layouts; style recalcs.
      const metrics: number[][][] = [
        [[], [], [], [], []],
        [[], [], [], [], []],
      ];
      const totals = [new Set<number>(), new Set<number>()];
      for (let round = -warmup; round < rounds; round++) {
        const order = round % 2 === 0 ? [0, 1] : [1, 0];
        for (const index of order) {
          await evaluate(MOUNT, index, n);
          await send("HeapProfiler.collectGarbage");
          const before = await counters();
          const [total, layout, script, height] = await evaluate<number[]>(REPLACE, index);
          const after = await counters();
          await evaluate(UNMOUNT, index);
          totals[index]!.add(height!);
          if (round < 0) continue;
          const values = [
            total!,
            layout!,
            script!,
            after.LayoutCount! - before.LayoutCount!,
            after.RecalcStyleCount! - before.RecalcStyleCount!,
          ];
          values.forEach((value, m) => metrics[index]![m]!.push(value));
        }
      }
      console.log(`\nreplace ${n} rows x 8 cards, each row's attach measures, then writes`);
      const labels = [
        "until painted (ms)",
        "replace with the final layout (ms)",
        "replace, attachments and their forced layouts included (ms)",
        "layouts (Chrome LayoutCount)",
        "style recalculations (Chrome RecalcStyleCount)",
      ];
      for (let m = 0; m < labels.length; m++) {
        printPaired(labels[m]!, metrics[0]![m]!, metrics[1]![m]!);
      }
      const layouts = metrics.map((build) => stats(build[3]!).median);
      console.log(`  layouts per replace: a ${layouts[0]}, b ${layouts[1]}`);
      // Both builds render the same rows, so the measured total height must agree.
      console.log(`  total heights seen: a ${[...totals[0]!]}, b ${[...totals[1]!]}`);
    }
  } finally {
    close();
    rmSync(work, { recursive: true, force: true });
  }
}

await main();
