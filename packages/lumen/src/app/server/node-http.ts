// Node `http` ↔ web `Request`/`Response`, for the dev server (connect middleware) and
// `@lumen/adapter-node`. Server-only.

import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import type { TLSSocket } from "node:tls";
import { HttpError } from "./control.ts";

// For adapters: the `lumen({ headers })` of a request path (`config.headers` of the server entry).
export { headersFor, pathBelowBase, type HeadersOption } from "../headers.ts";

/**
 * The path and query of a request target, or undefined when the target cannot be served (400): only
 * origin-form targets (`/path?query`) are, plus the asterisk form for `OPTIONS` (as `/`). The
 * target is never parsed as a URL on its own: `//attacker.test/x` is a path, not a host (TASK-164).
 */
export function requestTarget(req: IncomingMessage & { originalUrl?: string }): string | undefined {
  const target = req.originalUrl ?? req.url ?? "/";
  if (target.startsWith("/")) return target;
  if (target === "*" && req.method === "OPTIONS") return "/";
  return undefined;
}

/**
 * A request `toWebRequest` refuses: a target, `Host`, method or header it cannot serve (400, 405,
 * 501). Answer `status` without logging: it is the client's fault.
 */
export class RejectedRequest extends HttpError {
  constructor(message: string, status = 400) {
    super(status, message);
    this.name = "RejectedRequest";
  }
}

/**
 * The origin of a request: `origin` (normalized), else the socket's protocol and the `Host` header,
 * reduced to scheme, host and port so a header can add no path. Throws {@link RejectedRequest}
 * for a `Host` header that is no host.
 */
function originOf(req: IncomingMessage, origin: string | undefined): string {
  try {
    return new URL(origin ?? `${protocolOf(req)}://${hostOf(req)}`).origin;
  } catch {
    throw new RejectedRequest(`Invalid Host header: ${JSON.stringify(hostOf(req))}`);
  }
}

/**
 * Measured in TASK-150 (not changed): building the `Request` costs ~5-13 µs per request on an M1
 * Max (noisy), about a third of it for the abort signal; a lazily created signal or header pairs
 * would save ~1-2% of a page request and 2-3% of a tiny JSON endpoint, but break `new
 * Request(request)` and `clone()` following the disconnect signal. Not worth it for now.
 *
 * A web `Request` for an incoming Node request. The URL comes from `origin` (or the `Host` header
 * and the socket's protocol) and the path of `originalUrl` (connect) or `url`, appended to that
 * origin as is: a target such as `//attacker.test/x` stays a path. Throws {@link RejectedRequest}
 * for targets other than `/…` (and `*` with `OPTIONS`). The body streams; the signal aborts when
 * the client disconnects before the response finished.
 */
export function toWebRequest(
  req: IncomingMessage & { originalUrl?: string },
  res: ServerResponse,
  origin?: string,
): Request {
  const target = requestTarget(req);
  if (target === undefined) {
    throw new RejectedRequest(`Unsupported request target: ${JSON.stringify(req.url)}`);
  }
  // Concatenated, not resolved: `new URL(target, base)` would read `//host/…` as a host.
  const url = new URL(originOf(req, origin) + target);
  const headers = new Headers();
  const raw = req.rawHeaders;
  for (let i = 0; i < raw.length; i += 2) {
    // HTTP/2 pseudo-headers (`:method`, `:path`, …) are not valid header names.
    if (raw[i]!.startsWith(":")) continue;
    try {
      headers.append(raw[i]!, raw[i + 1]!);
    } catch {
      throw new RejectedRequest(`Invalid header ${JSON.stringify(raw[i])}`);
    }
  }
  const controller = new AbortController();
  res.once("close", () => {
    if (!res.writableFinished) controller.abort();
  });
  const method = req.method ?? "GET";
  // Methods fetch's Request forbids: answered here instead of failing as a server error.
  if (/^(?:TRACE|TRACK)$/i.test(method))
    throw new RejectedRequest(`${method} is not allowed.`, 405);
  if (/^CONNECT$/i.test(method)) throw new RejectedRequest("CONNECT is not supported.", 501);
  const init: RequestInit & { duplex?: "half" } = { method, headers, signal: controller.signal };
  if (method !== "GET" && method !== "HEAD") {
    // Streamed; the request handler bounds it with the app's and the route's limits (./body.ts).
    init.body = Readable.toWeb(req) as ReadableStream<Uint8Array>;
    init.duplex = "half";
  }
  try {
    return new Request(url, init);
  } catch (error) {
    // An invalid method or header value from the client.
    throw new RejectedRequest(`Malformed request: ${(error as Error).message}`);
  }
}

/**
 * Writes a web `Response` to a Node response: status, headers (each `set-cookie` separately) and
 * the body, chunk by chunk with backpressure, so streamed HTML reaches the client as it renders.
 * Cancels the body when the client disconnects.
 */
export async function sendWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  if (response.statusText !== "") res.statusMessage = response.statusText;
  for (const [name, value] of response.headers) {
    if (name !== "set-cookie") res.setHeader(name, value);
  }
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) res.setHeader("set-cookie", cookies);
  if (response.body === null) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  // A pending read resolves as done once the body is cancelled.
  const onClose = () => {
    if (!res.writableFinished) reader.cancel().catch(() => {});
  };
  res.once("close", onClose);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done || res.destroyed) break;
      if (!res.write(value)) await drained(res);
    }
    if (!res.destroyed) res.end();
  } catch (error) {
    reader.cancel(error).catch(() => {});
    res.destroy(error instanceof Error ? error : new Error(String(error)));
  } finally {
    res.off("close", onClose);
  }
}

/** Resolves when `res` can take more data, or when it closed. */
function drained(res: ServerResponse): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      res.off("drain", done);
      res.off("close", done);
      resolve();
    };
    res.on("drain", done);
    res.on("close", done);
  });
}

function protocolOf(req: IncomingMessage): string {
  return (req.socket as TLSSocket).encrypted ? "https" : "http";
}

function hostOf(req: IncomingMessage): string {
  const host = req.headers.host ?? req.headers[":authority"];
  return typeof host === "string" && host !== "" ? host : "localhost";
}
