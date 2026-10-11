// The landing's stack comparison table (decision-37): Lumiose against the stacks React and Next.js
// developers already know. The facts (full-stack layer, styles, components in islands) are written
// here; the measured cells come from the committed results through evidence.ts. A stack with no
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
  sameComponents: Cell;
  /** Lumiose's own row. */
  self?: boolean;
}

export const COLUMNS = {
  stack: "Stack",
  fullStack: "Full-stack layer",
  styles: "Styles",
  serverJs: "JS on a server page",
  clientSpeed: "Client speed",
  sameComponents: "Interactive parts use the same components",
} as const;

const fact = (text: string, tone?: "yes" | "no"): Cell => ({ kind: "fact", text, tone });
const yes = fact("Yes", "yes");

interface StackSource {
  stack: string;
  fullStack: string;
  styles: string;
  /** The fullstack comparison's app (benchmarks/fullstack/apps/<id>), or a fact without one. */
  serverJs: { app: string } | { fact: string };
  /** The js-framework-benchmark column (frameworks/keyed/<id>), or a fact without one. */
  clientSpeed: { column: string } | { fact: string };
  sameComponents: Cell;
  self?: boolean;
}

const STACKS: StackSource[] = [
  {
    stack: "React + Next.js",
    fullStack: "Separate project",
    styles: "Pick a library",
    serverJs: { app: "next" },
    clientSpeed: { column: "react-hooks" },
    sameComponents: yes,
  },
  {
    stack: "React Router",
    fullStack: "Separate project",
    styles: "Pick a library",
    serverJs: { app: "react-router" },
    clientSpeed: { column: "react-hooks" },
    sameComponents: yes,
  },
  {
    stack: "Solid + SolidStart",
    fullStack: "Separate project",
    styles: "Pick a library",
    serverJs: { app: "solid-start" },
    clientSpeed: { column: "solid" },
    sameComponents: yes,
  },
  {
    stack: "Svelte + SvelteKit",
    fullStack: "Separate project",
    styles: "Built in",
    serverJs: { app: "sveltekit" },
    clientSpeed: { column: "svelte" },
    sameComponents: yes,
  },
  {
    stack: "Vue + Nuxt",
    fullStack: "Separate project",
    styles: "Built in",
    serverJs: { app: "nuxt" },
    clientSpeed: { column: "vue" },
    sameComponents: yes,
  },
  {
    stack: "Preact",
    fullStack: "None official",
    styles: "Pick a library",
    serverJs: { fact: "No full-stack layer" },
    clientSpeed: { column: "preact-hooks" },
    sameComponents: yes,
  },
  {
    stack: "Remix 3",
    fullStack: "Built in",
    styles: "Built in",
    serverJs: { app: "remix" },
    clientSpeed: { column: "remix-v3" },
    sameComponents: yes,
  },
  {
    stack: "Astro",
    fullStack: "Built in",
    styles: "Built in",
    // By design: Astro ships no JavaScript for a page without islands.
    serverJs: { fact: "0 kB" },
    clientSpeed: { fact: "Depends on the UI framework" },
    sameComponents: fact("Islands need a second UI framework", "no"),
  },
  {
    stack: "Lumiose",
    fullStack: "Built in",
    styles: "Built in",
    serverJs: { app: "lumiose" },
    clientSpeed: { column: "lumiose" },
    sameComponents: yes,
    self: true,
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

export function readStacks(results: Pick<Evidence, "cpuByColumn" | "serverJsByApp">): StackRow[] {
  return STACKS.map((source) => {
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
      sameComponents: source.sameComponents,
      self: source.self,
    };
  });
}

export function stacks(): StackRow[] {
  return readStacks(evidence());
}
