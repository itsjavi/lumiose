// Node `http` ↔ web `Request`/`Response`, for the dev server (connect middleware) and
// `@lumen/adapter-node`. Server-only.

import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import type { TLSSocket } from "node:tls";

// For adapters: the `lumen({ headers })` of a request path (`config.headers` of the server entry).
export { headersFor, pathBelowBase, type HeadersOption } from "../headers.ts";

/**
 * A web `Request` for an incoming Node request. The URL comes from `origin` (or the `Host` header
 * and the socket's protocol) and `originalUrl` (connect) or `url`. The body streams; the signal
 * aborts when the client disconnects before the response finished.
 */
export function toWebRequest(
  req: IncomingMessage & { originalUrl?: string },
  res: ServerResponse,
  origin?: string,
): Request {
  const base = origin ?? `${protocolOf(req)}://${hostOf(req)}`;
  const url = new URL(req.originalUrl ?? req.url ?? "/", base);
  const headers = new Headers();
  const raw = req.rawHeaders;
  for (let i = 0; i < raw.length; i += 2) {
    // HTTP/2 pseudo-headers (`:method`, `:path`, …) are not valid header names.
    if (!raw[i]!.startsWith(":")) headers.append(raw[i]!, raw[i + 1]!);
  }
  const controller = new AbortController();
  res.once("close", () => {
    if (!res.writableFinished) controller.abort();
  });
  const method = req.method ?? "GET";
  const init: RequestInit & { duplex?: "half" } = { method, headers, signal: controller.signal };
  if (method !== "GET" && method !== "HEAD") {
    init.body = Readable.toWeb(req) as ReadableStream<Uint8Array>;
    init.duplex = "half";
  }
  return new Request(url, init);
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
