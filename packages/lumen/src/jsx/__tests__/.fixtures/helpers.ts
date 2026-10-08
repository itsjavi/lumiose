// Shared setup for the JSX type tests. Loads `lumen/env` (global JSX, import.meta.env, Locals) and
// declares stand-ins for reactive APIs (spec §4.3); only their types matter, nothing here runs.
import "lumen/env";

export interface Signal<T> {
  (): T;
  set(value: T): void;
  update(fn: (value: T) => T): void;
  peek(): T;
}

export declare function signal<T>(value: T): Signal<T>;

/** `ref<T>()`: a ref callback that can also be read like a signal. */
export declare function ref<T extends Element>(): ((element: T) => void) & (() => T | undefined);
