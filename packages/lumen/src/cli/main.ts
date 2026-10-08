// `lumen` command dispatch. `check` (TASK-27), `lint` and `fmt` (TASK-31), `docs` and `explain`
// (TASK-32); the full CLI is TASK-28.

import { parseArgs } from "node:util";
import pkg from "../../package.json" with { type: "json" };
import { checkCommand, EXIT_FAILURE, EXIT_OK } from "./check/index.ts";
import { docsCommand, explainCommand } from "./docs/index.ts";
import { fmtCommand } from "./fmt/index.ts";
import { lintCommand } from "./lint/index.ts";

const USAGE = `Usage: lumen <command> [options]

Commands:
  dev               Start the dev server (Vite, SSR with HMR)
  build             Build for production: client and server bundles, then prerender static routes
  preview           Serve the build output locally with @lumen/adapter-node
  check             Type-check the project (typegen, shadow TSX, tsc) and report Lumen diagnostics
  lint              Lint the project with oxlint, .stsx included (and their CSS with stylelint,
                    if installed)
  fmt [paths...]    Format .stsx files with oxfmt: TSX and each style block (default path: src)
  docs [topic]      Print a docs topic (concepts/signals, LUM1004, …), search the docs for any
                    other text, or list the topics
  explain <code>    Explain a diagnostic code, such as LUM2001

Options:
  --root <dir>        Project root (default: current directory)
  -p, --project <f>   check: tsconfig path, relative to the root (default: tsconfig.json)
  --format <f>        check, lint, docs, explain: human (default) or json
  --check             fmt: list unformatted files and exit 1 instead of writing
  --port <n>          dev, preview: port (default: dev 5173, or the next free one; preview 4173)
  --host <addr>       dev, preview: listen on this address (0.0.0.0: all addresses)

  -h, --help          Show this help
  -v, --version       Show the version
`;

const COMMANDS = new Set(["check", "lint", "fmt", "docs", "explain", "dev", "build", "preview"]);

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
        port: { type: "string" },
        host: { type: "string" },
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
  if (!COMMANDS.has(command)) {
    return usageError(io, `Unknown command "${command}".`);
  }
  if (values.format !== undefined && values.format !== "human" && values.format !== "json") {
    return usageError(io, `--format must be "human" or "json", not "${values.format}".`);
  }
  const format = (values.format ?? "human") as "human" | "json";
  if (command === "docs" || command === "explain") {
    const { format: _format, ...others } = values;
    if (Object.values(others).some((value) => value !== undefined)) {
      return usageError(io, `${command} takes only --format.`);
    }
    if (command === "docs") {
      return docsCommand({
        query: rest.join(" "),
        format,
        write: io.write,
        writeError: io.writeError,
      });
    }
    if (rest.length !== 1)
      return usageError(io, "explain takes one diagnostic code, such as LUM2001.");
    return explainCommand({ code: rest[0]!, format, write: io.write, writeError: io.writeError });
  }
  if (rest.length > 0 && command !== "fmt") {
    return usageError(io, `Unexpected argument "${rest[0]}".`);
  }
  if (values.check && command !== "fmt") return usageError(io, "--check applies to fmt only.");
  if (values.project !== undefined && command !== "check") {
    return usageError(io, "--project applies to check only.");
  }
  if (values.format !== undefined && command === "fmt") {
    return usageError(io, "--format does not apply to fmt.");
  }

  if (
    (values.port !== undefined || values.host !== undefined) &&
    command !== "dev" &&
    command !== "preview"
  ) {
    return usageError(io, "--port and --host apply to dev and preview only.");
  }
  const root = values.root ?? io.cwd;
  if (command === "build") {
    // Loaded on demand: Vite is only needed by dev, build and preview.
    const { buildCommand } = await import("../app/production/command.ts");
    return buildCommand({ root, writeError: io.writeError });
  }
  if (command === "preview") {
    const port = values.port === undefined ? undefined : Number(values.port);
    if (port !== undefined && !(Number.isInteger(port) && port >= 0 && port <= 65535)) {
      return usageError(io, `--port must be a port number, not "${values.port}".`);
    }
    const { previewCommand } = await import("../app/production/command.ts");
    return previewCommand({
      root,
      ...(port === undefined ? {} : { port }),
      ...(values.host === undefined ? {} : { host: values.host }),
      write: io.write,
      writeError: io.writeError,
    });
  }
  if (command === "dev") {
    const port = values.port === undefined ? undefined : Number(values.port);
    if (port !== undefined && !(Number.isInteger(port) && port >= 0 && port <= 65535)) {
      return usageError(io, `--port must be a port number, not "${values.port}".`);
    }
    // Loaded on demand: Vite is only needed by dev.
    const { devCommand } = await import("../app/dev/command.ts");
    return devCommand({
      root,
      ...(port === undefined ? {} : { port }),
      ...(values.host === undefined ? {} : { host: values.host }),
      writeError: io.writeError,
    });
  }
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
      format,
      color: io.color,
      write: io.write,
      writeError: io.writeError,
    });
  }
  return checkCommand({
    root,
    ...(values.project === undefined ? {} : { project: values.project }),
    format,
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
