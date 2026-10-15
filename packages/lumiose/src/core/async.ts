// Async state shared by async components, boundaries and resources (spec §4.3-4.4, decision-20).
//
// - `isPending()` reads the in-flight flag that an async component instance provides on its owner.
// - `isBusy()` is the app-wide summary: async runs, `<Suspense>` fallbacks, form submissions and SPA
//   navigations register with it through `beginBusy()` while they are in flight.
// - `suspend(owner)` registers new pending content (the first run of an async instance, the first
//   load of a resource) with the nearest `<Suspense>`, whose count of pending content decides when
//   it shows its fallback. Re-runs never register, so revealed content stays on screen.
import { batch, createRun, isRun, pauseRun, resumeRun, type Run } from "./effect.ts";
import {
  addCleanup,
  DISPOSED,
  disposeOwner,
  getOwner,
  readContext,
  lifetimeOf,
  lookupContext,
  type Owner,
} from "./owner.ts";
import { activeSub } from "./reactive.ts";
import { untrack } from "./reactive.ts";
import { computed, signal, type Signal } from "./signal.ts";
import { INSPECTED } from "../dom/dev.ts";
import { labelValue } from "../dom/devtools.ts";

/** Context key of an async instance's in-flight flag. */
export const PENDING: unique symbol = Symbol();
/** Context key of a `<Suspense>` boundary's count of pending content. */
export const SUSPENSE: unique symbol = Symbol();
/**
 * Context key of a revision signal (the SPA router's): async component runs and resources below
 * it read it, so bumping it (`invalidate()`) re-runs them.
 */
export const REVISION: unique symbol = Symbol();

const noop = (): void => {};

/**
 * Inside an async component (its body or its UI): whether a re-run is in flight. The first load
 * is not a re-run: `<Suspense>` covers it. Never tracked by the component's own run, so reading it
 * in the body does not re-run the component.
 */
export function isPending(): boolean {
  const flag = readContext(PENDING, undefined) as Signal<boolean> | undefined;
  return flag === undefined ? false : isRun(activeSub) ? flag.peek() : flag();
}

// Pure: bundles that never read `isBusy()` or register work drop them.
const inFlight = /* @__PURE__ */ signal(0);
const anyInFlight = /* @__PURE__ */ computed(() => inFlight() > 0);
if (import.meta.env?.DEV && INSPECTED) {
  labelValue(inFlight, "isBusy count", true);
  labelValue(anyInFlight, "isBusy()", true);
}

/**
 * App-wide: whether anything is in flight (decision-20): an async component run, a `<Suspense>`
 * showing its fallback, a form submission or an SPA navigation. Like `isPending()`, it is never
 * tracked by an async component's own run.
 */
export function isBusy(): boolean {
  return isRun(activeSub) ? untrack(anyInFlight) : anyInFlight();
}

/** Registers something in flight with `isBusy()`; returns the function (idempotent) that ends it. */
export function beginBusy(): () => void {
  return hold(inFlight);
}

/**
 * What `SUSPENSE` provides: a count of pending content. A `<Suspense>` provides a signal; an async
 * run that is not shown yet provides its own, so the content it creates holds its swap instead.
 */
export interface Boundary {
  update(fn: (count: number) => number): void;
}

/**
 * Registers pending content with the nearest boundary above `owner`. Returns the release function
 * (idempotent), to call when the content first settles or is disposed.
 */
export function suspend(owner: Owner | undefined): () => void {
  const boundary = lookupContext(owner, SUSPENSE, undefined) as Boundary | undefined;
  return boundary === undefined ? noop : hold(boundary);
}

/** Adds one to `count`; returns the function (idempotent) that takes it back. */
function hold(count: Boundary): () => void {
  count.update((n) => n + 1);
  let done = false;
  return () => {
    if (!done) {
      done = true;
      count.update((n) => n - 1);
    }
  };
}

// --- resource ------------------------------------------------------------------------------------

export interface Resource<T> {
  /** The latest loaded value; `undefined` until the first load resolves. Tracked. */
  (): T | undefined;
  /** Whether a load is in flight. Tracked. */
  loading(): boolean;
  /** The error of the latest load, or `undefined` once a load succeeds. Tracked. */
  error(): unknown;
  /** Loads again, aborting a load in flight. */
  refetch(): void;
}

/**
 * Low-level on-demand loading (spec §4.3); async components are the default way to load data.
 * `fetcher` runs now and again whenever a signal it read synchronously changes, or on `refetch()`;
 * its `AbortSignal` aborts when the load is superseded or the owner is disposed. The first load
 * counts as pending content for the nearest `<Suspense>`. Errors are not thrown: read `error()`.
 * In the browser only: on the server the resource stays loading and `fetcher` never runs.
 */
export function resource<T>(fetcher: (signal: AbortSignal) => T | PromiseLike<T>): Resource<T> {
  const owner = getOwner();
  const value = signal<T | undefined>(undefined);
  const loading = signal(true);
  const error = signal<unknown>(undefined);
  if (import.meta.env?.DEV && INSPECTED) {
    labelValue(value, "resource value", true);
    labelValue(loading, "resource loading", true);
    labelValue(error, "resource error", true);
  }
  const release = suspend(owner);
  const revision = lookupContext(owner, REVISION, undefined) as (() => number) | undefined;
  let current: Run | undefined;

  const settle = (run: Run, ok: boolean, result: unknown): void => {
    if (run !== current || run.state & DISPOSED) {
      return;
    }
    batch(() => {
      if (ok) {
        value.set(result as T);
      }
      error.set(ok ? undefined : result);
      loading.set(false);
    });
    release();
  };

  const load = (): void => {
    if (current !== undefined) {
      disposeOwner(current);
    }
    // A fresh subscriber per load; a change to what `fetcher` read starts the next one.
    const run = (current = createRun(load, owner));
    resumeRun(run);
    let result: unknown;
    try {
      revision?.();
      result = fetcher(lifetimeOf(run));
    } catch (thrown) {
      result = Promise.reject(thrown);
    } finally {
      pauseRun(run);
    }
    loading.set(true);
    Promise.resolve(result).then(
      (resolved) => settle(run, true, resolved),
      (rejected: unknown) => settle(run, false, rejected),
    );
  };

  load();
  if (owner !== undefined) {
    addCleanup(owner, release);
  }
  const read = (() => value()) as Resource<T>;
  read.loading = loading;
  read.error = error;
  read.refetch = load;
  return read;
}
