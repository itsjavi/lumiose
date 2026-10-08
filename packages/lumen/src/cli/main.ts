// `lumen` command dispatch. `check` (TASK-27), `lint` and `fmt` (TASK-31); the full CLI is TASK-28.

import { parseArgs } from "node:util";
import pkg from "../../package.json" with { type: "json" };
import { checkCommand, EXIT_FAILURE, EXIT_OK } from "./check/index.ts";
import { fmtCommand } from "./fmt/index.ts";
import { lintCommand } from "./lint/index.ts";

const USAGE = `Usage: lumen <command> [options]

Commands:
  check             Type-check the project (typegen, shadow TSX, tsc) and report Lumen diagnostics
  lint              Lint the project with oxlint, .stsx included (and their CSS with stylelint,
                    if installed)
  fmt [paths...]    Format .stsx files with oxfmt: TSX and each style block (default path: src)

Options:
  --root <dir>        Project root (default: current directory)
  -p, --project <f>   check: tsconfig path, relative to the root (default: tsconfig.json)
  --format <f>        check, lint: human (default) or json
  --check             fmt: list unformatted files and exit 1 instead of writing

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
        check: { type: "boolean" },
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
  if (command !== "check" && command !== "lint" && command !== "fmt") {
    return usageError(io, `Unknown command "${command}".`);
  }
  if (rest.length > 0 && command !== "fmt") {
    return usageError(io, `Unexpected argument "${rest[0]}".`);
  }
  if (values.format !== undefined && values.format !== "human" && values.format !== "json") {
    return usageError(io, `--format must be "human" or "json", not "${values.format}".`);
  }
  if (values.check && command !== "fmt") return usageError(io, "--check applies to fmt only.");
  if (values.project !== undefined && command !== "check") {
    return usageError(io, "--project applies to check only.");
  }
  if (values.format !== undefined && command === "fmt") {
    return usageError(io, "--format applies to check and lint only.");
  }

  const root = values.root ?? io.cwd;
  if (command === "fmt") {
    return fmtCommand({
      root,
      paths: rest,
      check: values.check ?? false,
      write: io.write,
      writeError: io.writeError,
    });
  }
  if (command === "lint") {
    return lintCommand({
      root,
      format: values.format ?? "human",
      color: io.color,
      write: io.write,
      writeError: io.writeError,
    });
  }
  return checkCommand({
    root,
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
