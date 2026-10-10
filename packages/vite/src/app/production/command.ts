// `lumiose build` and `lumiose preview` for the CLI (TASK-28).

import type { OutgoingHttpHeaders } from "node:http";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { loadEnv, preview, resolveConfig } from "vite";
import { findViteConfig, projectOptions } from "../project.ts";
import type { HeadersOption } from "lumiose/internal/app/headers.ts";
import { staticPreviewPlugin } from "./static-preview.ts";
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
    options.writeError(`lumiose build: ${String(text)}\n`);
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

/** The adapter's server API, as `lumiose preview` uses it. */
interface AdapterNode {
  createServer(options: {
    dir: string;
    port?: number;
    host?: string;
    env?: Record<string, string>;
    headers?: OutgoingHttpHeaders;
  }): Promise<{
    url: string;
    close(): Promise<void>;
  }>;
}

export type PreviewServerOptions = Pick<PreviewCommandOptions, "root" | "port" | "host">;

/**
 * Serves the build output with `@lumiose/adapter-node` (installed in the project). Requests see the
 * `.env` files of the production mode under the process environment, as the build's prerendering
 * did, and responses get Vite's `preview.headers` (which default to `server.headers`), as with
 * `vite preview`, and `lumiose({ headers })`. A build without `dist/server` (every route is
 * prerendered) is served as static files by Vite's preview server instead, without the adapter.
 * Used by `lumiose preview` (CLI, with `--format json`) and {@link previewCommand}.
 */
export async function startPreview(
  options: PreviewServerOptions,
): Promise<{ url: string; close(): Promise<void> }> {
  const root = resolve(options.root);
  const configFile = findViteConfig(root);
  // The build's outDir and env, from the project's Vite config.
  const config = await resolveConfig({ root, configFile, logLevel: "silent" }, "build");
  const outDir = resolve(root, config.build.outDir);
  if (!existsSync(join(outDir, "server/entry.js"))) {
    return startStaticPreview(root, configFile, outDir, options);
  }
  const adapter = await importAdapter(root);
  return adapter.createServer({
    dir: outDir,
    port: options.port ?? 4173,
    host: options.host ?? "localhost",
    env: loadEnv(config.mode, config.envDir === false ? root : config.envDir, ""),
    // Vite resolves `preview.headers` to `server.headers` when unset.
    ...(config.preview.headers === undefined ? {} : { headers: config.preview.headers }),
  });
}

/**
 * `dist/client` with Vite's preview server: files, `about.html`/`about/index.html` for page URLs,
 * `404.html` (status 404) for unknown URLs as static hosts do, `preview.headers` and
 * `lumiose({ headers })`.
 */
async function startStaticPreview(
  root: string,
  configFile: string | false,
  outDir: string,
  options: PreviewServerOptions,
): Promise<{ url: string; close(): Promise<void> }> {
  const clientDir = join(outDir, "client");
  if (!existsSync(clientDir)) {
    throw new Error(`No build in ${outDir}. Run \`lumiose build\` first.`);
  }
  let headers: HeadersOption | undefined;
  const server = await preview({
    root,
    configFile,
    logLevel: "warn",
    appType: "mpa",
    build: { outDir: clientDir },
    preview: { port: options.port ?? 4173, strictPort: true, host: options.host ?? "localhost" },
    plugins: [
      {
        name: "lumiose:preview-options",
        configResolved(config) {
          headers = projectOptions(config, "preview").headers;
        },
      },
      staticPreviewPlugin(clientDir, () => headers),
    ],
  });
  const url = server.resolvedUrls?.local[0];
  if (url === undefined) throw new Error("lumiose preview: the server has no local URL.");
  return { url, close: () => server.close() };
}

/**
 * Serves the build output ({@link startPreview}) until the process is interrupted; resolves to the
 * exit code.
 */
export async function previewCommand(options: PreviewCommandOptions): Promise<number> {
  let server;
  try {
    server = await startPreview(options);
  } catch (error) {
    options.writeError(
      `lumiose preview: ${error instanceof Error ? error.message : String(error)}\n`,
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
    entry = createRequire(join(root, "package.json")).resolve("@lumiose/adapter-node");
  } catch {
    throw new Error(
      "lumiose preview serves the build with @lumiose/adapter-node, which is not installed in this project. Add it: pnpm add @lumiose/adapter-node",
    );
  }
  return (await import(pathToFileURL(entry).href)) as AdapterNode;
}
