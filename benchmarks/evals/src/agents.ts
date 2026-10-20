// The coding agents under evaluation, driven through their local CLIs so runs use the user's
// subscription (no API keys): Claude Code (`claude -p`) and Codex (`codex exec`). Each adapter
// builds the command for one isolated run and normalises the CLI's JSON event stream into steps.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

export type Effort = "low" | "medium" | "high";
export const EFFORTS: Effort[] = ["low", "medium", "high"];

export interface AgentConfig {
  /** `claude` or `codex`. */
  cli: "claude" | "codex";
  /** The CLI's model id, e.g. `claude-sonnet-5-5` or `gpt-6-astra`. */
  model: string;
  /** Reasoning effort; never above `high` (decided with the user). */
  effort: Effort;
}

/** `claude:claude-sonnet-5-5:medium` → config (effort defaults to medium). */
export function parseAgent(spec: string): AgentConfig {
  const [cli, model, effort = "medium"] = spec.split(":");
  if (cli !== "claude" && cli !== "codex") throw new Error(`unknown agent CLI in "${spec}"`);
  if (!model) throw new Error(`missing model in "${spec}"`);
  if (!EFFORTS.includes(effort as Effort)) {
    throw new Error(`effort must be one of ${EFFORTS.join(", ")} (got "${effort}" in "${spec}")`);
  }
  return { cli, model, effort: effort as Effort };
}

export const agentId = (agent: AgentConfig): string =>
  `${agent.cli}:${agent.model}:${agent.effort}`;

/** One normalised tool call of the agent. */
export interface Step {
  kind: "command" | "read" | "edit" | "search" | "mcp" | "other";
  /** Tool name (`Bash`, `Read`, `mcp__lumiose__check`, `command_execution`, …). */
  tool: string;
  /** The command, path or query. */
  input: string;
  output: string;
  failed: boolean;
}

export interface Tokens {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
  reasoning: number;
}

export interface Transcript {
  steps: Step[];
  /** Agent turns as the CLI counts them (Claude: num_turns; Codex: model responses). */
  turns: number;
  tokens: Tokens;
  /** List-price cost the CLI reports (Claude only), a proxy for subscription quota. */
  costUsd: number | null;
  /** The model the CLI says it used. */
  modelUsed: string | null;
  finalMessage: string;
  /** Error reported by the CLI itself (auth, model, budget). */
  error: string | null;
  /** Rate-limit or usage info the CLI reported, raw. */
  usageInfo: unknown;
}

export interface RunOptions {
  dir: string;
  prompt: string;
  /** Command line of the `lumiose mcp` server, when the run registers it. */
  mcp: { command: string; args: string[] } | null;
  maxTurns: number;
  timeoutMs: number;
  /** Raw event log of the CLI (JSONL). */
  logFile: string;
}

export interface AgentRun {
  transcript: Transcript;
  exitCode: number | null;
  timedOut: boolean;
  wallMs: number;
  stderr: string;
}

/** Runs the agent once and parses its event stream. */
export async function runAgent(agent: AgentConfig, options: RunOptions): Promise<AgentRun> {
  const { command, args, env, stdin, cleanup } =
    agent.cli === "claude" ? claudeCommand(agent, options) : codexCommand(agent, options);
  const started = performance.now();
  const child = spawn(command, args, {
    cwd: options.dir,
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
    detached: true,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => (stdout += chunk));
  child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));
  child.stdin.end(stdin);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      process.kill(-child.pid!, "SIGTERM");
    } catch {}
    setTimeout(() => {
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {}
    }, 5000);
  }, options.timeoutMs);
  const exitCode = await new Promise<number | null>((resolve) => child.on("close", resolve));
  clearTimeout(timer);
  const wallMs = performance.now() - started;
  cleanup();
  writeFileSync(options.logFile, stdout);
  const transcript = agent.cli === "claude" ? parseClaude(stdout) : parseCodex(stdout);
  return { transcript, exitCode, timedOut, wallMs, stderr: stderr.slice(-4000) };
}

// ---------------------------------------------------------------- Claude Code

/**
 * `claude -p` with only project settings (no user CLAUDE.md, plugins or MCP servers), edits
 * accepted inside the project, Bash in Claude Code's sandbox (writes confined to the project,
 * no network) and no web tools. Anything that would ask for permission is denied.
 */
function claudeCommand(agent: AgentConfig, options: RunOptions) {
  const settings = {
    sandbox: {
      enabled: true,
      autoAllowBashIfSandboxed: true,
      allowUnsandboxedCommands: false,
      network: { allowLocalBinding: true },
    },
    permissions: { deny: ["WebFetch", "WebSearch"] },
  };
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    agent.model,
    "--effort",
    agent.effort,
    "--no-session-persistence",
    "--setting-sources",
    "project,local",
    "--strict-mcp-config",
    "--permission-mode",
    "acceptEdits",
    "--permission-prompts",
    "none",
    "--settings",
    JSON.stringify(settings),
    "--max-turns",
    String(options.maxTurns),
    "--allowedTools",
    [
      "Bash",
      "Read",
      "Edit",
      "Write",
      "Glob",
      "Grep",
      ...(options.mcp ? ["mcp__lumiose"] : []),
    ].join(","),
  ];
  if (options.mcp) {
    args.push("--mcp-config", JSON.stringify({ mcpServers: { lumiose: options.mcp } }));
  }
  return { command: "claude", args, env: {}, stdin: options.prompt, cleanup: () => {} };
}

type Json = Record<string, any>;

function lines(text: string): Json[] {
  const events: Json[] = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("{")) continue;
    try {
      events.push(JSON.parse(line) as Json);
    } catch {}
  }
  return events;
}

const textOf = (content: unknown): string =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((part: Json) => (typeof part?.text === "string" ? part.text : "")).join("\n")
      : "";

function claudeStep(name: string, input: Json): Omit<Step, "output" | "failed"> {
  if (name === "Bash") return { kind: "command", tool: name, input: String(input.command ?? "") };
  if (name === "Read") return { kind: "read", tool: name, input: String(input.file_path ?? "") };
  if (name === "Edit" || name === "Write" || name === "MultiEdit" || name === "NotebookEdit") {
    return {
      kind: "edit",
      tool: name,
      input: String(input.file_path ?? input.notebook_path ?? ""),
    };
  }
  if (name === "Grep" || name === "Glob") {
    return {
      kind: "search",
      tool: name,
      input: `${input.pattern ?? ""} ${input.path ?? ""}`.trim(),
    };
  }
  if (name.startsWith("mcp__")) return { kind: "mcp", tool: name, input: JSON.stringify(input) };
  return { kind: "other", tool: name, input: JSON.stringify(input).slice(0, 500) };
}

export function parseClaude(stdout: string): Transcript {
  const steps: Step[] = [];
  const pending = new Map<string, Omit<Step, "output" | "failed">>();
  let result: Json | undefined;
  let modelUsed: string | null = null;
  let finalMessage = "";
  for (const event of lines(stdout)) {
    if (event.type === "system" && event.subtype === "init") modelUsed = event.model ?? modelUsed;
    if (event.type === "assistant") {
      for (const part of event.message?.content ?? []) {
        if (part.type === "tool_use") pending.set(part.id, claudeStep(part.name, part.input ?? {}));
        if (part.type === "text") finalMessage = part.text;
      }
    }
    if (event.type === "user") {
      for (const part of event.message?.content ?? []) {
        if (part.type !== "tool_result") continue;
        const call = pending.get(part.tool_use_id);
        if (!call) continue;
        pending.delete(part.tool_use_id);
        steps.push({
          ...call,
          output: textOf(part.content).slice(0, 20_000),
          failed: part.is_error === true,
        });
      }
    }
    if (event.type === "result") result = event;
  }
  for (const call of pending.values()) steps.push({ ...call, output: "", failed: true });
  const usage = result?.usage ?? {};
  const models = Object.keys(result?.modelUsage ?? {});
  return {
    steps,
    turns: Number(result?.num_turns ?? 0),
    tokens: {
      input: Number(usage.input_tokens ?? 0),
      cacheRead: Number(usage.cache_read_input_tokens ?? 0),
      cacheWrite: Number(usage.cache_creation_input_tokens ?? 0),
      output: Number(usage.output_tokens ?? 0),
      reasoning: Number(usage.output_tokens_details?.thinking_tokens ?? 0),
    },
    costUsd: typeof result?.total_cost_usd === "number" ? result.total_cost_usd : null,
    modelUsed: models[0] ?? modelUsed,
    finalMessage: typeof result?.result === "string" ? result.result : finalMessage,
    error:
      result === undefined
        ? "no result event"
        : result.is_error
          ? String(result.subtype ?? "error") +
            (result.result ? `: ${String(result.result).slice(0, 300)}` : "")
          : null,
    usageInfo: result?.modelUsage ?? null,
  };
}

// ---------------------------------------------------------------- Codex

/**
 * `codex exec` with a private CODEX_HOME (only the login is shared, by symlink), so neither the
 * user's config, AGENTS.md, skills nor plugins reach the run; workspace-write sandbox (writes
 * confined to the project, no network) and no approvals.
 */
function codexCommand(agent: AgentConfig, options: RunOptions) {
  const home = mkdtempSync(join(tmpdir(), "lumiose-eval-codex-"));
  symlinkSync(
    join(process.env.CODEX_HOME ?? join(homedir(), ".codex"), "auth.json"),
    join(home, "auth.json"),
  );
  const args = [
    "exec",
    "--json",
    "--ephemeral",
    "--skip-git-repo-check",
    "--cd",
    options.dir,
    "--model",
    agent.model,
    "--sandbox",
    "workspace-write",
    "-c",
    `model_reasoning_effort="${agent.effort}"`,
    "-c",
    'approval_policy="never"',
    "-c",
    "sandbox_workspace_write.network_access=false",
  ];
  if (options.mcp) {
    args.push("-c", `mcp_servers.lumiose.command=${JSON.stringify(options.mcp.command)}`);
    args.push("-c", `mcp_servers.lumiose.args=${JSON.stringify(options.mcp.args)}`);
  }
  args.push("-");
  return {
    command: "codex",
    args,
    env: { CODEX_HOME: home },
    stdin: options.prompt,
    cleanup: () => rmSync(home, { recursive: true, force: true }),
  };
}

export function parseCodex(stdout: string): Transcript {
  const steps: Step[] = [];
  const tokens: Tokens = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 };
  let turns = 0;
  let finalMessage = "";
  let error: string | null = null;
  let usageInfo: unknown = null;
  for (const event of lines(stdout)) {
    if (event.type === "turn.completed") {
      const usage = event.usage ?? {};
      // Codex reports cached input as part of input_tokens.
      tokens.input += Number(usage.input_tokens ?? 0) - Number(usage.cached_input_tokens ?? 0);
      tokens.cacheRead += Number(usage.cached_input_tokens ?? 0);
      tokens.cacheWrite += Number(usage.cache_write_input_tokens ?? 0);
      tokens.output += Number(usage.output_tokens ?? 0);
      tokens.reasoning += Number(usage.reasoning_output_tokens ?? 0);
      if (event.rate_limits !== undefined) usageInfo = event.rate_limits;
    }
    if (event.type === "turn.failed" || event.type === "error") {
      error = String(event.error?.message ?? event.message ?? "error");
    }
    if (event.type !== "item.completed") continue;
    const item = event.item ?? {};
    switch (item.type) {
      case "agent_message":
        turns++;
        finalMessage = String(item.text ?? "");
        break;
      case "command_execution":
        turns++;
        steps.push({
          kind: "command",
          tool: "command_execution",
          input: String(item.command ?? ""),
          output: String(item.aggregated_output ?? "").slice(0, 20_000),
          failed: item.exit_code !== 0 || item.status === "failed",
        });
        break;
      case "file_change":
        turns++;
        for (const change of item.changes ?? []) {
          steps.push({
            kind: "edit",
            tool: "file_change",
            input: String(change.path ?? ""),
            output: "",
            failed: item.status === "failed",
          });
        }
        break;
      case "mcp_tool_call":
        turns++;
        steps.push({
          kind: "mcp",
          tool: `mcp__${item.server}__${item.tool}`,
          input: JSON.stringify(item.arguments ?? {}),
          output: JSON.stringify(item.result ?? item.error ?? "").slice(0, 20_000),
          failed: item.status === "failed" || item.error != null,
        });
        break;
      case "web_search":
        steps.push({
          kind: "search",
          tool: "web_search",
          input: String(item.query ?? ""),
          output: "",
          failed: false,
        });
        break;
    }
  }
  return { steps, turns, tokens, costUsd: null, modelUsed: null, finalMessage, error, usageInfo };
}
