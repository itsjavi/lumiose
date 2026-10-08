// `lumen` command dispatch. Minimal for now (TASK-27 adds `check`); the full CLI is TASK-28.

import { parseArgs } from "node:util";
import pkg from "../../package.json" with { type: "json" };
import { checkCommand, EXIT_FAILURE, EXIT_OK } from "./check/index.ts";

const USAGE = `Usage: lumen <command> [options]

Commands:
  check     Type-check the project (typegen, shadow TSX, tsc) and report Lumen diagnostics

Options for check:
  --root <dir>        Project root (default: current directory)
  -p, --project <f>   tsconfig path, relative to the root (default: tsconfig.json)
  --format <f>        human (default) or json

  -h, --help          Show this help
  -v, --version       Show the version
`;

export interface CliIO {
  cwd: string;
  write: (text: string) => void;
  writeError: (text: string) => void;
  color: boolean;
}

/** Runs the CLI with `argv` (without node and script) and returns the exit code. */
export async function main(argv: string[], io: CliIO = processIO()): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        root: { type: "string" },
        project: { type: "string", short: "p" },
        format: { type: "string" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (error) {
    return usageError(io, (error as Error).message);
  }
  const { values, positionals } = parsed;
  const [command, ...rest] = positionals;

  if (values.version) {
    io.write(`lumen ${pkg.version}\n`);
    return EXIT_OK;
  }
  if (values.help || command === undefined || command === "help") {
    io.write(USAGE);
    return EXIT_OK;
  }
  if (command !== "check") return usageError(io, `Unknown command "${command}".`);
  if (rest.length > 0) return usageError(io, `Unexpected argument "${rest[0]}".`);
  if (values.format !== undefined && values.format !== "human" && values.format !== "json") {
    return usageError(io, `--format must be "human" or "json", not "${values.format}".`);
  }

  return checkCommand({
    root: values.root ?? io.cwd,
    ...(values.project === undefined ? {} : { project: values.project }),
    format: values.format ?? "human",
    color: io.color,
    write: io.write,
    writeError: io.writeError,
  });
}

function usageError(io: CliIO, message: string): number {
  io.writeError(`lumen: ${message}\n\n${USAGE}`);
  return EXIT_FAILURE;
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
