// The landing's stack comparison table (decision-37): Lumiose against the stacks React and Next.js
// developers already know. The facts (full-stack layer, styles) are written here; the measured cells
// come from the committed results through evidence.ts. A stack with no
// committed result yet shows "measuring", so a new run (TASK-235) only updates the results files.
import { evidence, type Evidence } from "./evidence.ts";

/** A table cell. */
export type Cell =
  /** A number read from committed results. */
  | { kind: "measured"; text: string }
  /** No committed result yet: a port or benchmark entry is in progress. */
  | { kind: "measuring" }
  /** A fact about the stack, not a measurement. `tone` colours yes/no answers. */
  | { kind: "fact"; text: string; tone?: "yes" | "no" };

export interface StackRow {
  stack: string;
  fullStack: Cell;
  styles: Cell;
  serverJs: Cell;
  clientSpeed: Cell;
  /** Server speed, first column: SSR renders per second of the benchmark page. */
  rendering: Cell;
  /** Server speed, second column: requests per second on the fullstack comparison's home page. */
  requests: Cell;
  /** Lumiose's own row. */
  self?: boolean;
}

export const COLUMNS = {
  stack: "Stack",
  fullStack: "Full-stack layer",
  styles: "Styles",
  serverJs: "JS on a server page",
  clientSpeed: "Client speed",
} as const;

/** The header over the last two columns: rendering (renders/s), then requests (req/s). */
export const SERVER_SPEED = "Server speed";

const fact = (text: string, tone?: "yes" | "no"): Cell => ({ kind: "fact", text, tone });

interface StackSource {
  stack: string;
  fullStack: string;
  styles: string;
  /** The fullstack comparison's app (benchmarks/fullstack/apps/<id>), or a fact without one. */
  serverJs: { app: string } | { fact: string };
  /** The js-framework-benchmark column (frameworks/keyed/<id>), or a fact without one. */
  clientSpeed: { column: string } | { fact: string };
  /** The SSR benchmark's row (benchmarks/ssr/RESULTS.md, by its Framework name). */
  rendering: { framework: string };
  /** The fullstack comparison's app whose home page is load-tested, or a fact without one. */
  requests: { app: string } | { fact: string };
  /** npm downloads of the stack's main package (its full-stack framework where the row names one). */
  downloads?: { package: string; lastMonth: number };
  self?: boolean;
}

/** The period of the `downloads` figures, from api.npmjs.org (last-month point). */
export const DOWNLOADS_PERIOD = "2026-09-10 to 2026-10-09";

const STACKS: StackSource[] = [
  {
    stack: "Lumiose",
    fullStack: "Built in",
    styles: "Built in",
    serverJs: { app: "lumiose" },
    clientSpeed: { column: "lumiose" },
    rendering: { framework: "Lumiose" },
    requests: { app: "lumiose" },
    self: true,
  },
  {
    stack: "React + Next.js",
    downloads: { package: "next", lastMonth: 281966992 },
    fullStack: "Separate project",
    styles: "Pick a library",
    serverJs: { app: "next" },
    clientSpeed: { column: "react-hooks" },
    rendering: { framework: "React" },
    requests: { app: "next" },
  },
  {
    stack: "React Router",
    downloads: { package: "react-router", lastMonth: 255689984 },
    fullStack: "Built in",
    styles: "Pick a library",
    serverJs: { app: "react-router" },
    clientSpeed: { column: "react-hooks" },
    rendering: { framework: "React" },
    requests: { app: "react-router" },
  },
  {
    stack: "Solid + SolidStart",
    downloads: { package: "@solidjs/start", lastMonth: 676365 },
    fullStack: "Separate project",
    styles: "Pick a library",
    serverJs: { app: "solid-start" },
    clientSpeed: { column: "solid" },
    rendering: { framework: "Solid" },
    requests: { app: "solid-start" },
  },
  {
    stack: "Svelte + SvelteKit",
    downloads: { package: "@sveltejs/kit", lastMonth: 13199804 },
    fullStack: "Separate project",
    styles: "Built in",
    serverJs: { app: "sveltekit" },
    clientSpeed: { column: "svelte" },
    rendering: { framework: "Svelte" },
    requests: { app: "sveltekit" },
  },
  {
    stack: "Vue + Nuxt",
    downloads: { package: "nuxt", lastMonth: 10008198 },
    fullStack: "Separate project",
    styles: "Built in",
    serverJs: { app: "nuxt" },
    clientSpeed: { column: "vue" },
    rendering: { framework: "Vue" },
    requests: { app: "nuxt" },
  },
  {
    stack: "Preact",
    downloads: { package: "preact", lastMonth: 162826174 },
    fullStack: "None official",
    styles: "Pick a library",
    serverJs: { fact: "No full-stack layer" },
    clientSpeed: { column: "preact-hooks" },
    rendering: { framework: "Preact" },
    requests: { fact: "No full-stack layer" },
  },
  {
    stack: "Remix 3",
    downloads: { package: "remix", lastMonth: 114691 },
    fullStack: "Built in",
    styles: "Built in",
    serverJs: { app: "remix" },
    clientSpeed: { column: "remix-v3" },
    rendering: { framework: "Remix 3" },
    requests: { app: "remix" },
  },
  {
    stack: "Astro",
    downloads: { package: "astro", lastMonth: 28464424 },
    fullStack: "Built in",
    styles: "Built in",
    // By design: Astro ships no JavaScript for a page without islands.
    serverJs: { fact: "0 kB" },
    clientSpeed: { fact: "Depends on the UI framework" },
    rendering: { framework: "Astro" },
    requests: { app: "astro" },
  },
];

/** kB with no decimals past 10 (101 kB), one below it (6.5 kB), and 0 as "0 kB". */
export function kilobytes(value: number): string {
  if (value === 0) return "0 kB";
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} kB`;
}

/** A js-framework-benchmark factor: `1.05×`. */
export function factor(value: number): string {
  return `${value.toFixed(2)}×`;
}

/** Lumiose first, then the other stacks by npm downloads, most used first. */
function ordered(sources: StackSource[]): StackSource[] {
  const downloads = (source: StackSource) => source.downloads?.lastMonth ?? 0;
  return sources.toSorted(
    (a, b) => Number(b.self === true) - Number(a.self === true) || downloads(b) - downloads(a),
  );
}

/** A throughput: `1,248 req/s`. */
export function perSecond(value: number, unit: string): string {
  return `${Math.round(value).toLocaleString("en-US")} ${unit}`;
}

/** A measured cell, or "measuring" while its result is not committed. */
function measured(value: number | undefined, text: (value: number) => string): Cell {
  return value === undefined ? { kind: "measuring" } : { kind: "measured", text: text(value) };
}

export function readStacks(
  results: Pick<Evidence, "cpuByColumn" | "serverJsByApp" | "rendersByFramework" | "requestsByApp">,
): StackRow[] {
  return ordered(STACKS).map((source) => {
    const serverJs =
      "app" in source.serverJs ? results.serverJsByApp[source.serverJs.app] : undefined;
    const cpu =
      "column" in source.clientSpeed ? results.cpuByColumn[source.clientSpeed.column] : undefined;
    return {
      stack: source.stack,
      fullStack: fact(source.fullStack, source.fullStack === "Built in" ? "yes" : undefined),
      styles: fact(source.styles, source.styles === "Built in" ? "yes" : undefined),
      serverJs:
        "fact" in source.serverJs
          ? fact(source.serverJs.fact)
          : serverJs === undefined
            ? { kind: "measuring" }
            : { kind: "measured", text: kilobytes(serverJs) },
      clientSpeed:
        "fact" in source.clientSpeed
          ? fact(source.clientSpeed.fact)
          : cpu === undefined
            ? { kind: "measuring" }
            : { kind: "measured", text: factor(cpu) },
      rendering: measured(results.rendersByFramework[source.rendering.framework], (value) =>
        perSecond(value, "renders/s"),
      ),
      requests:
        "fact" in source.requests
          ? fact(source.requests.fact)
          : measured(results.requestsByApp[source.requests.app], (value) =>
              perSecond(value, "req/s"),
            ),
      self: source.self,
    };
  });
}

export function stacks(): StackRow[] {
  return readStacks(evidence());
}
