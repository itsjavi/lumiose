// The eval runner (TASK-40).
//
//   pnpm --filter @lumiose/evals eval --agents claude:claude-sonnet-5-5:medium,codex:gpt-6-astra:medium
//        [--tasks a,b] [--runs 1] [--ablations baseline,mcp] [--keep]
//   pnpm --filter @lumiose/evals validate [--tasks a,b]     hidden tests fail on start/, pass on solution/
//   pnpm --filter @lumiose/evals eval --list                 tasks, agents and ablations
//
// Every run: a fresh project in the temp directory, the agent CLI with a time and turn budget,
// then grading by the task's hidden tests. Results go to results/<date>T<time>-<host>.json;
// transcripts and projects stay in .runs/ (git-ignored).
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cpus, hostname, release, tmpdir, totalmem, type } from "node:os";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { type AgentConfig, agentId, parseAgent, runAgent } from "./agents.ts";
import { type Grade, grade } from "./grade.ts";
import { type RunMetrics, metricsOf } from "./metrics.ts";
import { resultsPath, writeResults, type ResultsFile, type RunRecord } from "./results.ts";
import { ABLATIONS, type Ablation, selectTasks, type Task } from "./tasks.ts";
import { EVALS, REPO, createProject, lumioseRev, vendor } from "./workspace.ts";

/** What the CLIs print when a subscription's usage limit is reached. */
const QUOTA = /hit your (?:session |usage |weekly )?limit|usage limit|rate limit|quota/i;

const [command = "run", ...rest] = process.argv.slice(2);
const { values } = parseArgs({
  args: rest,
  options: {
    agents: { type: "string" },
    tasks: { type: "string" },
    runs: { type: "string", default: "1" },
    ablations: { type: "string", default: "baseline" },
    keep: { type: "boolean", default: false },
    list: { type: "boolean", default: false },
    resume: { type: "string" },
  },
});

const CACHE = join(tmpdir(), "lumiose-evals");
const log = (message: string) =>
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${message}`);

function list(): void {
  for (const task of selectTasks(undefined))
    console.log(`${task.id.padEnd(32)} ${task.category.padEnd(11)} ${task.title}`);
  console.log(`\nAblations: ${Object.keys(ABLATIONS).join(", ")}`);
  console.log("Agents: claude:<model>:<effort>, codex:<model>:<effort> (effort low|medium|high)");
}

/** A project for `task` in a fresh temp directory. */
async function project(task: Task, ablation: Ablation, name: string): Promise<string> {
  const dir = join(CACHE, "runs", name);
  rmSync(dir, { recursive: true, force: true });
  await createProject(task, ablation, vendor(CACHE, ablation), dir);
  return dir;
}

async function validate(): Promise<void> {
  pinRevision();
  let failures = 0;
  for (const task of selectTasks(values.tasks)) {
    const ablation = ABLATIONS.baseline!;
    const dir = await project(task, ablation, `validate-${task.id}`);
    const before = grade(task, dir);
    rmSync(join(dir, "eval-hidden"), { recursive: true, force: true });
    cpSync(join(task.dir, "solution"), dir, { recursive: true });
    for (const file of solutionRemovals(task))
      rmSync(join(dir, file), { recursive: true, force: true });
    mergeSolutionScripts(task, dir);
    const after = grade(task, dir);
    const ok = !before.success && after.success;
    if (!ok) failures++;
    log(`${ok ? "ok  " : "FAIL"} ${task.id}: start ${summary(before)}; solution ${summary(after)}`);
    if (!after.success) {
      for (const test of after.tests.results.filter((t) => !t.ok))
        console.log(
          `     ✗ ${test.name}\n       ${(test.message ?? "").split("\n").slice(0, 6).join("\n       ")}`,
        );
      if (!after.check.ok)
        console.log(
          `     ✗ lumiose check: ${after.check.errors} errors (${after.check.codes.join(", ")})`,
        );
    }
    if (!values.keep) rmSync(dir, { recursive: true, force: true });
  }
  if (failures > 0) process.exitCode = 1;
}

/** `solution.scripts.json`: package.json scripts the reference solution adds. */
function mergeSolutionScripts(task: Task, dir: string): void {
  const file = join(task.dir, "solution.scripts.json");
  if (!existsSync(file)) return;
  const path = join(dir, "package.json");
  const manifest = JSON.parse(readFileSync(path, "utf8")) as { scripts?: Record<string, string> };
  manifest.scripts = {
    ...manifest.scripts,
    ...(JSON.parse(readFileSync(file, "utf8")) as Record<string, string>),
  };
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

function solutionRemovals(task: Task): string[] {
  const file = join(task.dir, "solution.remove.json");
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as string[]) : [];
}

const summary = (g: Grade) =>
  `${g.tests.passed}/${g.tests.total} tests, check ${g.check.ok ? "ok" : `${g.check.errors} errors`}`;

/** Pins the evaluated Lumiose revision for the whole invocation (other commits may land meanwhile). */
function pinRevision(): void {
  process.env.LUMIOSE_EVAL_REV ??= execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: REPO,
    encoding: "utf8",
  }).trim();
}

async function run(): Promise<void> {
  pinRevision();
  if (values.agents === undefined) throw new Error("pass --agents (see --list)");
  const agents = values.agents.split(",").map((spec) => parseAgent(spec.trim()));
  const tasks = selectTasks(values.tasks);
  const ablations = values.ablations.split(",").map((id) => {
    const ablation = ABLATIONS[id.trim()];
    if (!ablation) throw new Error(`unknown ablation ${id} (${Object.keys(ABLATIONS).join(", ")})`);
    return ablation;
  });
  const runs = Number(values.runs);
  // --resume <results file>: continue an interrupted matrix in that file. Its runs of the requested
  // configurations are kept and skipped; runs of other configurations are dropped.
  const resumed =
    values.resume === undefined
      ? undefined
      : (JSON.parse(readFileSync(join(EVALS, "results", values.resume), "utf8")) as ResultsFile);
  if (resumed !== undefined && resumed.meta.lumiose !== lumioseRev()) {
    throw new Error(
      `--resume: the file was measured at ${resumed.meta.lumiose}; set LUMIOSE_EVAL_REV to it`,
    );
  }
  const startedAt = resumed?.meta.date ?? new Date().toISOString();
  const stamp = `${startedAt.slice(0, 10)}T${startedAt.slice(11, 19).replaceAll(":", "")}`;
  const logs = join(EVALS, ".runs", stamp);
  mkdirSync(logs, { recursive: true });

  const key = (task: string, agent: string, ablation: string, index: number) =>
    `${task}|${agent}|${ablation}|${index}`;
  const records: RunRecord[] = (resumed?.runs ?? []).filter((r) =>
    agents.some((agent) => agentId(agent) === r.agent),
  );
  const done = new Set(records.map((r) => key(r.task, r.agent, r.ablation, r.index)));
  const host = hostname()
    .replace(/\.local$/, "")
    .toLowerCase();
  const meta: ResultsFile["meta"] = {
    date: startedAt,
    host,
    machine: {
      cpu: cpus()[0]?.model ?? "unknown",
      cores: cpus().length,
      memoryGb: Math.round(totalmem() / 2 ** 30),
      os: `${type()} ${release()}`,
    },
    node: process.version,
    lumiose: lumioseRev(),
    clis: { claude: version("claude"), codex: version("codex") },
    agents: agents.map(agentId),
    tasks: tasks.map((task) => task.id),
    ablations: ablations.map((a) => a.id),
    runs,
    complete: false,
    ...(resumed?.meta.notes ? { notes: resumed.meta.notes } : {}),
  };
  const output =
    resumed === undefined ? resultsPath(stamp, host) : join(EVALS, "results", values.resume!);
  const total = agents.length * tasks.length * ablations.length * runs;
  let n = 0;
  // Interleave agents inside each (task, run) so a slow period does not hit one agent only.
  for (const ablation of ablations) {
    for (let index = 0; index < runs; index++) {
      for (const task of tasks) {
        for (const agent of agents) {
          n++;
          if (done.has(key(task.id, agentId(agent), ablation.id, index))) continue;
          const name = `${task.id}--${agentId(agent).replaceAll(":", "_")}--${ablation.id}--${index + 1}`;
          log(`[${n}/${total}] ${task.id} · ${agentId(agent)} · ${ablation.id} · run ${index + 1}`);
          const record = await runOne(task, agent, ablation, index, name, logs);
          // A CLI out of quota fails instantly without working: stop instead of recording it, so
          // --resume can run the pair once the quota is back.
          if (record.tokens.output === 0 && QUOTA.test(record.exit.error ?? "")) {
            log(
              `  stopped: ${record.exit.error} (not recorded; continue later with --resume ${basename(output)})`,
            );
            process.exitCode = 3;
            return;
          }
          records.push(record);
          // Rewritten after every run, so an interrupted matrix keeps what it measured.
          writeResults({ schema: 1, meta, runs: records }, output);
          log(
            `  ${record.success ? "PASS" : "fail"} ${record.grade.tests.passed}/${record.grade.tests.total} tests, check ${record.grade.check.ok ? "ok" : "errors"} · ${(record.wallMs / 1000).toFixed(0)} s · ${record.metrics.turns} turns · ${record.tokens.output} out tokens${record.costUsd === null ? "" : ` · $${record.costUsd.toFixed(2)}`}${record.exit.timedOut ? " · TIMED OUT" : ""}${record.exit.error ? ` · ${record.exit.error}` : ""}`,
          );
        }
      }
    }
  }

  writeResults({ schema: 1, meta: { ...meta, complete: true }, runs: records }, output);
  log(`wrote ${output}`);
}

function version(cli: string): string | null {
  try {
    return execFileSync(cli, ["--version"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

async function runOne(
  task: Task,
  agent: AgentConfig,
  ablation: Ablation,
  index: number,
  name: string,
  logs: string,
): Promise<RunRecord> {
  const dir = await project(task, ablation, name);
  const logFile = join(logs, `${name}.jsonl`);
  const lumiose = join(dir, "node_modules/@lumiose/cli/src/bin.ts");
  const result = await runAgent(agent, {
    dir,
    prompt: task.prompt,
    mcp: ablation.mcp ? { command: process.execPath, args: [lumiose, "mcp", "--root", dir] } : null,
    maxTurns: task.maxTurns ?? 60,
    timeoutMs: (task.minutes ?? 15) * 60_000,
    logFile,
  });
  const graded = grade(task, dir);
  const metrics: RunMetrics = metricsOf(result.transcript);
  if (values.keep)
    cpSync(dir, join(logs, name), { recursive: true, filter: (p) => !p.includes("/node_modules") });
  rmSync(dir, { recursive: true, force: true });
  return {
    task: task.id,
    category: task.category,
    agent: agentId(agent),
    cli: agent.cli,
    model: agent.model,
    effort: agent.effort,
    ablation: ablation.id,
    index,
    success: graded.success,
    grade: graded,
    wallMs: Math.round(result.wallMs),
    tokens: result.transcript.tokens,
    costUsd: result.transcript.costUsd,
    modelUsed: result.transcript.modelUsed,
    metrics,
    exit: {
      code: result.exitCode,
      timedOut: result.timedOut,
      error:
        result.transcript.error ??
        (result.exitCode === 0
          ? null
          : (result.stderr.split("\n").filter(Boolean).at(-1) ?? `exit ${result.exitCode}`)),
    },
    usageInfo: result.transcript.usageInfo,
    log: `.runs/${logs.split("/.runs/")[1]}/${name}.jsonl`,
  };
}

if (command === "validate") await validate();
else if (command === "run" && values.list) list();
else if (command === "run") await run();
else throw new Error(`unknown command ${command} (run, validate)`);
