// `lumiose` command dispatch (TASK-28, decision-10): one registry of commands drives argument
// validation, per-command help and the JSON help. Every command takes the global options
// (`--root`/`--cwd`, `--format`, `--help`) and follows the output contract of ./output.ts.

import { resolve } from "node:path";
import { parseArgs } from "node:util";
import pkg from "../../package.json" with { type: "json" };
import { agentsCommand } from "./agents/index.ts";
import { buildCli, devCli, previewCli } from "./app.ts";
import { checkCommand } from "./check/index.ts";
import { docsCommand, explainCommand } from "./docs/index.ts";
import { fmtCommand } from "./fmt/index.ts";
import { lintCommand } from "./lint/index.ts";
import { EXIT_FAILURE, EXIT_OK, formatEnvelope, type OutputFormat } from "./output.ts";
import { routesCommand, typegenCommand } from "./routes.ts";

export interface CliIO {
  cwd: string;
  write: (text: string) => void;
  writeError: (text: string) => void;
  color: boolean;
}

const OPTIONS = {
  root: { type: "string" },
  cwd: { type: "string" },
  format: { type: "string" },
  project: { type: "string", short: "p" },
  check: { type: "boolean" },
  mcp: { type: "boolean" },
  port: { type: "string" },
  host: { type: "string" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
} as const;

type OptionName = keyof typeof OPTIONS;
type OptionValues = {
  [Name in OptionName]?: (typeof OPTIONS)[Name]["type"] extends "boolean" ? boolean : string;
};

const OPTION_HELP: Record<OptionName, { flag: string; description: string }> = {
  root: { flag: "--root <dir>", description: "Project root (default: the current directory)" },
  cwd: { flag: "--cwd <dir>", description: "Alias of --root" },
  format: {
    flag: "--format <format>",
    description: "human (default) or json: one { command, ok, ... } document on stdout",
  },
  project: {
    flag: "-p, --project <file>",
    description: "tsconfig path, relative to the root (default: tsconfig.json)",
  },
  check: { flag: "--check", description: "List unformatted files and exit 1 instead of writing" },
  mcp: {
    flag: "--mcp",
    description:
      "Also register lumiose mcp for Claude Code (.mcp.json) and Codex (.codex/config.toml)",
  },
  port: { flag: "--port <n>", description: "Port (dev: 5173 or the next free one; preview: 4173)" },
  host: { flag: "--host <addr>", description: "Listen on this address (0.0.0.0: all addresses)" },
  help: { flag: "-h, --help", description: "Show help" },
  version: { flag: "-v, --version", description: "Show the version" },
};

const GLOBAL_OPTIONS: readonly OptionName[] = ["root", "cwd", "format", "help", "version"];

interface Context {
  root: string;
  format: OutputFormat;
  values: OptionValues;
  args: string[];
  io: CliIO;
}

interface Command {
  name: string;
  /** Positional arguments in the usage line, e.g. `<code>`. */
  args?: string;
  summary: string;
  /** Command-specific options (the global ones apply to every command). */
  options: readonly OptionName[];
  positionals: { min: number; max: number };
  exitCodes: string;
  examples: readonly string[];
  run(context: Context): Promise<number> | number;
}

const PROBLEMS = "0 success, 1 errors found, 2 the tool failed";
const SERVER = "0 stopped, 1 could not start, 2 misuse";

const COMMANDS: readonly Command[] = [
  {
    name: "dev",
    summary: "Start the dev server (Vite, SSR with HMR)",
    options: ["port", "host"],
    positionals: { min: 0, max: 0 },
    exitCodes: SERVER,
    examples: [
      "lumiose dev",
      "lumiose dev --port 3000 --host 0.0.0.0",
      "lumiose dev --format json",
    ],
    run: ({ root, format, values, io }) =>
      devCli({
        root,
        format,
        ...serverOptions(values),
        write: io.write,
        writeError: io.writeError,
      }),
  },
  {
    name: "build",
    summary: "Build for production: client and server bundles, then prerender static routes",
    options: [],
    positionals: { min: 0, max: 0 },
    exitCodes: "0 built, 1 the project failed to build, 2 misuse",
    examples: ["lumiose build", "lumiose build --format json"],
    run: ({ root, format, io }) =>
      buildCli({ root, format, write: io.write, writeError: io.writeError }),
  },
  {
    name: "preview",
    summary: "Serve the build output locally with @lumiose/adapter-node",
    options: ["port", "host"],
    positionals: { min: 0, max: 0 },
    exitCodes: SERVER,
    examples: ["lumiose preview", "lumiose preview --port 8080 --format json"],
    run: ({ root, format, values, io }) =>
      previewCli({
        root,
        format,
        ...serverOptions(values),
        write: io.write,
        writeError: io.writeError,
      }),
  },
  {
    name: "check",
    summary: "Type-check the project (typegen, shadow TSX, tsc) and report Lumiose diagnostics",
    options: ["project"],
    positionals: { min: 0, max: 0 },
    exitCodes: PROBLEMS,
    examples: [
      "lumiose check",
      "lumiose check --format json",
      "lumiose check -p tsconfig.app.json",
    ],
    run: ({ root, format, values, io }) =>
      checkCommand({
        root,
        ...(values.project === undefined ? {} : { project: values.project }),
        format,
        color: io.color,
        write: io.write,
        writeError: io.writeError,
      }),
  },
  {
    name: "typegen",
    summary:
      "Write the route types (.lumiose/types) and sync the shadow TSX files (.lumiose/shadow)",
    options: [],
    positionals: { min: 0, max: 0 },
    exitCodes: "0 written, 1 the routes have errors, 2 the tool failed",
    examples: ["lumiose typegen", "lumiose typegen --format json"],
    run: ({ root, format, io }) => typegenCommand({ root, format, color: io.color, ...out(io) }),
  },
  {
    name: "routes",
    summary: "List the routes: pattern, kind, mode, file and layouts",
    options: [],
    positionals: { min: 0, max: 0 },
    exitCodes: "0 listed, 1 the routes have errors, 2 the tool failed",
    examples: ["lumiose routes", "lumiose routes --format json"],
    run: ({ root, format, io }) => routesCommand({ root, format, color: io.color, ...out(io) }),
  },
  {
    name: "lint",
    summary: "Lint with oxlint, .stsx included (and their CSS with stylelint, if installed)",
    options: [],
    positionals: { min: 0, max: 0 },
    exitCodes: PROBLEMS,
    examples: ["lumiose lint", "lumiose lint --format json"],
    run: ({ root, format, io }) => lintCommand({ root, format, color: io.color, ...out(io) }),
  },
  {
    name: "fmt",
    args: "[paths...]",
    summary: "Format .stsx files with oxfmt: TSX and each style block (default path: src)",
    options: ["check"],
    positionals: { min: 0, max: Infinity },
    exitCodes: "0 formatted, 1 unformatted (--check) or unformattable files, 2 the tool failed",
    examples: ["lumiose fmt", "lumiose fmt --check", "lumiose fmt src/components --format json"],
    run: ({ root, format, values, args, io }) =>
      fmtCommand({ root, paths: args, check: values.check ?? false, format, ...out(io) }),
  },
  {
    name: "docs",
    args: "[topic...]",
    summary: "Print a docs topic (concepts/signals, LUM1004, …), search the docs, or list topics",
    options: [],
    positionals: { min: 0, max: Infinity },
    exitCodes: "0 found, 1 nothing matches, 2 the tool failed",
    examples: ["lumiose docs", "lumiose docs signals", 'lumiose docs "await island" --format json'],
    run: ({ format, args, io }) => docsCommand({ query: args.join(" "), format, ...out(io) }),
  },
  {
    name: "explain",
    args: "<code>",
    summary: "Explain a diagnostic code, such as LUM2001",
    options: [],
    positionals: { min: 1, max: 1 },
    exitCodes: "0 explained, 1 unknown code, 2 not a code",
    examples: ["lumiose explain LUM2001", "lumiose explain lum3010 --format json"],
    run: ({ format, args, io }) => explainCommand({ code: args[0]!, format, ...out(io) }),
  },
  {
    name: "mcp",
    summary:
      "Start the MCP server on stdio: docs, check, routes, components, compile, render, dev logs",
    options: [],
    positionals: { min: 0, max: 0 },
    exitCodes: "0 the client disconnected, 2 the server could not start",
    examples: ["lumiose mcp", "claude mcp add lumiose -- npx lumiose mcp"],
    // Loaded on demand: the MCP SDK is only needed here.
    run: async ({ root, io }) =>
      (await import("./mcp/index.ts")).mcpCommand({ root, writeError: io.writeError }),
  },
  {
    name: "agents",
    args: "init",
    summary:
      "Write or update AGENTS.md (Lumiose section), CLAUDE.md, the lumiose skill and .gitattributes",
    options: ["mcp"],
    positionals: { min: 1, max: 1 },
    exitCodes: "0 written, 2 the tool failed",
    examples: [
      "lumiose agents init",
      "lumiose agents init --mcp",
      "lumiose agents init --format json",
    ],
    run({ root, format, values, args, io }) {
      if (args[0] !== "init") {
        throw new UsageError(`Unknown agents subcommand "${args[0]}".`, BY_NAME.get("agents"), {
          help: 'The only subcommand is "lumiose agents init".',
        });
      }
      return agentsCommand({ root, format, mcp: values.mcp === true, ...out(io) });
    },
  },
];

const BY_NAME = new Map(COMMANDS.map((command) => [command.name, command]));

function out(io: CliIO) {
  return { write: io.write, writeError: io.writeError };
}

/** Thrown while validating arguments: a usage error (exit 2). */
class UsageError extends Error {
  readonly command: Command | undefined;
  readonly extra: { help?: string; suggestions?: string[] };

  constructor(
    message: string,
    command: Command | undefined,
    extra: { help?: string; suggestions?: string[] } = {},
  ) {
    super(message);
    this.command = command;
    this.extra = extra;
  }
}

function serverOptions(values: OptionValues): { port?: number; host?: string } {
  const port = values.port === undefined ? undefined : Number(values.port);
  return {
    ...(port === undefined ? {} : { port }),
    ...(values.host === undefined ? {} : { host: values.host }),
  };
}

/** Runs the CLI with `argv` (without node and script) and returns the exit code. */
export async function main(argv: string[], io: CliIO = processIO()): Promise<number> {
  // Known before parsing, so that even argument errors are reported as JSON.
  const wantsJson = argv.some(
    (arg, index) => arg === "--format=json" || (arg === "--format" && argv[index + 1] === "json"),
  );
  let named: string | undefined;
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: OPTIONS,
    }) as { values: OptionValues; positionals: string[] };
    const [name, ...args] = positionals;
    named = name;
    if (values.format !== undefined && values.format !== "human" && values.format !== "json") {
      throw new UsageError(
        `--format must be "human" or "json", not "${values.format}".`,
        name === undefined ? undefined : BY_NAME.get(name),
      );
    }
    const format = values.format ?? "human";

    if (values.version) {
      io.write(
        format === "json"
          ? formatEnvelope("version", true, { version: pkg.version })
          : `lumiose ${pkg.version}\n`,
      );
      return EXIT_OK;
    }
    if (name === undefined || name === "help") {
      const topic = name === "help" ? args[0] : undefined;
      const command = topic === undefined ? undefined : commandNamed(topic);
      io.write(format === "json" ? helpJson(command) : command ? commandHelp(command) : usage());
      return EXIT_OK;
    }
    const command = commandNamed(name);
    if (values.help) {
      io.write(format === "json" ? helpJson(command) : commandHelp(command));
      return EXIT_OK;
    }
    validate(command, values, args);
    if (values.root !== undefined && values.cwd !== undefined && values.root !== values.cwd) {
      throw new UsageError("--root and --cwd are the same option; pass one.", command);
    }
    const root = resolve(io.cwd, values.root ?? values.cwd ?? ".");
    return await command.run({ root, format, values, args, io });
  } catch (error) {
    if (!(error instanceof UsageError) && !isParseArgsError(error)) throw error;
    const usageError =
      error instanceof UsageError
        ? error
        : new UsageError(error.message, named === undefined ? undefined : BY_NAME.get(named));
    return reportUsageError(usageError, named, wantsJson, io);
  }
}

function commandNamed(name: string): Command {
  const command = BY_NAME.get(name);
  if (command) return command;
  const suggestions = suggest(name, [...BY_NAME.keys(), "help"]);
  throw new UsageError(`Unknown command "${name}".`, undefined, {
    help:
      suggestions.length > 0
        ? `Did you mean ${suggestions.map((suggestion) => `"lumiose ${suggestion}"`).join(" or ")}?`
        : 'Run "lumiose --help" for the commands.',
    suggestions,
  });
}

function validate(command: Command, values: OptionValues, args: string[]): void {
  for (const [option, value] of Object.entries(values)) {
    const name = option as OptionName;
    if (value === undefined || GLOBAL_OPTIONS.includes(name) || command.options.includes(name)) {
      continue;
    }
    const users = COMMANDS.filter((other) => other.options.includes(name)).map((c) => c.name);
    throw new UsageError(
      `${OPTION_HELP[name].flag.replace(/ <.*$/, "")} does not apply to ${command.name} (only to ${users.join(", ")}).`,
      command,
    );
  }
  if (args.length > command.positionals.max) {
    throw new UsageError(`Unexpected argument "${args[command.positionals.max]}".`, command);
  }
  if (args.length < command.positionals.min) {
    throw new UsageError(`Missing argument ${command.args}.`, command);
  }
  if (values.port !== undefined) {
    const port = Number(values.port);
    if (!(Number.isInteger(port) && port >= 0 && port <= 65535)) {
      throw new UsageError(`--port must be a port number, not "${values.port}".`, command);
    }
  }
}

function reportUsageError(
  error: UsageError,
  named: string | undefined,
  json: boolean,
  io: CliIO,
): number {
  const command = error.command;
  const help =
    error.extra.help ??
    (command ? `Run "lumiose ${command.name} --help" for its options.` : 'Run "lumiose --help".');
  if (json) {
    io.write(
      formatEnvelope(command?.name ?? named ?? "lumiose", false, {
        failure: { message: error.message, help },
        ...(error.extra.suggestions ? { suggestions: error.extra.suggestions } : {}),
      }),
    );
  } else {
    const usageLine = command ? `Usage: ${usageOf(command)}\n` : "";
    io.writeError(`lumiose: ${error.message}\n${usageLine}${help}\n`);
  }
  return EXIT_FAILURE;
}

function isParseArgsError(error: unknown): error is Error {
  const code = (error as { code?: unknown } | null)?.code;
  return error instanceof Error && typeof code === "string" && code.startsWith("ERR_PARSE_ARGS_");
}

// --- help ------------------------------------------------------------------------------------

function usageOf(command: Command): string {
  return `lumiose ${command.name}${command.args ? ` ${command.args}` : ""} [options]`;
}

function table(rows: readonly (readonly [string, string])[], indent = "  "): string {
  const width = Math.max(...rows.map(([left]) => left.length));
  return rows.map(([left, right]) => `${indent}${left.padEnd(width)}  ${right}\n`).join("");
}

function usage(): string {
  return [
    "Usage: lumiose <command> [options]\n\n",
    "Commands:\n",
    table(
      COMMANDS.map((command) => [
        `${command.name}${command.args ? ` ${command.args}` : ""}`,
        command.summary,
      ]),
    ),
    "\nGlobal options:\n",
    table(GLOBAL_OPTIONS.map((name) => [OPTION_HELP[name].flag, OPTION_HELP[name].description])),
    "\nExit codes: 0 success, 1 problems found, 2 the tool failed or was misused.\n",
    'Run "lumiose <command> --help" for its options and examples.\n',
  ].join("");
}

function commandOptions(command: Command): OptionName[] {
  return [...command.options, ...GLOBAL_OPTIONS.filter((name) => name !== "version")];
}

function commandHelp(command: Command): string {
  return [
    `Usage: ${usageOf(command)}\n\n${command.summary}.\n\n`,
    "Options:\n",
    table(
      commandOptions(command).map((name) => [
        OPTION_HELP[name].flag,
        OPTION_HELP[name].description,
      ]),
    ),
    `\nExit codes: ${command.exitCodes}.\n\nExamples:\n`,
    command.examples.map((example) => `  ${example}\n`).join(""),
  ].join("");
}

function describeCommand(command: Command) {
  return {
    name: command.name,
    usage: usageOf(command),
    summary: command.summary,
    options: commandOptions(command).map((name) => OPTION_HELP[name]),
    exitCodes: command.exitCodes,
    examples: command.examples,
  };
}

/** `lumiose help [command] --format json`: the command registry, for agents. */
function helpJson(command: Command | undefined): string {
  return formatEnvelope(
    "help",
    true,
    command
      ? describeCommand(command)
      : {
          version: pkg.version,
          commands: COMMANDS.map(describeCommand),
          globalOptions: GLOBAL_OPTIONS.map((name) => OPTION_HELP[name]),
          exitCodes: { 0: "success", 1: "problems found", 2: "the tool failed or was misused" },
        },
  );
}

// --- suggestions --------------------------------------------------------------------------------

/** Commands within a small edit distance of `input` (or that it prefixes), closest first. */
export function suggest(input: string, candidates: readonly string[]): string[] {
  const limit = input.length <= 3 ? 1 : 2;
  const scored = candidates
    .map((candidate) => ({
      candidate,
      distance:
        input.length >= 2 && candidate.startsWith(input) ? 0 : editDistance(input, candidate),
    }))
    .filter(({ distance }) => distance <= limit);
  const best = Math.min(...scored.map(({ distance }) => distance));
  return scored.filter(({ distance }) => distance === best).map(({ candidate }) => candidate);
}

/** Optimal string alignment distance: insertions, deletions, substitutions and transpositions. */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_row, i) =>
    Array.from({ length: b.length + 1 }, (_column, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[a.length]![b.length]!;
}

function processIO(): CliIO {
  const env = process.env;
  return {
    cwd: process.cwd(),
    write: (text) => void process.stdout.write(text),
    writeError: (text) => void process.stderr.write(text),
    color:
      env["NO_COLOR"] === undefined &&
      (env["FORCE_COLOR"] !== undefined || process.stdout.isTTY === true),
  };
}
