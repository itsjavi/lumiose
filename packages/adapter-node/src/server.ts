// `@lumiose/adapter-node` (spec §8 Build, "Adapters"): serves a `lumiose build` output with Node.
// Requests go to the static files of `dist/client` first (GET/HEAD), then to the app's
// `export default { fetch }` from `dist/server/entry.js`, through lumiose's Node bridge (streamed
// responses, client disconnects abort the request). Configured `headers`, then the build's
// `lumiose({ headers })` for the path, go on every response first, so the static files' and the
// app's own headers win. Responses are compressed by default
// (`compress: false` turns it off): static files from the build's precompressed `.br`/`.gz`
// copies, the app's text responses on the fly (./compress.ts), streaming included.

import {
  createServer as createHttpServer,
  type IncomingMessage,
  type OutgoingHttpHeaders,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ServerEntryModule } from "lumiose/build";
import {
  RejectedRequest,
  headersFor,
  pathBelowBase,
  requestTarget,
  sendWebResponse,
  toWebRequest,
} from "lumiose/node";
import { compressResponse, negotiateEncoding } from "./compress.ts";
import { createStaticHandler } from "./static.ts";

export interface HandlerOptions {
  /** The build output directory, holding `client/` and `server/entry.js`. Default: `dist`. */
  dir?: string | URL;
  /**
   * The public origin (`https://example.com`) when a proxy terminates TLS or rewrites the host:
   * request URLs, and with them the cross-site form check, use it. Default: the `ORIGIN` env
   * variable, else the request's protocol and `Host` header.
   */
  origin?: string;
  /** `ctx.env` and `env()` of requests. Default: `process.env`. */
  env?: Readonly<Record<string, string | undefined>>;
  /**
   * Headers for every response, static files and the app's alike, such as
   * `Cross-Origin-Opener-Policy`/`Cross-Origin-Embedder-Policy` for `crossOriginIsolated`. A
   * response's own header of the same name wins (a page's `response().setHeader()`, a static
   * file's `cache-control`). `lumiose preview` passes Vite's `preview.headers` (else `server.headers`).
   */
  headers?: OutgoingHttpHeaders;
  /**
   * Compress responses for clients that accept brotli or gzip: static files with the `.br`/`.gz`
   * copies `lumiose build` writes, the app's HTML, JSON and other text responses on the fly
   * (brotli quality 4 or gzip 6; streamed HTML is flushed as it renders). Turn it off when a proxy
   * or CDN in front compresses. Default: true.
   */
  compress?: boolean;
  /**
   * Symbolic links in `dist/client`: `"follow"` (like serve-static and nginx) serves their targets
   * and warns at startup about links that leave the directory; `"contain"` ignores those.
   * Default: `"follow"`.
   */
  symlinks?: "follow" | "contain";
}

/** A Node request listener, also usable as connect/express middleware (errors go to `next`). */
export type NodeHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: (error?: unknown) => void,
) => void;

export interface ServerOptions extends HandlerOptions {
  /** Default: the `PORT` env variable, else 3000. `0` picks a free port. */
  port?: number;
  /** Default: the `HOST` env variable, else every address. */
  host?: string;
}

export interface LumioseServer {
  readonly server: Server;
  /** The URL it listens on, e.g. `http://localhost:3000/` (with the app's `base`). */
  readonly url: string;
  close(): Promise<void>;
}

/** Loads the build in `dir` and returns its request listener. */
export async function createHandler(options: HandlerOptions = {}): Promise<NodeHandler> {
  const dir = outputDir(options.dir);
  return nodeHandler(dir, await loadEntry(dir), options);
}

function nodeHandler(dir: string, entry: ServerEntryModule, options: HandlerOptions): NodeHandler {
  const app = options.env === undefined ? entry.default : entry.createHandler({ env: options.env });
  const compress = options.compress !== false;
  const statics = createStaticHandler(join(dir, "client"), entry.config, {
    compress,
    ...(options.symlinks === undefined ? {} : { symlinks: options.symlinks }),
  });
  const origin = options.origin ?? process.env.ORIGIN;
  const headers = Object.entries(options.headers ?? {}).filter(
    (header): header is [string, number | string | string[]] => header[1] !== undefined,
  );

  const configured = entry.config.headers;

  return (req, res, next) => {
    // Only `/path` targets (and `OPTIONS *`): `//host/…` must not become another origin (TASK-164).
    const target = requestTarget(req);
    if (target === undefined) {
      refuse(res, 400);
      return;
    }
    for (const [name, value] of headers) res.setHeader(name, value);
    // `lumiose({ headers })` for this path (decision-26 §4); the files' and the app's headers win.
    // Lumiose's default headers (nosniff, referrer policy) are part of it (decision-29).
    const path = pathBelowBase(target, entry.config.base);
    if (path !== undefined) {
      for (const [name, value] of Object.entries(headersFor(configured, path))) {
        res.setHeader(name, value);
      }
    }
    void (async () => {
      if (await statics(req, res)) return;
      const response = await app.fetch(toWebRequest(req, res, origin));
      await sendWebResponse(
        res,
        compress
          ? compressResponse(
              response,
              negotiateEncoding(req.headers["accept-encoding"]),
              req.method,
            )
          : response,
      );
    })().catch((error: unknown) => {
      if (error instanceof RejectedRequest) {
        // A malformed request (bad Host, forbidden method, body too large): the client's fault,
        // answered with its status and nothing logged.
        refuse(res, error.status);
        return;
      }
      if (next !== undefined) {
        next(error);
        return;
      }
      console.error(error);
      if (res.headersSent) {
        res.destroy();
      } else {
        res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        res.end("Internal Server Error");
      }
    });
  };
}

const STATUS_TEXT: Record<number, string> = {
  400: "Bad Request",
  405: "Method Not Allowed",
  413: "Payload Too Large",
  501: "Not Implemented",
};

function refuse(res: ServerResponse, status: number): void {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8", connection: "close" });
  res.end(STATUS_TEXT[status] ?? "Bad Request");
}

/** Starts an HTTP server for the build in `dir`; resolves once it listens. */
export async function createServer(options: ServerOptions = {}): Promise<LumioseServer> {
  const dir = outputDir(options.dir);
  const entry = await loadEntry(dir);
  const handler = nodeHandler(dir, entry, options);
  const server = createHttpServer((req, res) => handler(req, res));
  const port = options.port ?? (process.env.PORT === undefined ? 3000 : Number(process.env.PORT));
  const host = options.host ?? process.env.HOST;
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolveListen();
    });
  });
  const address = server.address() as AddressInfo;
  const hostname = host === undefined || host === "0.0.0.0" || host === "::" ? "localhost" : host;
  const url = `http://${hostname.includes(":") ? `[${hostname}]` : hostname}:${address.port}${entry.config.base}`;
  return {
    server,
    url,
    close: () =>
      new Promise((resolveClose, reject) => {
        server.close((error) => (error === undefined ? resolveClose() : reject(error)));
        server.closeAllConnections();
      }),
  };
}

async function loadEntry(dir: string): Promise<ServerEntryModule> {
  // A build runs in production, for the app and the libraries it imports: default NODE_ENV before
  // loading anything of it, and keep an explicit value (TASK-149). The entry does the same.
  process.env.NODE_ENV ??= "production";
  const file = join(dir, "server", "entry.js");
  try {
    return (await import(pathToFileURL(file).href)) as ServerEntryModule;
  } catch (error) {
    if ((error as { code?: string }).code === "ERR_MODULE_NOT_FOUND" && !existsSync(file)) {
      throw new Error(`No build in ${dir}: ${file} does not exist. Run \`lumiose build\` first.`, {
        cause: error,
      });
    }
    throw error;
  }
}

function outputDir(dir: string | URL | undefined): string {
  if (dir === undefined) return resolve("dist");
  return dir instanceof URL ? fileURLToPath(dir) : resolve(dir);
}
