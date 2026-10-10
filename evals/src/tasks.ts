// Eval tasks: tasks/<id>/task.json, prompt.md, start/ (files over the template), hidden/ (the
// acceptance tests, copied in only after the agent finished) and solution/ (a reference
// solution, used to validate the hidden tests, never shown to agents).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EVALS } from "./workspace.ts";

export type Category = "scaffold" | "routing" | "styles" | "islands" | "actions" | "reactivity";

export interface Task {
  id: string;
  title: string;
  category: Category;
  /** create-lumiose template to start from, or "none" for an empty package. */
  template: "minimal" | "static" | "ssr" | "spa" | "none";
  /** Files of the template to delete before the run. */
  remove?: string[];
  /** Wall-time budget in minutes (default 15). */
  minutes?: number;
  /** Turn budget for agents that support one (default 60). */
  maxTurns?: number;
  /** Absolute path of the task folder. */
  dir: string;
  prompt: string;
}

/** Which agent-facing aids a run gets (decision: ablations of TASK-40). */
export interface Ablation {
  id: string;
  /** AGENTS.md, CLAUDE.md and the lumiose skill from create-lumiose. */
  agents: boolean;
  /** llms.txt and llms-full.txt in node_modules/lumiose/docs. */
  llms: boolean;
  /** The `lumiose mcp` server registered with the agent. */
  mcp: boolean;
}

/** Baseline = what `create-lumiose` gives a project by default (no MCP); the others drop or add one aid. */
export const ABLATIONS: Record<string, Ablation> = {
  baseline: { id: "baseline", agents: true, llms: true, mcp: false },
  mcp: { id: "mcp", agents: true, llms: true, mcp: true },
  "no-agents": { id: "no-agents", agents: false, llms: true, mcp: false },
  "no-llms": { id: "no-llms", agents: true, llms: false, mcp: false },
  bare: { id: "bare", agents: false, llms: false, mcp: false },
};

export const TASKS_DIR = join(EVALS, "tasks");

export function loadTasks(): Task[] {
  return readdirSync(TASKS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(TASKS_DIR, entry.name, "task.json")))
    .map((entry) => loadTask(entry.name))
    .toSorted((a, b) => a.id.localeCompare(b.id));
}

export function loadTask(id: string): Task {
  const dir = join(TASKS_DIR, id);
  const meta = JSON.parse(readFileSync(join(dir, "task.json"), "utf8")) as Omit<
    Task,
    "id" | "dir" | "prompt"
  >;
  return { ...meta, id, dir, prompt: readFileSync(join(dir, "prompt.md"), "utf8").trim() };
}

export function selectTasks(only: string | undefined): Task[] {
  const all = loadTasks();
  if (only === undefined) return all;
  const ids = only.split(",").map((id) => id.trim());
  for (const id of ids)
    if (!all.some((task) => task.id === id)) throw new Error(`unknown task ${id}`);
  return all.filter((task) => ids.includes(task.id));
}
