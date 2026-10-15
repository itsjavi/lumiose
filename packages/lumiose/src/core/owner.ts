// Owners scope cleanup, context, lifetimes, error handlers and async runs (spec §6.1).
// Effects and runs are owners too; they also carry graph links, released on disposal.
import { currentOwner, releaseDeps, setActiveSub, setCurrentOwner } from "./reactive.ts";
import type { ReactiveNode } from "./system.ts";
// Dev-only error detail; production builds drop it.
import { DEV, INSPECTED } from "../dom/dev.ts";
import { inspectOwners, ownerCreated } from "../dom/devtools.ts";

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
/** `useContext()` does not look past this owner (see `isolateOwner`). */
export const ISOLATED = 8;

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
  if (INSPECTED) ownerCreated(owner, parent);
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
// an effect, a provided value or a lifetime), so static list rows and
// components allocate none.
//
// Pending lazy owners form a stack of frames (one per `runWithLazyOwner` call in
// progress). `currentOwner === LAZY` stands for the innermost frame. A frame's
// parent may itself be `LAZY` (a component inside a lazy row): materializing it
// materializes the frames below it first, so nesting stays allocation-free
// until something registers.

const LAZY: Owner = /* @__PURE__ */ createOwner(undefined);
const lazyParents: (Owner | undefined)[] = [];
const lazyOwners: (Owner | undefined)[] = [];
let lazyDepth = -1;

function materialize(depth: number): Owner {
  let owner = lazyOwners[depth];
  if (owner === undefined) {
    const parent = lazyParents[depth];
    owner = lazyOwners[depth] = createOwner(parent === LAZY ? materialize(depth - 1) : parent);
  }
  return owner;
}

/** The current owner, materializing a pending lazy owner. */
export function getOwner(): Owner | undefined {
  const owner = currentOwner;
  if (owner !== LAZY) {
    return owner;
  }
  const materialized = materialize(lazyDepth);
  setCurrentOwner(materialized);
  return materialized;
}

/** The owner to resolve context from, without materializing a lazy owner. */
function lookupOwner(): Owner | undefined {
  if (currentOwner !== LAZY) {
    return currentOwner;
  }
  let depth = lazyDepth;
  while (lazyOwners[depth] === undefined && lazyParents[depth] === LAZY) {
    depth--;
  }
  return lazyOwners[depth] ?? lazyParents[depth];
}

/**
 * Runs `fn` under a lazy child of `parent`. Returns the child if something
 * registered on it, otherwise `undefined` (nothing to dispose). `parent` may be
 * the raw current owner (`currentOwner`), even while it is itself lazy.
 */
export function runWithLazyOwner(parent: Owner | undefined, fn: () => void): Owner | undefined {
  const depth = ++lazyDepth;
  lazyParents[depth] = parent;
  lazyOwners[depth] = undefined;
  const prevOwner = setCurrentOwner(LAZY);
  try {
    fn();
    return lazyOwners[depth];
  } finally {
    setCurrentOwner(prevOwner);
    lazyParents[depth] = lazyOwners[depth] = undefined;
    lazyDepth = depth - 1;
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
export function getAbortSignal(): AbortSignal {
  const owner = getOwner();
  // Production builds drop the check: without an owner, `lifetimeOf` throws a TypeError.
  if (DEV && owner === undefined) {
    throw new Error(
      "getAbortSignal() must be called inside a component, an effect or another owner.",
    );
  }
  return lifetimeOf(owner!);
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

/** Provides `value` on the current owner. Callers (providers, boundaries, the router) always run under one. */
export function provideContext(key: symbol, value: unknown): void {
  const owner = getOwner()!;
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

export function readContext(key: symbol, fallback: unknown): unknown {
  return lookupContext(lookupOwner(), key, fallback);
}

// An island rendered on the server runs under an isolated owner: the browser hydrates it as its
// own root, so `useContext()` must not see user context provided above it there either (TASK-194).
// Internal lookups (`readContext`, `lookupContext`) pass isolated owners.
const MISSING = Symbol();
let pageContextHandlers: WeakMap<Owner, (key: symbol) => void> | undefined;

/**
 * Makes `owner` a root for `useContext()`. In dev, `onPageContext` is called when `useContext()` stops
 * at `owner` although an owner above it provides the context.
 */
export function isolateOwner(owner: Owner, onPageContext?: (key: symbol) => void): void {
  owner.state |= ISOLATED;
  if (DEV && onPageContext !== undefined) {
    (pageContextHandlers ??= new WeakMap()).set(owner, onPageContext);
  }
}

/** `useContext()`: the nearest provided value up to an isolated owner, or `fallback`. */
export function readUserContext(key: symbol, fallback: unknown): unknown {
  for (let owner = lookupOwner(); owner !== undefined; owner = owner.parent) {
    const context = owner.context;
    if (context !== undefined && key in context) {
      return context[key];
    }
    if (owner.state & ISOLATED) {
      if (DEV && lookupContext(owner.parent, key, MISSING) !== MISSING) {
        pageContextHandlers?.get(owner)?.(key);
      }
      return fallback;
    }
  }
  return fallback;
}

// --- Errors ------------------------------------------------------------------

const ERROR_HANDLER = Symbol();

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

// The in-page inspector's registry (./devtools.ts) reaches owners through these.
if (INSPECTED) {
  inspectOwners({
    lookup: lookupOwner,
    create: createOwner,
    dispose: disposeOwner,
    run: runWithOwner,
    setActiveSub,
  });
}
