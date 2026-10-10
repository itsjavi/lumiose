// Public signal and computed wrappers (spec §4.3).
import {
  createComputedNode,
  createSignalNode,
  peekSignal,
  readComputed,
  readSignal,
  writeSignal,
  type Equals,
  type SignalNode,
} from "./reactive.ts";

export interface Signal<T> {
  (): T;
  set(value: T): void;
  update(fn: (value: T) => T): void;
  /** Reads without tracking. */
  peek(): T;
}

export type Computed<T> = () => T;

export interface SignalOptions<T> {
  /** When a write counts as a change. Defaults to `Object.is`; `false` makes every write a change. */
  equals?: false | Equals<T>;
}

/** Where a signal function keeps its node. */
export const SIGNAL_NODE: unique symbol = Symbol("lumiose.signal");

interface SignalFn<T> extends Signal<T> {
  [SIGNAL_NODE]: SignalNode<T>;
}

const never = (): boolean => false;

function equalsOf<T>(options: SignalOptions<T> | undefined): Equals<T> {
  const equals = options?.equals;
  return equals === undefined ? Object.is : equals === false ? never : equals;
}

// Shared methods (one copy for all signals); `this` is the signal function.
function set<T>(this: SignalFn<T>, value: T): void {
  writeSignal(this[SIGNAL_NODE], value);
}

function update<T>(this: SignalFn<T>, fn: (value: T) => T): void {
  const node = this[SIGNAL_NODE];
  writeSignal(node, fn(node.pendingValue));
}

function peek<T>(this: SignalFn<T>): T {
  return peekSignal(this[SIGNAL_NODE]);
}

export function signal<T>(value: T, options?: SignalOptions<T>): Signal<T> {
  const node = createSignalNode(value, equalsOf(options));
  const s = (() => readSignal(node)) as SignalFn<T>;
  s[SIGNAL_NODE] = node;
  s.set = set;
  s.update = update;
  s.peek = peek;
  return s;
}

/** A lazy, cached, glitch-free derived value. `fn` receives the previous value and must be pure. */
export function computed<T>(
  fn: (previous: T | undefined) => T,
  options?: SignalOptions<T>,
): Computed<T> {
  const node = createComputedNode(fn, equalsOf(options));
  return () => readComputed(node);
}
