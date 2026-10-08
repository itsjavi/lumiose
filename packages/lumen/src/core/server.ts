// Server variant of the public reactive API (spec §5.3, §6.4): the same names as ./index.ts,
// with no reactive graph. Signals are plain cells, computeds run once, effects never run.
// Owners still scope context and cleanups; the server runtime creates one root owner per
// request, and disposes (or aborts) it when the request ends.
import type { Resource } from "./async.ts";
import type { EffectFn } from "./effect.ts";
import { getOwner, lifetimeOf, type Owner } from "./owner.ts";
import { copyPlain } from "./snapshot.ts";
import type { Computed, Signal, SignalOptions } from "./signal.ts";

export type { Computed, Signal, SignalOptions } from "./signal.ts";
export type { EffectFn } from "./effect.ts";
export type { Resource } from "./async.ts";
export type { Context } from "./context.ts";
export { createContext, provide, inject } from "./context.ts";
export { onCleanup } from "./owner.ts";

interface Cell<T> extends Signal<T> {
  value: T;
}

function set<T>(this: Cell<T>, value: T): void {
  this.value = value;
}

function update<T>(this: Cell<T>, fn: (value: T) => T): void {
  this.value = fn(this.value);
}

function peek<T>(this: Cell<T>): T {
  return this.value;
}

export function signal<T>(value: T, _options?: SignalOptions<T>): Signal<T> {
  const cell = (() => cell.value) as Cell<T>;
  cell.value = value;
  cell.set = set;
  cell.update = update;
  cell.peek = peek;
  return cell;
}

/** Evaluates `fn` on the first read and caches the result for the rest of the request. */
export function computed<T>(
  fn: (previous: T | undefined) => T,
  _options?: SignalOptions<T>,
): Computed<T> {
  let done = false;
  let value: T;
  return () => {
    if (!done) {
      value = fn(undefined);
      done = true;
    }
    return value;
  };
}

const noop = (): void => {};

export function effect(_fn: EffectFn): () => void {
  return noop;
}

export function onMount(_fn: EffectFn): void {}

export function store<T extends object>(value: T): T {
  return value;
}

/** Server `snapshot()`: stores are the plain objects themselves, so this is a deep plain copy. */
export function snapshot<T>(value: T): T {
  return copyPlain(value, (raw) => raw);
}

export function untrack<T>(fn: () => T): T {
  return fn();
}

export function batch<T>(fn: () => T): T {
  return fn();
}

export function flushSync(): void {}

/** Nothing is in flight during a server render that the page could show. */
export function busy(): boolean {
  return false;
}

/** Async components render once per request on the server: no re-run is ever in flight. */
export function pending(): boolean {
  return false;
}

/** On the server a resource stays in its initial loading state; `fetcher` runs in the browser only. */
export function resource<T>(_fetcher: (signal: AbortSignal) => T | PromiseLike<T>): Resource<T> {
  const read = (() => undefined) as Resource<T>;
  read.loading = () => true;
  read.error = noop;
  read.refetch = noop;
  return read;
}

/** The request's signal: the lifetime of the request's root owner. */
export function lifetime(): AbortSignal {
  let owner: Owner | undefined = getOwner();
  if (owner === undefined) {
    throw new Error("lifetime() must be called during a server render.");
  }
  while (owner.parent !== undefined) {
    owner = owner.parent;
  }
  return lifetimeOf(owner);
}
