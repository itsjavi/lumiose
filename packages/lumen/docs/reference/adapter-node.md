# `@lumen/adapter-node`

> Serves a `lumen build` output with Node: the static files of `dist/client` first, then the app's request handler from `dist/server/entry.js`, with streamed responses.

`lumen preview` uses it, so a project that previews or deploys on Node depends on it. Concepts:
[Rendering modes](../concepts/rendering-modes.md) (build output), [Server](../concepts/server.md).

## createServer

```ts
function createServer(options?: ServerOptions): Promise<LumenServer>;

interface ServerOptions extends HandlerOptions {
  /** Default: the `PORT` env variable, else 3000. `0` picks a free port. */
  port?: number;
  /** Default: the `HOST` env variable, else every address. */
  host?: string;
}

interface LumenServer {
  readonly server: import("node:http").Server;
  /** The URL it listens on, e.g. `http://localhost:3000/` (with the app's `base`). */
  readonly url: string;
  close(): Promise<void>;
}
```

Loads the build and starts an HTTP server; resolves once it listens. A missing build fails with
"No build in dist … Run `lumen build` first."

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
}

type NodeHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: (error?: unknown) => void,
) => void;
```

The same request handling as a Node request listener, for your own `http.createServer` or as
connect/Express middleware (errors go to `next`). Set `origin` (or `ORIGIN`) when a proxy terminates
TLS or rewrites the host: request URLs, and the cross-site check of form posts, use it.

## createStaticHandler

```ts
function createStaticHandler(dir: string, config: BuiltAppConfig): StaticHandler;
type StaticHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;
```

Serves `GET` and `HEAD` requests below the app's `base` from `dir` (the build's `client/`), and
resolves `false` when no file answers. Content-hashed files in the assets directory are cached for a
year (`immutable`); everything else revalidates with `ETag` and `Last-Modified` (`304`). Page URLs
follow the build's `trailingSlash`: `/about` serves `about/index.html` (`"ignore"`), redirects to
`/about/` (`"always"`), or serves `about.html` (`"never"`, which redirects `/about/`). Paths with
`..` or dot files (other than `.well-known`) are never served. `config` is the build entry's
`config` export.

## Example

```ts
// server.ts: run with `node server.ts` after `lumen build`
import { createServer } from "@lumen/adapter-node";

const app = await createServer({ port: 8080 });
console.log(`Listening on ${app.url}`);
```

As middleware in an existing server:

```ts
import { createHandler } from "@lumen/adapter-node";
import express from "express";

const server = express();
server.use(await createHandler({ dir: new URL("./dist", import.meta.url) }));
server.listen(3000);
```
