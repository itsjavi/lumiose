// The keyed async cache on the server (doc-6 §B, decision-34): one cache per request, kept on the
// request's state scope (TASK-193's `runInRequestScope`; a render outside a request has a scope of
// its own, and tests one per test). Only awaits inside async component runs use it: middleware,
// endpoints and actions make plain requests.
//
// - Components awaiting the same entry share one request; the entry then serves the rest of the
//   request. There is no revalidation on the server: a request is short-lived.
// - Errors are not cached: a failed entry is dropped, so the next await fetches again.
// - Entries awaited inside an island (SPA pages render inside one too) are marked: the page
//   payload sends them once (`encodeCache`, the `c` record next to `s`), and the browser cache
//   starts with them, so islands reuse the server's data without fetching it again. The island's
//   await records hold a marker instead of the value (`cachedValues`, ../../server/frame.ts), so
//   the data is not sent twice. Entries only server components awaited never reach the browser.
import { getAbortSignal } from "../../core/server.ts";
import { LUM_AWAIT_VALUE, LumioseError } from "../diagnostics.ts";
import { cachedValues, currentFrame, detached, inAsyncRun } from "../../server/frame.ts";
import { encodeData } from "../../server/serialize.ts";
import { currentStateScope } from "../../server/state.ts";
import { hashKey, join, startFlight, type Flight, type QueryKey } from "./shared.ts";

/** A server cache entry: data once `h`, the request in flight, and whether islands awaited it. */
export interface ServerEntry {
  d: unknown;
  h: boolean;
  q: Flight | undefined;
  /** Reached by client code (awaited inside an island): sent with the page payload. */
  c: boolean;
  /** Its key in the payload: the `query()` hash, or the URL (same-origin ones as `/path?query`). */
  w: string;
}

/** Whether the current code is an async component run with a cache (a request or a render). */
export function canCache(): boolean {
  return inAsyncRun() && currentStateScope() !== undefined;
}

/**
 * Awaited by the current run: the entry `id`, loaded by `load` on a miss, outside the run (so
 * `fetchJSON` inside it is a plain request) under the flight's owner. `signal` aborts this
 * caller's wait only. The returned promise is marked for the island await records.
 */
export function cached<T>(
  id: string,
  wire: string,
  load: () => unknown,
  signal: AbortSignal | null | undefined,
): Promise<T> {
  const map = (currentStateScope()!.cache ??= new Map());
  let entry = map.get(id);
  if (entry === undefined) {
    entry = { d: undefined, h: false, q: undefined, c: false, w: wire };
    map.set(id, entry);
  }
  if (currentFrame()?.island !== undefined) entry.c = true;
  let promise: Promise<T>;
  if (entry.h) {
    promise = Promise.resolve(entry.d as T);
  } else {
    const found = entry;
    let flight = found.q;
    if (flight === undefined) {
      const started: Flight =
        (flight =
        found.q =
          startFlight(
            (owner) => detached(owner, load) as Promise<unknown>,
            () => {
              if (found.q === started) found.q = undefined;
            },
          ));
      started.p.then(
        (data) => {
          if (found.q !== started) return;
          found.q = undefined;
          found.d = data;
          found.h = true;
        },
        () => {
          if (map.get(id) === found && found.q === started) map.delete(id);
        },
      );
    }
    promise = join<T>(flight, signal);
  }
  cachedValues.add(promise);
  return promise;
}

/** `await query(key, fn)` on the server: inside an async component, cached under `key`. */
export function query<T>(key: QueryKey, fn: () => T | PromiseLike<T>): Promise<T> {
  try {
    if (!canCache()) return Promise.resolve(fn());
    const hash = hashKey(key);
    return cached<T>(hash, hash, fn, getAbortSignal());
  } catch (error) {
    return Promise.reject(error);
  }
}

/**
 * Encodes the entries of `cache` that islands awaited, have data and are not in `sent` yet (and
 * adds them to it): the payload's `c` record. Throws LUM4007 for a value that is not plain data.
 */
export function encodeCache(
  cache: Map<string, ServerEntry> | undefined,
  sent: Set<string>,
): Record<string, unknown> | undefined {
  let out: Record<string, unknown> | undefined;
  for (const [id, entry] of cache ?? []) {
    if (!entry.c || !entry.h || sent.has(id)) continue;
    sent.add(id);
    (out ??= {})[entry.w] = encodeData(entry.d, (path, reason) => {
      throw new LumioseError(
        LUM_AWAIT_VALUE,
        `The value cached under ${entry.w}${path} is ${reason}. An island awaited it, so it is sent to the browser and must be plain data; return JSON from an endpoint (fetchJSON) or map it to plain objects in the query() function`,
      );
    });
  }
  return out;
}
