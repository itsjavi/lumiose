// `createDevHandler()` (decision-52, TASK-300): `lumiose dev` inside the project's own Node server.
// Vite runs in middleware mode with the project's config and the app plugin, and the returned
// handler is the same kind of Node request listener as `@lumiose/adapter-node`'s `createHandler()`
// (connect/Express middleware too), so one `server.ts` serves the app in dev and from the build:
//
//   const handler = dev ? await createDevHandler({ server }) : await createHandler();
//
// Everything `lumiose dev` does works through it: modules and assets, the app's routes, the error
// overlay, HMR (its WebSocket upgrades on `options.server`; other upgrades are the server's), reloads
// after server-only edits and typegen. Production never loads it: `@lumiose/vite` is a dev
// dependency.

import type { IncomingMessage, Server, ServerResponse } from "node:http";
import type { Http2SecureServer } from "node:http2";
import { createServer, type InlineConfig, type ViteDevServer } from "vite";
import lumiose from "../../index.ts";
import { findViteConfig, realProjectRoot } from "../project.ts";
import { lumioseDev } from "./plugin.ts";
import type { DevServerOptions } from "./server.ts";

export interface DevHandlerOptions extends Pick<
  DevServerOptions,
  "root" | "configFile" | "mode" | "logLevel" | "customLogger" | "routesDir"
> {
  /**
   * The project's HTTP server: Vite's HMR WebSocket upgrades there (it leaves other upgrades, such
   * as the app's own WebSockets, to the server's other listeners). Without it, HMR listens on a
   * port of its own (Vite's `server.hmr.port`, 24678 by default).
   */
  server?: Server | Http2SecureServer;
}

/** A Node request listener, also usable as connect/Express middleware (errors go to `next`). */
export interface DevHandler {
  (req: IncomingMessage, res: ServerResponse, next?: (error?: unknown) => void): void;
  /** The Vite dev server in middleware mode (its module graph, `ssrLoadModule()`, …). */
  readonly vite: ViteDevServer;
  /** Stops Vite: the file watcher, HMR and its WebSocket. The project's server stays open. */
  close(): Promise<void>;
}

/** Starts Vite in middleware mode for the project and returns its handler. */
export async function createDevHandler(options: DevHandlerOptions = {}): Promise<DevHandler> {
  // Real (symlinks and Windows short names resolved), as Vite's module ids are.
  const root = realProjectRoot(options.root);
  const configFile = options.configFile ?? findViteConfig(root);
  const config: InlineConfig = {
    root,
    configFile,
    appType: "custom",
    server: {
      middlewareMode: true,
      ...(options.server === undefined ? {} : { hmr: { server: options.server } }),
    },
    plugins: [
      ...(configFile === false ? [lumiose()] : []),
      lumioseDev(options.routesDir === undefined ? {} : { routesDir: options.routesDir }),
    ],
  };
  if (options.mode !== undefined) config.mode = options.mode;
  if (options.logLevel !== undefined) config.logLevel = options.logLevel;
  if (options.customLogger !== undefined) config.customLogger = options.customLogger;

  const vite = await createServer(config);
  const handler = (req: IncomingMessage, res: ServerResponse, next?: (error?: unknown) => void) => {
    vite.middlewares(req, res, next);
  };
  return Object.assign(handler, { vite, close: () => vite.close() });
}
