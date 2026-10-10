// Benchmark evidence for the landing page, read at build time from the committed results
// (benchmarks/*/RESULTS.md), so the page always shows the latest measured numbers and the run they
// come from. Server-only: the page prerenders them.

import jsfbResults from "../../../../benchmarks/js-framework-benchmark/RESULTS.md?raw";
import ssrResults from "../../../../benchmarks/ssr/RESULTS.md?raw";

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
};

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

export function readEvidence(jsfb: string, ssr: string): Evidence {
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

  return {
    cpu: bars(cpuTable, row(cpuTable, "weighted geometric mean")),
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
  return (cached ??= readEvidence(jsfbResults, ssrResults));
}
