// `createDevServer()`: the programmatic `lumen dev` (spec §8 "Dev and config"). Vite 8 with the
// project's Vite config (which adds `lumen()` from lumen/vite) plus the app plugin; without a
// config file, `lumen()` is added here.

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  createServer,
  type InlineConfig,
  type Logger,
  type LogLevel,
  type ServerOptions,
  type ViteDevServer,
} from "vite";
import lumen from "../../vite/index.ts";
import { lumenDev, type LumenDevOptions } from "./plugin.ts";

export interface DevServerOptions extends Pick<LumenDevOptions, "routesDir"> {
  /** Project root. Default: the current directory. */
  root?: string;
  /** Port; `0` picks a free one. Default: Vite's (`server.port` or 5173, the next free one). */
  port?: number;
  /** Host to listen on; `true` listens on all addresses. Default: Vite's (localhost). */
  host?: string | boolean;
  /** Vite config file, or `false` for none. Default: `vite.config.*` in the root, if any. */
  configFile?: string | false;
  /** Vite mode (`.env.[mode]` files), not the route mode (that is `lumen({ mode })`). Default: `development`. */
  mode?: string;
  logLevel?: LogLevel;
  customLogger?: Logger;
}

export interface DevServer {
  readonly vite: ViteDevServer;
  /** The local URL, e.g. `http://localhost:5173/`. */
  readonly url: string;
  close(): Promise<void>;
}

/** Vite's default config file names, in its lookup order. */
const VITE_CONFIG_FILES = [
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.ts",
  "vite.config.cjs",
  "vite.config.mts",
  "vite.config.cts",
];

/** Starts the dev server and resolves once it listens. */
export async function createDevServer(options: DevServerOptions = {}): Promise<DevServer> {
  const root = resolve(options.root ?? process.cwd());
  const configFile =
    options.configFile ??
    VITE_CONFIG_FILES.map((name) => join(root, name)).find((file) => existsSync(file)) ??
    false;
  const server: ServerOptions = {};
  if (options.port !== undefined) server.port = options.port;
  if (options.host !== undefined) server.host = options.host;
  const config: InlineConfig = {
    root,
    configFile,
    appType: "custom",
    server,
    plugins: [
      ...(configFile === false ? [lumen()] : []),
      lumenDev(options.routesDir === undefined ? {} : { routesDir: options.routesDir }),
    ],
  };
  if (options.mode !== undefined) config.mode = options.mode;
  if (options.logLevel !== undefined) config.logLevel = options.logLevel;
  if (options.customLogger !== undefined) config.customLogger = options.customLogger;

  const vite = await createServer(config);
  try {
    await vite.listen();
  } catch (error) {
    await vite.close();
    throw error;
  }
  const url = vite.resolvedUrls?.local[0] ?? `http://localhost:${vite.config.server.port}/`;
  return { vite, url, close: () => vite.close() };
}
