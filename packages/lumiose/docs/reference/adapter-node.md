# `@lumiose/adapter-node`

> Serves a `lumiose build` output with Node: the static files of `dist/client` first, then the app's request handler from `dist/server/entry.js`, with streamed responses.

`lumiose preview` uses it, so a project that previews or deploys on Node depends on it. Concepts:
[Rendering modes](../concepts/rendering-modes.md) (build output), [Server](../concepts/server.md).

## createServer

```ts
function createServer(options?: ServerOptions): Promise<LumioseServer>;

interface ServerOptions extends HandlerOptions {
  /** Default: the `PORT` env variable, else 3000. `0` picks a free port. */
  port?: number;
  /** Default: the `HOST` env variable, else every address. */
  host?: string;
}

interface LumioseServer {
  readonly server: import("node:http").Server;
  /** The URL it listens on, e.g. `http://localhost:3000/` (with the app's `base`). */
  readonly url: string;
  close(): Promise<void>;
}
```

Loads the build and starts an HTTP server; resolves once it listens. A missing build fails with
"No build in dist … Run `lumiose build` first."

**`NODE_ENV`.** A build runs in production: `createServer` and `createHandler` set
`process.env.NODE_ENV` to `"production"` when it is unset, before they load the build, so the
app and every library it imports (many branch on `NODE_ENV`) see it from their first line. An
explicit value is kept (`NODE_ENV=staging node server.ts`). `dist/server/entry.js` does the same
when another server imports it directly.

## createHandler

```ts
function createHandler(options?: HandlerOptions): Promise<NodeHandler>;

interface HandlerOptions {
  /** The build output directory, holding `client/` and `server/entry.js`. Default: `dist`. */
  dir?: string | URL;
  /** The public origin (`https://example.com`) behind a proxy. Default: `ORIGIN`, else the request's. */
  origin?: string;
  /** `ctx.env` and `env()` of requests. Default: `process.env`. */
  env?: Readonly<Record<string, string | undefined>>;
  /** Headers for every response; a response's own header of the same name wins. */
  headers?: import("node:http").OutgoingHttpHeaders;
  /** Compress responses for clients that accept brotli or gzip. Default: true. */
  compress?: boolean;
  /** Symbolic links in dist/client: follow them (warning about escapes) or "contain". */
  symlinks?: "follow" | "contain"; // default "follow"
}

type NodeHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: (error?: unknown) => void,
) => void;
```

The same request handling as a Node request listener, for your own `http.createServer` or as
connect/Express middleware (errors go to `next`). The app is the build's `createHandler()`
([server build](./server-entry.md#createhandler)); `ctx.platform.clientAddress` is the socket's
remote address (a proxy's, behind one). Set `origin` (or `ORIGIN`) when a proxy terminates
TLS or rewrites the host: request URLs, and the cross-site check of form posts, use it.

`headers` go on every response, the static files (prerendered pages included) and the app's
alike: the place for headers that middleware cannot add to static files, such as
`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` for a cross-origin isolated page.
They are set first, so a response's own header of the same name wins: a static file's
`cache-control`, a page's `response().setHeader()`, a middleware's response. `lumiose preview` passes
Vite's `preview.headers`, which default to `server.headers`. The build's `lumiose({ headers })`
([@lumiose/vite](./vite.md#lumiose)) apply too, by path, after these: prefer them, so dev, preview,
this adapter and static hosts send the same headers.

**Compression** is on by default. Static files are served from the `.br` and `.gz` copies that
`lumiose build` writes next to every text file of `dist/client` of at least 1 kB (brotli quality 11,
gzip level 9), so they cost no CPU per request. The app's own responses (pages, endpoints) with a
text content type (`text/*`, JSON, JavaScript, XML, SVG) are compressed on the fly: brotli at
quality 4, else gzip at level 6, as `Accept-Encoding` allows. Streamed pages stay streamed: the
compressor flushes whenever the render pauses, so the shell and each `<Suspense>` chunk reach the
browser as soon as they are rendered. Responses that are already encoded, below 1 kB with a known
length, `HEAD`, `204`/`304` or marked `Cache-Control: no-transform` are sent as they are; every
compressible response gets `Vary: Accept-Encoding`. Pass `compress: false` when a proxy or CDN in
front compresses, or to measure raw payloads.

**Compression and secrets (BREACH).** A compressed response's size can leak a secret it contains
(a CSRF token, a session value) when an attacker can make the victim's browser request pages that
also reflect attacker-chosen text, and can observe the sizes. Lumiose's form check uses the `Origin`
header, not a token in the page, so it is not exposed; for pages that render a secret next to
reflected input (a token in a form that also echoes a query parameter), send them with
`Cache-Control: no-transform` (`response().setHeader("cache-control", "private, no-transform")`),
which skips on-the-fly compression for that response, or turn compression off with
`compress: false`.

**Malformed requests** never reach the app and are not logged: a request target that is not a
path (`http://other/x`, `//host` is a path) or an invalid `Host` header gets `400`, `TRACE`/`TRACK`
`405`, `CONNECT` `501`. Request bodies are bounded by the app's limits (1 MB, 10 MB for
uploads, `lumiose({ limits })`; see [Security](../concepts/security.md)).

**Timeouts.** The server keeps Node's defaults (`headersTimeout` 60 s, `requestTimeout` 300 s,
`keepAliveTimeout` 5 s), which bound slow clients. On the open internet, put a reverse proxy
(nginx, Caddy, a load balancer) in front for TLS, connection limits and tighter timeouts, or set
them on `createServer(…).server` (`server.requestTimeout = 30_000`).

## createStaticHandler

```ts
function createStaticHandler(
  dir: string,
  config: BuiltAppConfig,
  options?: StaticOptions,
): StaticHandler;
type StaticHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
interface StaticOptions {
  /** Serve the precompressed `.br`/`.gz` copies to clients that accept them. Default: true. */
  compress?: boolean;
  /** Follow symbolic links that leave `dir` (with a warning), or "contain" them. */
  symlinks?: "follow" | "contain"; // default "follow"
}
```

Serves `GET` and `HEAD` requests below the app's `base` from `dir` (the build's `client/`), and
resolves `false` when no file answers. Content-hashed files in the assets directory (Vite's
`name-[hash].ext`, whose hash may hold `-` and `_`: `Counter-D-i-jZkv.js`) are cached for a year
(`immutable`); everything else, other files under `assets/` included, revalidates with `ETag` and
`Last-Modified` (`304`). The rule reads the file name (8 hash characters with a digit or an
uppercase letter), so a `public/assets/` file named like a hashed one (`badge-v2-final.svg`) is
cached for a year too: `lumiose build` warns about such files. Page URLs
follow the build's `trailingSlash`: `/about` serves `about/index.html` (`"ignore"`), redirects to
`/about/` (`"always"`), or serves `about.html` (`"never"`, which redirects `/about/`). Paths with
`..` or dot files (other than `.well-known`) are never served. `config` is the build entry's
`config` export. With `compress`, a client that accepts brotli (else gzip) gets the file's `.br`
(else `.gz`) copy when the build wrote one, with `Content-Encoding` and `Vary: Accept-Encoding`.
`dir` is indexed once, when the handler is created: a build output does not change while it is
served, and requests no file answers (every page) cost no file system call. Files written into
`dir` later are not served until the server restarts. An entry that cannot be read is skipped with a
warning. Symbolic links are followed (as serve-static and nginx do); links that lead outside `dir`
are listed in a warning at startup, and `symlinks: "contain"` leaves them out.
`_headers` (rules for static hosts) and the `.br`/`.gz` copies are not served as files of their own.

## Example

```ts
// server.ts: run with `node server.ts` after `lumiose build`
import { createServer } from "@lumiose/adapter-node";

const app = await createServer({
  port: 8080,
  headers: {
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-embedder-policy": "require-corp",
  },
});
console.log(`Listening on ${app.url}`);
```

As middleware in an existing server:

```ts
import { createHandler } from "@lumiose/adapter-node";
import express from "express";

const server = express();
server.use(await createHandler({ dir: new URL("./dist", import.meta.url) }));
server.listen(3000);
```
