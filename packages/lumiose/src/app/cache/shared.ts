// The keyed async cache's shared parts (doc-6 §B, decision-34), used by the browser cache
// (./client.ts) and the per-request server cache (./server.ts):
// - Keys: a GET `fetchJSON()` is keyed by its absolute URL; `query(key, fn)` by `hashKey(key)`,
//   which starts with "[" (a URL never does), so both live in one map.
// - Flights: one request in flight per entry, shared by every component that awaits it. Each
//   caller waits with its own AbortSignal (its run's `getAbortSignal()` by default): aborting
//   rejects that caller's wait only. The request itself is aborted once every waiter has left.
import { createOwner, disposeOwner, lifetimeOf, type Owner } from "../../core/internal.ts";

/** A `query()` key: an array of JSON-serializable values (TanStack Query's `queryKey`). */
export type QueryKey = readonly unknown[];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

/** A stable hash of a key: its JSON, with object keys sorted (TanStack Query's `hashKey`). */
export function hashKey(key: QueryKey): string {
  return JSON.stringify(key, (_, value: unknown) => {
    if (!isPlainObject(value)) return value;
    const sorted: Record<string, unknown> = {};
    for (const name of Object.keys(value).toSorted()) sorted[name] = value[name];
    return sorted;
  });
}

/**
 * Whether `key` starts with `prefix`: TanStack Query's partial matching, so `["books"]` matches
 * `["books", 1]`, and `["books", { page: 1 }]` matches `["books", { page: 1, sort: "title" }]`.
 */
export function matchKey(key: unknown, prefix: unknown): boolean {
  if (key === prefix) return true;
  if (typeof key !== "object" || typeof prefix !== "object" || key === null || prefix === null) {
    return false;
  }
  for (const name of Object.keys(prefix)) {
    if (
      !matchKey((key as Record<string, unknown>)[name], (prefix as Record<string, unknown>)[name])
    )
      return false;
  }
  return true;
}

/** One request in flight: its promise, the owner whose lifetime aborts it, and its waiters. */
export interface Flight {
  p: Promise<unknown>;
  o: Owner;
  /** Waiters that can still leave, plus one for each waiter that never does. */
  n: number;
  /** Settled, or abandoned by every waiter. */
  done: boolean;
  /** Called when every waiter left before it settled (the request was aborted). */
  abandon: () => void;
}

/**
 * Starts a shared request. `start(owner)` runs the loader with `owner` current, so
 * `getAbortSignal()` inside it (and the signal `fetchJSON` passes on) is the flight's own.
 */
export function startFlight(
  start: (owner: Owner) => Promise<unknown>,
  abandon: () => void,
): Flight {
  const owner = createOwner(undefined);
  let promise: Promise<unknown>;
  try {
    promise = Promise.resolve(start(owner));
  } catch (error) {
    promise = Promise.reject(error);
  }
  const flight: Flight = { p: promise, o: owner, n: 0, done: false, abandon };
  const settled = (): void => {
    flight.done = true;
    disposeOwner(owner);
  };
  promise.then(settled, settled);
  return flight;
}

/** The flight's signal: aborted when every waiter left before it settled. */
export function flightSignal(flight: Flight): AbortSignal {
  return lifetimeOf(flight.o);
}

/**
 * Waits for `flight` with `signal`: an abort rejects this wait with the signal's reason and, when it
 * was the last waiter, aborts the request. Without a signal the waiter never leaves.
 */
export function join<T>(flight: Flight, signal: AbortSignal | null | undefined): Promise<T> {
  if (signal?.aborted) return Promise.reject(signal.reason);
  flight.n++;
  if (!signal) return flight.p as Promise<T>;
  return new Promise<T>((resolve, reject) => {
    const leave = (): void => {
      reject(signal.reason);
      if (--flight.n === 0 && !flight.done) {
        flight.done = true;
        flight.abandon();
        disposeOwner(flight.o);
      }
    };
    signal.addEventListener("abort", leave, { once: true });
    flight.p.then(
      (value) => {
        signal.removeEventListener("abort", leave);
        resolve(value as T);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", leave);
        reject(error);
      },
    );
  });
}

/** Whether an `invalidate()` string target looks like a URL (`/…`, `./…`, `../…`, `http(s):…`). */
export function looksLikeUrl(target: string): boolean {
  return /^(\.{0,2}\/|https?:)/i.test(target);
}
