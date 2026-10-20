// What a transcript says about how the agent worked: `lumiose check` runs (and whether the first
// one passed), diagnostics it ran into, docs and MCP usage.
import type { Step, Transcript } from "./agents.ts";

export interface RunMetrics {
  turns: number;
  steps: number;
  commands: number;
  edits: number;
  /** `lumiose check` runs (CLI, package script or the MCP `check` tool). */
  checkRuns: number;
  /** Whether the agent's first check passed; null when it never ran one. */
  firstCheckOk: boolean | null;
  /** LUMxxxx codes that appeared in tool output. */
  lumCodes: string[];
  /** Steps that read Lumiose's docs (node_modules/lumiose/docs, `lumiose docs`, `lumiose explain`). */
  docsReads: number;
  /** Steps that read llms.txt or llms-full.txt. */
  llmsReads: number;
  mcpCalls: number;
  mcpTools: string[];
  /** Agent skills it loaded (Claude Code's Skill tool: the project's `lumiose` skill). */
  skills: string[];
}

const CHECK =
  /\blumiose(?:\.js|\/src\/cli\/bin\.ts)?\s+check\b|\b(?:pnpm|npm|yarn|bun)\s+(?:run\s+)?check\b/;
const DOCS = /lumiose\/docs|\blumiose\s+(?:docs|explain)\b/;
const LLMS = /llms(?:-full)?\.txt/;
const BUILD =
  /\blumiose\s+(?:build|dev)\b|\b(?:pnpm|npm|yarn|bun)\s+(?:run\s+)?(?:build|dev)\b|\bvitest\b/;

function isCheck(step: Step): boolean {
  if (step.kind === "mcp") return step.tool.endsWith("__check");
  return step.kind === "command" && CHECK.test(step.input);
}

function checkPassed(step: Step): boolean {
  if (step.kind === "mcp")
    return /"ok"\s*:\s*true/.test(step.output) || /\\"ok\\":true/.test(step.output);
  // `lumiose check` exits non-zero when it reports errors; JSON output carries `"ok": false`.
  return !step.failed && !/"ok"\s*:\s*false/.test(step.output);
}

export function metricsOf(transcript: Transcript): RunMetrics {
  const { steps } = transcript;
  const checks = steps.filter(isCheck);
  const codes = new Set<string>();
  // Codes the agent's own checks, builds and dev servers reported (not the docs it read).
  for (const step of steps.filter(
    (s) => isCheck(s) || (s.kind === "command" && BUILD.test(s.input)),
  )) {
    for (const match of step.output.matchAll(/\bLUM\d{4}\b/g)) codes.add(match[0]);
  }
  const mcp = steps.filter((step) => step.kind === "mcp");
  return {
    turns: transcript.turns,
    steps: steps.length,
    commands: steps.filter((step) => step.kind === "command").length,
    edits: steps.filter((step) => step.kind === "edit").length,
    checkRuns: checks.length,
    firstCheckOk: checks.length === 0 ? null : checkPassed(checks[0]!),
    lumCodes: [...codes].toSorted(),
    docsReads: steps.filter(
      (step) =>
        (step.kind !== "mcp" && DOCS.test(step.input)) || /__docs_(?:get|search)$/.test(step.tool),
    ).length,
    llmsReads: steps.filter((step) => LLMS.test(step.input)).length,
    mcpCalls: mcp.length,
    mcpTools: [...new Set(mcp.map((step) => step.tool.replace(/^mcp__lumiose__/, "")))].toSorted(),
    skills: [
      ...new Set(
        steps
          .filter((step) => step.tool === "Skill")
          .map((step) =>
            String((JSON.parse(step.input || "{}") as { skill?: string }).skill ?? "?"),
          ),
      ),
    ].toSorted(),
  };
}
