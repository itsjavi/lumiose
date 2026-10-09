// `lumen dev`, `lumen build` and `lumen preview` (spec §8): the app layer's programmatic APIs with
// the CLI's output contract. With `--format json`, Vite's logs go to stderr and stdout carries only
// the envelope: one line once a server listens (dev, preview), or the build result.

import { relative, sep } from "node:path";
import type { Logger } from "vite";
import {
  EXIT_FAILURE,
  EXIT_OK,
  EXIT_PROBLEMS,
  failureOf,
  formatEnvelope,
  type OutputFormat,
} from "./output.ts";
import { projectRoot } from "./project.ts";
import { writeLumenTsconfig } from "./check/layout.ts";

export interface AppCommandOptions {
  root: string;
  format: OutputFormat;
  write: (text: string) => void;
  writeError: (text: string) => void;
  /** dev, preview. */
  port?: number;
  host?: string;
  /** Resolves when the server should stop. Default: SIGINT or SIGTERM. */
  stopped?: Promise<void>;
}

/** `lumen build`: exit 0 when built, 1 when the project fails to build, 2 when the root is missing. */
export async function buildCli(options: AppCommandOptions): Promise<number> {
  const json = options.format === "json";
  let root: string;
  try {
    root = projectRoot(options.root);
  } catch (error) {
    return fail("build", EXIT_FAILURE, error, options);
  }
  // Loaded on demand: Vite is only needed by dev, build and preview.
  const { build } = await import("../app/production/build.ts");
  try {
    // Vite reads the tsconfig, which may extend the generated one.
    await writeLumenTsconfig(root);
    const result = await build({
      root,
      // Below `info`, Rolldown's native reporter does not print its progress lines to stdout; the
      // logger still writes Vite's info messages (to stderr).
      ...(json
        ? { customLogger: stderrLogger(options.writeError), logLevel: "warn" as const }
        : {}),
    });
    if (json) {
      const key = (file: string) => relative(root, file).split(sep).join("/");
      options.write(
        formatEnvelope("build", true, {
          outDir: key(result.outDir),
          clientDir: key(result.clientDir),
          // null when every route is prerendered: dist/client is the whole site.
          serverEntry: result.serverEntry === undefined ? null : key(result.serverEntry),
          prerendered: result.prerendered,
        }),
      );
    }
    return EXIT_OK;
  } catch (error) {
    return fail("build", EXIT_PROBLEMS, error, options);
  }
}

/** `lumen dev`: runs the dev server until stopped. */
export async function devCli(options: AppCommandOptions): Promise<number> {
  const json = options.format === "json";
  let server;
  try {
    const root = projectRoot(options.root);
    await writeLumenTsconfig(root);
    const { createDevServer } = await import("../app/dev/server.ts");
    server = await createDevServer({
      root,
      ...(options.port === undefined ? {} : { port: options.port }),
      ...(options.host === undefined ? {} : { host: options.host }),
      ...(json ? { customLogger: stderrLogger(options.writeError) } : {}),
    });
  } catch (error) {
    return fail("dev", EXIT_PROBLEMS, error, options);
  }
  if (json) {
    const urls = server.vite.resolvedUrls ?? { local: [server.url], network: [] };
    options.write(formatEnvelope("dev", true, { url: server.url, urls }, { compact: true }));
  } else {
    server.vite.printUrls();
    if (process.stdin.isTTY) server.vite.bindCLIShortcuts({ print: true });
  }
  await (options.stopped ?? interrupted());
  await server.close();
  return EXIT_OK;
}

/** `lumen preview`: serves the build output with @lumen/adapter-node until stopped. */
export async function previewCli(options: AppCommandOptions): Promise<number> {
  let server;
  try {
    const root = projectRoot(options.root);
    const { startPreview } = await import("../app/production/command.ts");
    server = await startPreview({
      root,
      ...(options.port === undefined ? {} : { port: options.port }),
      ...(options.host === undefined ? {} : { host: options.host }),
    });
  } catch (error) {
    return fail("preview", EXIT_PROBLEMS, error, options);
  }
  options.write(
    options.format === "json"
      ? formatEnvelope("preview", true, { url: server.url }, { compact: true })
      : `  ➜  Preview: ${server.url}\n`,
  );
  await (options.stopped ?? interrupted());
  await server.close();
  return EXIT_OK;
}

function interrupted(): Promise<void> {
  return new Promise((resolve) => {
    process.once("SIGINT", () => resolve());
    process.once("SIGTERM", () => resolve());
  });
}

function fail(
  command: string,
  code: number,
  error: unknown,
  options: Pick<AppCommandOptions, "format" | "write" | "writeError">,
): number {
  const failure = failureOf(error);
  if (options.format === "json") {
    options.write(formatEnvelope(command, false, { failure }, { compact: command !== "build" }));
  }
  // Route, prerender and compiler errors explain themselves; a stack only adds noise (DEBUG shows it).
  const text = process.env["DEBUG"] && error instanceof Error ? error.stack : failure.message;
  options.writeError(`lumen ${command}: ${text}\n${failure.help ? `${failure.help}\n` : ""}`);
  return code;
}

/** A Vite logger that writes everything to stderr, keeping stdout for the JSON envelope. */
function stderrLogger(writeError: (text: string) => void): Logger {
  const warned = new Set<string>();
  const logged = new WeakSet<object>();
  const logger: Logger = {
    hasWarned: false,
    info: (message) => writeError(`${message}\n`),
    warn(message) {
      logger.hasWarned = true;
      writeError(`${message}\n`);
    },
    warnOnce(message) {
      if (warned.has(message)) return;
      warned.add(message);
      logger.warn(message);
    },
    error(message, options) {
      if (options?.error) logged.add(options.error);
      writeError(`${message}\n`);
    },
    clearScreen() {},
    hasErrorLogged: (error) => logged.has(error),
  };
  return logger;
}
