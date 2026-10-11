// Benchmark evidence for the landing page and /benchmarks, read at build time from the committed
// results (benchmarks/*/RESULTS.md and benchmarks/fullstack/results/*.json), so the pages always show
// the latest measured numbers and the run they come from. Server-only: the pages prerender them.

import jsfbResults from "../../../../benchmarks/js-framework-benchmark/RESULTS.md?raw";
import ssrResults from "../../../../benchmarks/ssr/RESULTS.md?raw";

const fullstackResults = import.meta.glob<FullstackRun>(
  "../../../../benchmarks/fullstack/results/2*.json",
  { eager: true, import: "default" },
);

export interface Bar {
  label: string;
  value: number;
  /** Lumiose's own bar. */
  self: boolean;
}

export interface Evidence {
  /** krausest's js-framework-benchmark: weighted geometric mean of CPU factors (lower is faster). */
  cpu: Bar[];
  /** Compressed size of the benchmark app, runtime included (kB). */
  size: Bar[];
  /** First paint of the benchmark app (ms). */
  firstPaint: Bar[];
  /** SSR throughput of the same 5,000-component page (renders per second, higher is better). */
  ssr: Bar[];
  /** The weighted CPU factor of every js-framework-benchmark column, by column id (`solid`). */
  cpuByColumn: Record<string, number>;
  /** JavaScript a server-rendered page of the fullstack issue tracker loads (kB, brotli). */
  serverJs: Bar[];
  /** The same, by fullstack app id (`next`, `react-router`). */
  serverJsByApp: Record<string, number>;
  /** Where and when the fullstack numbers were measured. */
  fullstackRun: string;
  /** Where and when the client numbers were measured. */
  clientRun: string;
  /** Where and when the server numbers were measured. */
  serverRun: string;
}

/** Display names of the benchmark's framework columns. */
const NAMES: Record<string, string> = {
  lumiose: "Lumiose",
  vanillajs: "Vanilla JS",
  solid: "Solid",
  svelte: "Svelte",
  "vue-vapor": "Vue Vapor",
  "react-hooks": "React",
  "remix-v3": "Remix 3",
  vue: "Vue",
  "preact-hooks": "Preact",
};

/** Display names of the fullstack comparison's apps (benchmarks/fullstack/apps). */
const FULLSTACK_NAMES: Record<string, string> = {
  lumiose: "Lumiose",
  "react-router": "React Router",
  next: "Next.js",
  "solid-start": "SolidStart",
  sveltekit: "SvelteKit",
  nuxt: "Nuxt",
  remix: "Remix 3",
};

/** The fields of a fullstack results file (benchmarks/fullstack/results/*.json) read here. */
export interface FullstackRun {
  meta: {
    date: string;
    quick: boolean;
    machine: { cpu: string; cores: number; os: string };
    node: string;
  };
  results: Record<string, Record<string, { median: number } | undefined>>;
}

/** The metric of a server-rendered page's JavaScript: the home page, brotli-compressed. */
const SERVER_JS = "payload.home.js-brotli";

interface Table {
  header: string[];
  rows: string[][];
}

/** The Markdown tables of a document. */
export function tables(markdown: string): Table[] {
  const found: Table[] = [];
  let lines: string[] = [];
  const flush = () => {
    if (lines.length >= 2) {
      const [header, , ...rows] = lines.map(splitCells);
      found.push({ header: header!, rows });
    }
    lines = [];
  };
  for (const line of markdown.split("\n")) {
    if (line.startsWith("|")) lines.push(line);
    else flush();
  }
  flush();
  return found;
}

function splitCells(line: string): string[] {
  return line
    .slice(1, line.endsWith("|") ? -1 : undefined)
    .split("|")
    .map((cell) => cell.trim());
}

/** The first number of a cell: `33.6 (1.07)` → 33.6, `543.1 ± 49.4` → 543.1. */
function number(cell: string): number {
  const value = Number.parseFloat(cell.replace(/[*,]/g, ""));
  if (Number.isNaN(value)) throw new Error(`Not a number: "${cell}".`);
  return value;
}

function row(table: Table, startsWith: string): string[] {
  const found = table.rows.find((cells) => cells[0]!.replace(/\*/g, "").startsWith(startsWith));
  if (found === undefined) throw new Error(`No "${startsWith}" row in the benchmark results.`);
  return found;
}

/** One bar per known framework column of a results row. */
function bars(table: Table, cells: string[]): Bar[] {
  return table.header.slice(1).flatMap((column, index) => {
    const label = NAMES[column];
    return label === undefined
      ? []
      : [{ label, value: number(cells[index + 1]!), self: column === "lumiose" }];
  });
}

function runLine(markdown: string, field: string): string {
  return new RegExp(`^- ${field}: (.+)$`, "m").exec(markdown)?.[1]?.trim() ?? "";
}

/** The newest full (not `--quick`) fullstack run that measured the page payloads. */
export function readFullstack(
  runs: FullstackRun[],
): Pick<Evidence, "serverJs" | "serverJsByApp" | "fullstackRun"> {
  const run = runs
    .filter((candidate) => !candidate.meta.quick)
    .filter((candidate) => Object.values(candidate.results).some((app) => app[SERVER_JS]))
    .toSorted((a, b) => b.meta.date.localeCompare(a.meta.date))[0];
  if (run === undefined) throw new Error("No full fullstack run measured the page payloads.");
  const serverJsByApp: Record<string, number> = {};
  for (const [app, metrics] of Object.entries(run.results)) {
    const bytes = metrics[SERVER_JS]?.median;
    if (bytes !== undefined) serverJsByApp[app] = bytes / 1000;
  }
  const { machine } = run.meta;
  return {
    serverJs: Object.entries(serverJsByApp).flatMap(([app, value]) => {
      const label = FULLSTACK_NAMES[app];
      return label === undefined ? [] : [{ label, value, self: app === "lumiose" }];
    }),
    serverJsByApp,
    fullstackRun: [
      run.meta.date.slice(0, 10),
      `${machine.cpu} (${machine.cores} cores)`,
      machine.os,
      `Node ${run.meta.node.replace(/^v/, "")}`,
    ].join(" · "),
  };
}

export function readEvidence(jsfb: string, ssr: string, fullstack: FullstackRun[]): Evidence {
  const client = tables(jsfb);
  const cpuTable = client.find((table) =>
    table.rows.some((cells) => cells[0]!.includes("geometric mean")),
  );
  const sizeTable = client.find((table) =>
    table.rows.some((cells) => cells[0]!.startsWith("43_first-paint")),
  );
  if (cpuTable === undefined || sizeTable === undefined) {
    throw new Error("The js-framework-benchmark results have no CPU or size table.");
  }
  const ssrTable = tables(ssr).find((table) => table.header[0] === "Framework");
  if (ssrTable === undefined) throw new Error("The SSR results have no table.");

  const date = runLine(jsfb, "Date");
  const machine = runLine(jsfb, "Machine");
  const browser = runLine(jsfb, "Browser");
  const serverRun = /^\*\*Run:\*\* (.+?)\.$/m.exec(ssr)?.[1] ?? "";

  const cpuRow = row(cpuTable, "weighted geometric mean");
  return {
    ...readFullstack(fullstack),
    cpu: bars(cpuTable, cpuRow),
    cpuByColumn: Object.fromEntries(
      cpuTable.header.slice(1).map((column, index) => [column, number(cpuRow[index + 1]!)]),
    ),
    size: bars(sizeTable, row(sizeTable, "42_size-compressed")),
    firstPaint: bars(sizeTable, row(sizeTable, "43_first-paint")),
    ssr: ssrTable.rows
      .filter((cells) => !cells[0]!.includes("("))
      .map((cells) => ({
        label: cells[0]!,
        value: number(cells[2]!),
        self: cells[0] === "Lumiose",
      })),
    clientRun: [date, machine, browser].filter(Boolean).join(" · "),
    serverRun,
  };
}

let cached: Evidence | undefined;

export function evidence(): Evidence {
  return (cached ??= readEvidence(jsfbResults, ssrResults, Object.values(fullstackResults)));
}
