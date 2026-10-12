// `fetchJSON()` (spec §4.3, decision-18): fetch that returns plain JSON data and throws a typed
// `FetchError` for non-2xx responses. This is the browser version; under the node condition,
// ./server/fetch-json.ts serves same-origin URLs in-process through the request handler.

import { runFetch } from "./cache/run-fetch.ts";
import { HttpError, statusText } from "./server/control.ts";

/**
 * Thrown by `fetchJSON()` for non-2xx responses, and by `submit()` when an action throws. An
 * `HttpError`, so if a server component lets it escape, the page renders `error` (or `not-found`) with
 * the same status.
 */
export class FetchError extends HttpError {
  /** The requested URL. */
  readonly url: string;
  /** The response body: parsed JSON for JSON responses, else text; `undefined` when empty. */
  readonly data: unknown;

  constructor(status: number, message: string, url: string, data: unknown) {
    super(status, message);
    this.name = "FetchError";
    this.url = url;
    this.data = data;
  }
}

export function isFetchError(value: unknown): value is FetchError {
  return value instanceof FetchError;
}

/** A request for `fetchJSON()`: `Accept: application/json` unless `init` sets it. */
export function jsonRequest(url: URL, init: RequestInit | undefined): Request {
  const request = new Request(url, init);
  if (!request.headers.has("accept")) request.headers.set("accept", "application/json");
  return request;
}

/** Sends `request` and returns its JSON body (`undefined` when empty); non-2xx throw `FetchError`. */
export async function requestJSON<T>(
  send: (request: Request) => Promise<Response>,
  request: Request,
): Promise<T> {
  const response = await send(request);
  if (!response.ok) throw await fetchError(response, request.url);
  const text = await response.text();
  if (text === "") return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    const type = response.headers.get("content-type") ?? "none";
    throw new TypeError(
      `fetchJSON(${request.url}): the response is not JSON (content-type: ${type}).`,
    );
  }
}

/** A `FetchError` for a failed response, with its body as `data`. */
export async function fetchError(response: Response, url: string): Promise<FetchError> {
  const message = response.statusText || statusText(response.status);
  return new FetchError(response.status, message, url, await readBody(response));
}

/** A response body as JSON when it parses (and says it is JSON), else as text. */
export async function readBody(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "");
  if (text === "") return undefined;
  if (/[/+]json\b/i.test(response.headers.get("content-type") ?? "")) {
    try {
      return JSON.parse(text);
    } catch {
      // Mislabelled: keep the text.
    }
  }
  return text;
}

/**
 * Fetches JSON: `const post = await fetchJSON<Post>("/api/posts/1")`. Throws a `FetchError` for
 * non-2xx responses. Returns plain data, so values awaited inside islands stay serializable.
 * During SSR, same-origin URLs are served in-process, with the page request's cookies.
 * Awaited in an async component, a GET is cached by its absolute URL: components awaiting the same
 * URL share one request, cached data shows at once and revalidates in the background, and
 * `invalidate(url)` refetches it; `cache: "no-store"` opts out (a plain request). Elsewhere (event
 * handlers, actions), it is a plain request.
 * Inside an async component, the signal defaults to `getAbortSignal()`: a superseded run stops
 * waiting, and a request no component waits for anymore is cancelled (pass `signal` to choose
 * another, or `null` for none).
 */
export function fetchJSON<T = unknown>(input: string | URL, init?: RequestInit): Promise<T> {
  try {
    const base = typeof document === "undefined" ? globalThis.location?.href : document.baseURI;
    const url = new URL(input, base);
    const request = (options: RequestInit | undefined) =>
      requestJSON<T>((sent) => globalThis.fetch(sent), jsonRequest(url, options));
    // Inside an async component run, the cache (./cache/run-fetch.ts); elsewhere a plain request.
    return runFetch(url, init, request) ?? request(init);
  } catch (error) {
    return Promise.reject(error);
  }
}
