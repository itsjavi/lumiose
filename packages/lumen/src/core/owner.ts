// Owners scope cleanup, context, lifetimes, error handlers and async runs (spec §6.1).
// Effects and runs are owners too; they also carry graph links, released on disposal.
import { currentOwner, releaseDeps, setActiveSub, setCurrentOwner } from "./reactive.ts";
import type { ReactiveNode } from "./system.ts";

export type Cleanup = () => void;

export interface Owner {
  parent: Owner | undefined;
  /** 0 for roots. Render effects run parents first, by depth. */
  depth: number;
  /** Children form an intrusive list, newest first, so disposal is newest-first and detaching is O(1). */
  firstChild: Owner | undefined;
  nextSibling: Owner | undefined;
  prevSibling: Owner | undefined;
  cleanups: Cleanup | Cleanup[] | undefined;
  /** Values provided on this owner, keyed by context id. */
  context: Record<symbol, unknown> | undefined;
  lifetime: AbortController | undefined;
  state: number;
}

export const DISPOSED = 1;
/** The owner is also a graph subscriber (effect or run) whose links must be released. */
export const SUBSCRIBER = 2;
/** A run that was superseded: it no longer tracks, and its lifetime is aborted. */
export const STALE = 4;

export function createOwner(parent: Owner | undefined): Owner {
  const owner: Owner = {
    parent: undefined,
    depth: 0,
    firstChild: undefined,
    nextSibling: undefined,
    prevSibling: undefined,
    cleanups: undefined,
    context: undefined,
    lifetime: undefined,
    state: 0,
  };
  attachOwner(owner, parent);
  return owner;
}

/** Links a new owner under `parent`. Under a disposed parent, the owner starts disposed. */
export function attachOwner(owner: Owner, parent: Owner | undefined): void {
  if (parent === undefined) {
    return;
  }
  owner.parent = parent;
  owner.depth = parent.depth + 1;
  if (parent.state & DISPOSED) {
    owner.state |= DISPOSED;
    return;
  }
  const first = parent.firstChild;
  owner.nextSibling = first;
  if (first !== undefined) {
    first.prevSibling = owner;
  }
  parent.firstChild = owner;
}

// --- Lazy owners -------------------------------------------------------------
// A lazy owner exists only once something registers on it (a cleanup, a child,
// an effect, a provided value or a lifetime), so static list rows allocate none.

const LAZY: Owner = createOwner(undefined);
let lazyParent: Owner | undefined;
let lazyOwner: Owner | undefined;

/** The current owner, materializing a pending lazy owner. */
export function getOwner(): Owner | undefined {
  const owner = currentOwner;
  if (owner !== LAZY) {
    return owner;
  }
  lazyOwner = createOwner(lazyParent);
  setCurrentOwner(lazyOwner);
  return lazyOwner;
}

/** The owner to resolve context from, without materializing a lazy owner. */
function lookupOwner(): Owner | undefined {
  return currentOwner === LAZY ? lazyParent : currentOwner;
}

/**
 * Runs `fn` under a lazy child of `parent`. Returns the child if something
 * registered on it, otherwise `undefined` (nothing to dispose).
 */
export function runWithLazyOwner(parent: Owner | undefined, fn: () => void): Owner | undefined {
  const prevOwner = setCurrentOwner(LAZY);
  const prevParent = lazyParent;
  const prevLazy = lazyOwner;
  lazyParent = parent;
  lazyOwner = undefined;
  try {
    fn();
    return lazyOwner;
  } finally {
    setCurrentOwner(prevOwner);
    lazyParent = prevParent;
    lazyOwner = prevLazy;
  }
}

/** Runs `fn` with `owner` as the current owner. Tracking is left unchanged. */
export function runWithOwner<T>(owner: Owner | undefined, fn: () => T): T {
  const prev = setCurrentOwner(owner);
  try {
    return fn();
  } finally {
    setCurrentOwner(prev);
  }
}

// --- Cleanup -----------------------------------------------------------------

export function addCleanup(owner: Owner, fn: Cleanup): void {
  const cleanups = owner.cleanups;
  if (cleanups === undefined) {
    owner.cleanups = fn;
  } else if (typeof cleanups === "function") {
    owner.cleanups = [cleanups, fn];
  } else {
    cleanups.push(fn);
  }
}

/** Registers `fn` on the current owner. Under a disposed owner it runs at once; with no owner it is dropped. */
export function onCleanup(fn: Cleanup): void {
  const owner = getOwner();
  if (owner === undefined) {
    return;
  }
  if (owner.state & DISPOSED) {
    fn();
  } else {
    addCleanup(owner, fn);
  }
}

let cleanupError: { error: unknown } | undefined;

function runCleanup(fn: Cleanup): void {
  try {
    fn();
  } catch (error) {
    cleanupError ??= { error };
  }
}

function throwCleanupError(): void {
  const failure = cleanupError;
  if (failure !== undefined) {
    cleanupError = undefined;
    throw failure.error;
  }
}

/**
 * Ends the owner's current scope: aborts its lifetime, disposes its children
 * newest-first, then runs its own cleanups in reverse registration order.
 */
function resetScope(owner: Owner, disposing: boolean): void {
  const controller = owner.lifetime;
  if (controller !== undefined) {
    // A disposed owner keeps its aborted controller; a reset one gets a fresh one on demand.
    if (!disposing) {
      owner.lifetime = undefined;
    }
    controller.abort();
  }
  let child = owner.firstChild;
  owner.firstChild = undefined;
  while (child !== undefined) {
    const next: Owner | undefined = child.nextSibling;
    child.prevSibling = child.nextSibling = undefined;
    destroy(child);
    child = next;
  }
  const cleanups = owner.cleanups;
  if (cleanups !== undefined) {
    owner.cleanups = undefined;
    if (typeof cleanups === "function") {
      runCleanup(cleanups);
    } else {
      for (let i = cleanups.length - 1; i >= 0; i--) {
        runCleanup(cleanups[i]!);
      }
    }
  }
}

function destroy(owner: Owner): void {
  if (owner.state & DISPOSED) {
    return;
  }
  owner.state |= DISPOSED;
  if (owner.state & SUBSCRIBER) {
    const node = owner as Owner & ReactiveNode;
    node.flags = 0;
    releaseDeps(node);
  }
  resetScope(owner, true);
}

function detach(owner: Owner): void {
  const parent = owner.parent;
  if (parent === undefined) {
    return;
  }
  const prev = owner.prevSibling;
  const next = owner.nextSibling;
  if (prev !== undefined) {
    prev.nextSibling = next;
  } else if (parent.firstChild === owner) {
    parent.firstChild = next;
  }
  if (next !== undefined) {
    next.prevSibling = prev;
  }
  owner.prevSibling = owner.nextSibling = undefined;
}

/**
 * Disposes `owner` and its subtree. Every cleanup runs even if one throws; the
 * first error is rethrown afterwards.
 */
export function disposeOwner(owner: Owner): void {
  if (owner.state & DISPOSED) {
    return;
  }
  detach(owner);
  const prevSub = setActiveSub(undefined);
  try {
    destroy(owner);
  } finally {
    setActiveSub(prevSub);
  }
  throwCleanupError();
}

/** Disposes the owner's children and runs its cleanups, keeping the owner alive (effect re-runs). */
export function resetOwner(owner: Owner): void {
  const prevSub = setActiveSub(undefined);
  try {
    resetScope(owner, false);
  } finally {
    setActiveSub(prevSub);
  }
  throwCleanupError();
}

// --- Lifetime ----------------------------------------------------------------

/**
 * An `AbortSignal` for the current owner: aborted when the owner is disposed,
 * when an effect re-runs, or when an async run is superseded.
 */
export function lifetime(): AbortSignal {
  const owner = getOwner();
  if (owner === undefined) {
    throw new Error("lifetime() must be called inside a component, an effect or another owner.");
  }
  return lifetimeOf(owner);
}

export function lifetimeOf(owner: Owner): AbortSignal {
  let controller = owner.lifetime;
  if (controller === undefined) {
    controller = owner.lifetime = new AbortController();
    if (owner.state & (DISPOSED | STALE)) {
      controller.abort();
    }
  }
  return controller.signal;
}

/** Aborts the owner's lifetime without disposing it (a superseded async run). */
export function abortLifetime(owner: Owner): void {
  owner.state |= STALE;
  owner.lifetime?.abort();
}

// --- Context -----------------------------------------------------------------

export function provideContext(key: symbol, value: unknown): void {
  const owner = getOwner();
  if (owner === undefined) {
    throw new Error("provide() must be called inside a component or another owner.");
  }
  (owner.context ??= {})[key] = value;
}

export function lookupContext(owner: Owner | undefined, key: symbol, fallback: unknown): unknown {
  for (; owner !== undefined; owner = owner.parent) {
    const context = owner.context;
    if (context !== undefined && key in context) {
      return context[key];
    }
  }
  return fallback;
}

export function injectContext(key: symbol, fallback: unknown): unknown {
  return lookupContext(lookupOwner(), key, fallback);
}

// --- Errors ------------------------------------------------------------------

const ERROR_HANDLER = Symbol("lumen.error");

/** Handles errors thrown by effects and runs in the current owner's subtree (error boundaries). */
export function onError(handler: (error: unknown) => void): void {
  provideContext(ERROR_HANDLER, handler);
}

/** Routes `error` to the nearest handler above `owner`; rethrows it when there is none. */
export function handleError(owner: Owner | undefined, error: unknown): void {
  const handler = lookupContext(owner, ERROR_HANDLER, undefined) as
    | ((error: unknown) => void)
    | undefined;
  if (handler === undefined) {
    throw error;
  }
  handler(error);
}
