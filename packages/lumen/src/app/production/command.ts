// `lumen build` and `lumen preview` for the CLI (TASK-28).

import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnv, resolveConfig } from "vite";
import { findViteConfig } from "../project.ts";
import { build, BuildError } from "./build.ts";
import { PrerenderError } from "./prerender.ts";

export interface BuildCommandOptions {
  root: string;
  /** Vite mode. Default: `production`. */
  mode?: string;
  writeError: (text: string) => void;
}

/** Builds the project; resolves to the exit code. */
export async function buildCommand(options: BuildCommandOptions): Promise<number> {
  try {
    await build({
      root: options.root,
      ...(options.mode === undefined ? {} : { mode: options.mode }),
    });
    return 0;
  } catch (error) {
    // Route, prerender and compiler (Vite) errors explain themselves; a stack only adds noise.
    const known = error instanceof BuildError || error instanceof PrerenderError;
    const text =
      error instanceof Error ? (known || !process.env.DEBUG ? error.message : error.stack) : error;
    options.writeError(`lumen build: ${String(text)}\n`);
    return 1;
  }
}

export interface PreviewCommandOptions {
  root: string;
  /** Default 4173 (Vite's preview port). */
  port?: number;
  /** Default `localhost`. */
  host?: string;
  write: (text: string) => void;
  writeError: (text: string) => void;
}

/** The adapter's server API, as `lumen preview` uses it. */
interface AdapterNode {
  createServer(options: {
    dir: string;
    port?: number;
    host?: string;
    env?: Record<string, string>;
  }): Promise<{
    url: string;
    close(): Promise<void>;
  }>;
}

/**
 * Serves the build output with `@lumen/adapter-node` (installed in the project) until the process
 * is interrupted; resolves to the exit code. Requests see the `.env` files of the production mode
 * under the process environment, as the build's prerendering did.
 */
export async function previewCommand(options: PreviewCommandOptions): Promise<number> {
  const root = resolve(options.root);
  let server;
  try {
    const adapter = await importAdapter(root);
    // The build's outDir and env, from the project's Vite config.
    const config = await resolveConfig(
      { root, configFile: findViteConfig(root), logLevel: "silent" },
      "build",
    );
    server = await adapter.createServer({
      dir: resolve(root, config.build.outDir),
      port: options.port ?? 4173,
      host: options.host ?? "localhost",
      env: loadEnv(config.mode, config.envDir === false ? root : config.envDir, ""),
    });
  } catch (error) {
    options.writeError(
      `lumen preview: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
  options.write(`  ➜  Preview: ${server.url}\n`);
  await new Promise<void>((done) => {
    process.once("SIGINT", done);
    process.once("SIGTERM", done);
  });
  await server.close();
  return 0;
}

async function importAdapter(root: string): Promise<AdapterNode> {
  let entry: string;
  try {
    entry = createRequire(join(root, "package.json")).resolve("@lumen/adapter-node");
  } catch {
    throw new Error(
      "lumen preview serves the build with @lumen/adapter-node, which is not installed in this project. Add it: pnpm add @lumen/adapter-node",
    );
  }
  return (await import(pathToFileURL(entry).href)) as AdapterNode;
}
