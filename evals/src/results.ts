// Eval results: one JSON file per invocation in results/, listed newest first by index.json.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Tokens } from "./agents.ts";
import type { Grade } from "./grade.ts";
import type { RunMetrics } from "./metrics.ts";
import type { Category } from "./tasks.ts";
import { EVALS } from "./workspace.ts";

export const RESULTS_DIR = join(EVALS, "results");

export interface RunRecord {
  task: string;
  category: Category;
  /** `cli:model:effort`. */
  agent: string;
  cli: "claude" | "codex";
  model: string;
  effort: string;
  ablation: string;
  /** 0-based repetition. */
  index: number;
  success: boolean;
  grade: Grade;
  wallMs: number;
  tokens: Tokens;
  /** List-price USD the CLI reports (Claude only): a proxy for subscription quota. */
  costUsd: number | null;
  modelUsed: string | null;
  metrics: RunMetrics;
  exit: { code: number | null; timedOut: boolean; error: string | null };
  /** Rate-limit or usage info the CLI reported, raw. */
  usageInfo: unknown;
  /** Transcript, relative to evals/ (git-ignored). */
  log: string;
}

export interface ResultsFile {
  schema: 1;
  meta: {
    date: string;
    host: string;
    machine: { cpu: string; cores: number; memoryGb: number; os: string };
    node: string;
    lumen: string;
    clis: Record<string, string | null>;
    agents: string[];
    tasks: string[];
    ablations: string[];
    runs: number;
    /** False while the matrix is still running (or when it was interrupted). */
    complete: boolean;
  };
  runs: RunRecord[];
}

export const resultsPath = (stamp: string, host: string): string =>
  join(RESULTS_DIR, `${stamp}-${host}.json`);

export function writeResults(file: ResultsFile, path: string): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
  const runs = readdirSync(RESULTS_DIR)
    .filter((name) => name.endsWith(".json") && name !== "index.json")
    .map((name) => {
      const { meta, runs: records } = JSON.parse(readFileSync(join(RESULTS_DIR, name), "utf8")) as ResultsFile;
      return { file: name, date: meta.date, host: meta.host, agents: meta.agents, tasks: meta.tasks.length, ablations: meta.ablations, runs: records.length, complete: meta.complete };
    })
    .toSorted((a, b) => b.date.localeCompare(a.date));
  writeFileSync(join(RESULTS_DIR, "index.json"), `${JSON.stringify({ runs }, null, 2)}\n`);
}
