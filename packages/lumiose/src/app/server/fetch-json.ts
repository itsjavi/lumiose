// `fetchJSON()` under the node condition (spec §4.3, decision-18). While handling a request,
// relative URLs resolve against the request URL and same-origin URLs are served in-process by
// the request handler (no network), as part of the page request: same cookies, a copy of its
// locals, aborted with it. Other URLs use the global fetch.

import { getAbortSignal } from "../../core/server.ts";
import { inAsyncRun } from "../../server/frame.ts";
import { cached, canCache } from "../cache/server.ts";
import { isCacheable } from "../cache/shared.ts";
import { jsonRequest, requestJSON } from "../fetch-json.ts";
import { getRequestScope } from "./scope.ts";

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 20;

/**
 * Fetches JSON: `const post = await fetchJSON<Post>("/api/posts/1")`. Throws a `FetchError` for
 * non-2xx responses. Returns plain data, so values awaited inside islands stay serializable.
 * During SSR, same-origin URLs are served in-process, with the page request's cookies. Awaited in
 * an async component, a GET is cached for the rest of the request by its absolute URL (islands get
 * it with the page), unless `init.cache` is `"no-store"`; the signal then defaults to
 * `getAbortSignal()` (the render's).
 */
export function fetchJSON<T = unknown>(input: string | URL, init?: RequestInit): Promise<T> {
  try {
    const scope = getRequestScope();
    const base = scope?.ctx.url;
    let target: URL;
    try {
      target = new URL(input, base);
    } catch {
      throw new TypeError(
        `fetchJSON(${String(input)}): relative URLs need a current request to resolve against; pass an absolute URL.`,
      );
    }
    const inProcess = scope?.fetch;
    const send = (signal: AbortSignal | null | undefined): Promise<T> => {
      const request = jsonRequest(target, signal === undefined ? init : { ...init, signal });
      return inProcess !== undefined && target.origin === base!.origin
        ? requestJSON((first) => followInProcess(inProcess, first), request)
        : requestJSON((outgoing) => globalThis.fetch(outgoing), request);
    };
    if (!inAsyncRun()) return send(undefined);
    // Inside an async component, the render's lifetime: the fetch stops when the render is aborted.
    const signal = init?.signal === undefined ? getAbortSignal() : init.signal;
    if (!isCacheable(init) || !canCache()) return send(signal);
    // Same-origin URLs travel in the page payload as `/path?query`: the browser's origin may differ.
    const wire =
      base !== undefined && target.origin === base.origin
        ? target.pathname + target.search
        : target.href;
    return cached<T>(target.href, wire, () => send(getAbortSignal()), signal);
  } catch (error) {
    return Promise.reject(error);
  }
}

/**
 * Follows same-origin redirects of in-process responses like fetch() would: 303 (and 301/302 of
 * non-GET requests) continue as GET; 307/308 only for GET and HEAD, whose bodies are empty. Other
 * redirects come back as they are, and fetchJSON reports them as errors.
 */
async function followInProcess(
  send: (request: Request) => Promise<Response>,
  first: Request,
): Promise<Response> {
  let request = first;
  for (let hops = 0; ; hops++) {
    const response = await send(request);
    const location = response.headers.get("location");
    if (!REDIRECTS.has(response.status) || location === null || request.redirect !== "follow") {
      return response;
    }
    const target = new URL(location, request.url);
    const bodyless = request.method === "GET" || request.method === "HEAD";
    const keepsMethod = response.status === 307 || response.status === 308;
    if (target.origin !== new URL(request.url).origin || (keepsMethod && !bodyless)) {
      return response;
    }
    if (hops === MAX_REDIRECTS) {
      throw new TypeError(`fetchJSON(${first.url}): more than ${MAX_REDIRECTS} redirects.`);
    }
    void response.body?.cancel();
    const method = keepsMethod || request.method === "HEAD" ? request.method : "GET";
    const headers = new Headers(request.headers);
    if (method !== request.method) headers.delete("content-type");
    request = new Request(target, { method, headers, signal: request.signal });
  }
}
