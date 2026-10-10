// Scoped state (doc-6 §A, decision-33): `defineState(factory)` returns an accessor whose factory
// runs on first use, once per scope. This is the browser variant: one instance per page, shared
// by every island and the SPA tree. The server variant (../server/state.ts) keeps one instance
// per request and sends the values to the page; the hydration path (../dom/state.ts) writes them
// into the new instance through `setStateRestore`, before any island reads it.
import { runWithOwner } from "./owner.ts";
import { untrack } from "./reactive.ts";

/** Bumped by `resetStates()`: instances created under an older generation are stale. */
export let generation = 0;

let restore: ((read: () => unknown, value: unknown) => void) | undefined;

/**
 * Defines state shared by everything in its scope: the factory runs on the first call of the
 * accessor, once per page in the browser and once per request on the server. It runs outside the
 * component tree (no context, untracked), so effects it creates live as long as the page.
 */
export function defineState<T>(factory: () => T): () => T {
  let made: number | undefined;
  let value: T;
  const read = (): T => {
    if (made !== generation) {
      value = runWithOwner(undefined, () => untrack(factory));
      made = generation;
      restore?.(read, value);
    }
    return value;
  };
  return read;
}

/** Internal: drops every instance, so each accessor runs its factory again (fresh per test). */
export function resetStates(): void {
  generation++;
}

/** Internal: the hydration path's hook, called with each new instance before it is returned. */
export function setStateRestore(fn: (read: () => unknown, value: unknown) => void): void {
  restore = fn;
}
