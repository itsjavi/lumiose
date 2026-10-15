// Optimistic values (TASK-196, doc-6 §D, decision-35): a source plus overlays, each held while its
// promise is pending. After React's useOptimistic and Solid 2's createOptimistic.
import { onCleanup } from "./owner.ts";
import { computed, signal } from "./signal.ts";
import { INSPECTED } from "../dom/dev.ts";
import { labelValue } from "../dom/devtools.ts";

export interface Optimistic<T> {
  /** The source with the pending overlays applied, in order. Reactive. */
  (): T;
  /** Shows `value` until `promise` settles. */
  set(value: T, promise: PromiseLike<unknown>): void;
  /** Shows `fn` applied to the current value until `promise` settles; re-applied when the source changes. */
  update(fn: (value: T) => T, promise: PromiseLike<unknown>): void;
}

/**
 * A value that follows `source` (a getter or a signal), with overlays shown while their promises are
 * pending: `likes.update((n) => n + 1, submit(event))`. When a promise settles its overlay drops,
 * so the (refreshed) source shows on success and the value rolls back on failure. The promise's
 * rejection is not re-thrown: await the promise itself to handle it.
 */
export function optimistic<T>(source: () => T): Optimistic<T> {
  const overlays = signal<readonly ((value: T) => T)[]>([]);
  let live = true;
  onCleanup(() => (live = false));
  const read = computed(() =>
    overlays().reduce((value, overlay) => overlay(value), source()),
  ) as Optimistic<T>;
  if (import.meta.env?.DEV && INSPECTED) {
    labelValue(overlays, "optimistic updates", true);
    labelValue(read, "optimistic value", true);
  }
  read.update = (fn, promise) => {
    if (!live) return;
    // A fresh function per call, so the same `fn` passed twice drops one entry at a time.
    const overlay = (value: T) => fn(value);
    overlays.update((list) => [...list, overlay]);
    const drop = () => {
      if (live) overlays.update((list) => list.filter((entry) => entry !== overlay));
    };
    promise.then(drop, drop);
  };
  read.set = (value, promise) => read.update(() => value, promise);
  return read;
}
