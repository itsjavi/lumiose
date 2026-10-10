// The keyed async cache in the browser (doc-6 §B, decision-34): one cache per page, shared by
// every island and the SPA tree, kept across client navigations. Only awaits inside async
// component runs (and resources) use it; the same calls elsewhere are plain requests.
//
// - Dependencies: each entry has a trigger that the awaiting run tracks, like a signal read, so
//   invalidating an entry re-runs exactly the runs that awaited it. Nothing in core or dom knows
//   about the cache.
// - Stale-while-revalidate (TanStack defaults: `staleTime` 0, `gcTime` 5 min): an entry with data
//   returns it at once, so a new instance shows without a `<Suspense>` fallback, and refetches in
//   the background unless its data arrived during the current task (the re-runs that the arrival
//   itself causes) or the await replays a hydrating island (the data is the server's, just sent).
//   The refetch keeps unchanged parts of the old data (structural sharing) and re-runs the runs
//   showing it only when something changed.
// - Invalidation (`invalidate(url | key)`): matching entries are marked and their runs re-run;
//   a re-run waits for the refetch instead (its old UI stays on screen and `isPending()` is true),
//   while a new instance still shows the old data at once and refetches in the background.
// - Errors are never cached: a failed first load leaves the entry empty, so the next await (a
//   retry, or `invalidate()`) fetches again; a failed background refetch keeps the old data.
// - Garbage collection: an entry no run holds is dropped `gcTime` after the last one let go.
// - Server results: on a miss, the cache reads the page payload's `c` record (`data-l-payload`,
//   decision-33), where the server put the entries that islands and SPA pages awaited.
import { isBusy, isPending } from "../../core/async.ts";
import { batch, effect } from "../../core/effect.ts";
import {
  activeSub,
  addCleanup,
  beginBusy,
  createTrigger,
  isRun,
  lifetimeOf,
  runWithOwner,
  track,
  trigger,
  type Run,
  type TriggerNode,
} from "../../core/internal.ts";
import { untrack } from "../../core/reactive.ts";
import { generation } from "../../core/state.ts";
import { DEV } from "../../dom/dev.ts";
import { frame } from "../../dom/frame.ts";
import { decodeData } from "../../server/serialize.ts";
import {
  hashKey,
  join,
  looksLikeUrl,
  matchKey,
  startFlight,
  type Flight,
  type QueryKey,
} from "./shared.ts";

/** How long an entry no run holds stays cached (TanStack Query's default `gcTime`). */
export const GC_TIME = 5 * 60 * 1000;

interface Entry {
  /** Its `query()` key, for prefix matching; undefined for a URL. */
  k: QueryKey | undefined;
  /** The data, once `h` (has data). */
  d: unknown;
  h: boolean;
  /** Fresh: the data arrived during the current task, so awaits do not refetch it. */
  f: boolean;
  /** Invalidated: re-runs wait for a refetch. */
  x: boolean;
  /** A run shows `d` while a refetch may replace it: the arrival re-runs it if the data changed. */
  s: boolean;
  /** The request in flight. */
  q: Flight | undefined;
  /** Tracked by the runs that awaited the entry; triggered to re-run them. */
  t: TriggerNode;
  /** Runs holding the entry, and the garbage collection timer once none does. */
  u: number;
  g: ReturnType<typeof setTimeout> | undefined;
}

let entries = new Map<string, Entry>();
let entriesGeneration = generation;

/** The page's entries; `resetStates()` (fresh per test) drops them with the scoped states. */
function current(): Map<string, Entry> {
  if (entriesGeneration !== generation) {
    entriesGeneration = generation;
    entries = new Map();
  }
  return entries;
}

function create(map: Map<string, Entry>, id: string, key: QueryKey | undefined): Entry {
  const entry: Entry = {
    k: key,
    d: undefined,
    h: false,
    f: false,
    x: false,
    s: false,
    q: undefined,
    t: createTrigger(),
    u: 0,
    g: undefined,
  };
  map.set(id, entry);
  return entry;
}

/** Whether the current code is an async component run (or a resource load) that can cache. */
export function inRun(): boolean {
  return isRun(activeSub);
}

/** The current run's `getAbortSignal()`. */
export function runSignal(): AbortSignal {
  return lifetimeOf(activeSub as Run);
}

/**
 * Awaited by the current run: the entry `id` (`key` for `query()` entries), loaded by `load` on a
 * miss. `load` runs outside the run, under the flight's owner (`getAbortSignal()` is the shared
 * request's). `signal` aborts this caller's wait only.
 */
export function cached<T>(
  id: string,
  key: QueryKey | undefined,
  load: () => unknown,
  signal: AbortSignal | null | undefined,
): Promise<T> {
  const map = current();
  let entry = map.get(id);
  if (entry === undefined) {
    seed(map);
    entry = map.get(id) ?? create(map, id, key);
  }
  track(entry.t);
  hold(map, id, entry, activeSub as Run);
  if (entry.h && !(entry.x && isPending())) {
    if (entry.q === undefined && (entry.x || (!entry.f && !hydrating()))) {
      request(entry, load);
    }
    entry.s = true;
    return Promise.resolve(entry.d as T);
  }
  return join<T>(entry.q ?? request(entry, load), signal);
}

/** Whether an island is hydrating: its first runs claim server nodes (`client:only` ones do not). */
function hydrating(): boolean {
  return frame?.h !== undefined;
}

function request(entry: Entry, load: () => unknown): Flight {
  // Counts for `isBusy()`, so `invalidate()` resolves once background refetches are in too.
  const done = beginBusy();
  const flight: Flight = startFlight(
    (owner) => runWithOwner(owner, () => untrack(load)) as Promise<unknown>,
    () => {
      if (entry.q === flight) entry.q = undefined;
      done();
    },
  );
  // A miss while an island hydrates is not shared: it may be the replay evaluating an await only
  // for its reads, with `fetch` held off (dom/hydrate.ts `track`), so it may never settle. Its
  // result still fills the entry if nothing else did.
  const shared = !hydrating();
  if (shared) entry.q = flight;
  flight.p.then(
    (data) => {
      done();
      if (shared ? entry.q !== flight : entry.q !== undefined || entry.h) return;
      entry.q = undefined;
      const next = entry.h ? replaceEqualDeep(entry.d, data) : data;
      const changed = !entry.h || next !== entry.d;
      entry.d = next;
      entry.h = entry.f = true;
      entry.x = false;
      setTimeout(() => (entry.f = false));
      if (changed && entry.s) {
        entry.s = false;
        trigger(entry.t);
      }
    },
    () => {
      done();
      if (entry.q === flight) entry.q = undefined;
    },
  );
  return flight;
}

function hold(map: Map<string, Entry>, id: string, entry: Entry, run: Run): void {
  entry.u++;
  clearTimeout(entry.g);
  addCleanup(run, () => {
    if (--entry.u === 0) collect(map, id, entry);
  });
}

function collect(map: Map<string, Entry>, id: string, entry: Entry): void {
  entry.g = setTimeout(() => {
    if (entry.u === 0 && map.get(id) === entry) map.delete(id);
  }, GC_TIME);
}

/**
 * Adds the entries of the page payloads not read yet (`c`: data by key, same-origin URLs as
 * `/path?query`), unless the cache has data for them already.
 */
function seed(map: Map<string, Entry>): void {
  if (typeof document === "undefined") return;
  for (const script of document.querySelectorAll("script[data-l-payload]")) {
    const read = script as Element & { $$c?: boolean };
    if (read.$$c) continue;
    let payload: { c?: Record<string, unknown> };
    try {
      payload = JSON.parse(script.textContent!);
    } catch {
      // Still streaming in: a later miss reads it.
      continue;
    }
    read.$$c = true;
    for (const wire in payload.c) {
      const id = wire[0] === "/" ? new URL(wire, location.href).href : wire;
      const entry = map.get(id) ?? create(map, id, wire[0] === "[" ? JSON.parse(wire) : undefined);
      if (entry.h) continue;
      entry.d = decodeData(payload.c[wire]);
      entry.h = true;
      if (entry.u === 0) collect(map, id, entry);
    }
  }
}

/**
 * Marks the entries matching `targets` (every entry when undefined) as invalid and re-runs the
 * runs that awaited them. A string matches the `fetchJSON()` entry of that URL, an array the
 * `query()` entries whose key starts with it.
 */
export function invalidateEntries(targets: readonly (string | QueryKey)[] | undefined): void {
  const base = typeof document === "undefined" ? undefined : document.baseURI;
  const matchers = targets?.map((target) => {
    if (typeof target !== "string") return target;
    if (DEV && !looksLikeUrl(target)) {
      console.warn(
        `Lumiose: invalidate(${JSON.stringify(target)}): a string target is a URL, matching the fetchJSON() entry of that URL. To invalidate query() entries, pass the key as an array: invalidate([${JSON.stringify(target)}]).`,
      );
    }
    return new URL(target, base).href;
  });
  batch(() => {
    for (const [id, entry] of current()) {
      if (
        matchers !== undefined &&
        !matchers.some((target) =>
          typeof target === "string"
            ? entry.k === undefined && id === target
            : entry.k !== undefined && matchKey(entry.k, target),
        )
      ) {
        continue;
      }
      // A refetch already in flight may predate the change: the next await starts another one.
      entry.q = undefined;
      entry.x = true;
      entry.f = entry.s = false;
      trigger(entry.t);
    }
  });
}

/** Resolves once nothing is in flight anymore (`isBusy()` is false), after the re-runs started. */
export function settled(): Promise<void> {
  return new Promise<void>((resolve) => {
    // Effects run after the flush that starts the re-runs, so they already count as busy.
    const stop = effect(() => {
      if (!isBusy()) {
        stop();
        resolve();
      }
    });
  });
}

/**
 * `await query(key, fn)` in the browser: inside an async component, cached under `key`, else
 * `fn()` itself.
 */
export function query<T>(key: QueryKey, fn: () => T | PromiseLike<T>): Promise<T> {
  if (!inRun()) {
    try {
      return Promise.resolve(fn());
    } catch (error) {
      return Promise.reject(error);
    }
  }
  return cached<T>(hashKey(key), key, fn, runSignal());
}

/**
 * `next` with every part that deep-equals the same part of `prev` replaced by `prev`'s (TanStack
 * Query's structural sharing): `prev` itself when nothing changed.
 */
export function replaceEqualDeep(prev: unknown, next: unknown): unknown {
  if (prev === next) return prev;
  const array = Array.isArray(prev) && Array.isArray(next);
  if (!array && !(isPlain(prev) && isPlain(next))) return next;
  const a = prev as Record<string, unknown>;
  const b = next as Record<string, unknown>;
  const keys = Object.keys(b);
  const copy: Record<string, unknown> = array ? ([] as unknown as Record<string, unknown>) : {};
  let same = keys.length === Object.keys(a).length;
  for (const key of keys) {
    const value = replaceEqualDeep(a[key], b[key]);
    copy[key] = value;
    if (value !== a[key] || !Object.hasOwn(a, key)) same = false;
  }
  return same ? prev : copy;
}

function isPlain(value: unknown): boolean {
  return (
    typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}
