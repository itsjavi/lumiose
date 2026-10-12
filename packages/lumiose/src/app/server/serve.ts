// The server build's `export default { fetch(request, platform?) }` (decision-45, TASK-248): the
// app's request handler, the static files of `dist/client` in front of it (./static-fs.ts, unless
// the deploy adapter's host serves them) and `lumiose({ headers })` on every response. It is the
// module-worker shape that Bun (`bun dist/server/entry.js`), Deno (`deno serve`) and workerd run as
// is, and what the deploy adapters wrap.
//
// The second argument is `ctx.platform` (bindings, `waitUntil`, the client address). What those
// runtimes pass there is recognized instead: Bun's server and Deno's handler info give the client
// address, and workerd's `(request, env, ctx)` the bindings and `waitUntil`.

import type { BuiltAppConfig } from "./app.ts";
import type { Platform } from "./context.ts";
import type { RequestHandler } from "./handler.ts";
import { headersFor, pathBelowBase } from "../headers.ts";

/** Answers a request from static files; `undefined` when no file does. */
export type StaticFiles = (request: Request, url: URL) => Promise<Response | undefined>;

/** `export default` of the server build. */
export interface BuildHandler {
  /**
   * Serves a request: a static file, else the app. `platform` becomes `ctx.platform`; Bun's
   * server, Deno's handler info and workerd's `(env, ctx)` are recognized too.
   */
  fetch(
    request: Request,
    platform?: Partial<Platform> | object,
    context?: object,
  ): Promise<Response>;
}

export function serveBuild(
  app: RequestHandler,
  config: Pick<BuiltAppConfig, "base" | "headers">,
  statics?: StaticFiles,
): BuildHandler {
  return {
    // Unbound: `export default { fetch }` callers may call it detached.
    fetch: async (request, platform, context) => {
      const url = new URL(request.url);
      const response =
        (statics === undefined ? undefined : await statics(request, url)) ??
        (await app.fetch(request, platformOf(request, platform, context)));
      // `lumiose({ headers })` for this path (decision-26 §4), Lumiose's defaults included
      // (decision-29); the response's own headers win.
      const path = pathBelowBase(url.pathname, config.base);
      return path === undefined
        ? response
        : withHeaders(response, headersFor(config.headers, path));
    },
  };
}

type Loose = Record<string, unknown>;

const isObject = (value: unknown): value is Loose => typeof value === "object" && value !== null;

/** `ctx.platform` from the arguments a host calls `fetch` with. */
function platformOf(
  request: Request,
  second: unknown,
  third: unknown,
): Partial<Platform> | undefined {
  // workerd: `fetch(request, env, ctx)`.
  if (isObject(third) && typeof third.waitUntil === "function") {
    const context = third as { waitUntil(promise: Promise<unknown>): void };
    return {
      env: (second ?? {}) as Platform["env"],
      waitUntil: (promise) => context.waitUntil(promise),
      clientAddress: request.headers.get("cf-connecting-ip") ?? undefined,
    };
  }
  if (!isObject(second)) return undefined;
  // Bun.serve: `fetch(request, server)`.
  if (typeof second.requestIP === "function") {
    const address = (second.requestIP as (request: Request) => { address?: string } | null)(
      request,
    );
    return { clientAddress: address?.address };
  }
  // Deno.serve: `fetch(request, info)`.
  const remote = second.remoteAddr;
  if (isObject(remote) && typeof remote.hostname === "string") {
    return { clientAddress: remote.hostname };
  }
  return second as Partial<Platform>;
}

/** The response with `headers` it does not set itself. */
function withHeaders(response: Response, headers: Record<string, string>): Response {
  const missing = Object.entries(headers).filter(([name]) => !response.headers.has(name));
  if (missing.length === 0) return response;
  try {
    for (const [name, value] of missing) response.headers.set(name, value);
    return response;
  } catch {
    // Immutable headers (`Response.redirect()`, a `fetch()` response): a copy gets them.
    const copy = new Headers(response.headers);
    for (const [name, value] of missing) copy.set(name, value);
    try {
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: copy,
      });
    } catch {
      return response; // a status `Response` cannot be built with (101 upgrades)
    }
  }
}
