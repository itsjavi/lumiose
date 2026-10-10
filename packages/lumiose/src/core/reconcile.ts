// The diff behind `reconcile()` (doc-6 §C), shared by the browser (./store.ts, which runs it
// batched and untracked through store proxies, so each write notifies only on change) and the
// server (./server.ts, where stores are plain objects). Solid's `reconcile` semantics.

import { DEV } from "../dom/dev.ts";

type Plain = Record<PropertyKey, unknown>;

export interface ReconcileOptions {
  /** Property that identifies array items across updates. Default `"id"`. */
  key?: string;
}

/** A plain object or array that is not frozen or sealed: what `store()` wraps. */
export function isPlain(value: unknown): value is Plain {
  if (value === null || typeof value !== "object" || !Object.isExtensible(value)) {
    return false;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  return Array.isArray(value) || proto === Object.prototype || proto === null;
}

/**
 * Writes `next` into `prev` in place. `prev` is a store proxy (or a plain object on the server),
 * `next` plain data of the same kind. `raw` unwraps a store proxy, to match items by reference.
 */
function patch(prev: Plain, next: Plain, key: string, raw: (v: unknown) => unknown): void {
  const isArray = Array.isArray(next);
  // Array items by raw reference and by key.
  const found = new Map<unknown, Plain>();
  if (isArray) {
    for (const item of prev as unknown as unknown[]) {
      if (isPlain(item)) {
        found.set(raw(item), item).set(item[key], item);
      }
    }
  }
  for (const k of Object.keys(next)) {
    const value = next[k];
    let result = value;
    if (isPlain(value)) {
      const id = value[key];
      const old = prev[k];
      // An item without a key merges into the old item at the same index, if it has none either.
      const match = isArray
        ? (found.get(raw(value)) ?? (id === undefined ? old : found.get(id)))
        : old;
      // Objects with different keys are different entities: replace, as Solid.
      if (isPlain(match) && Array.isArray(match) === Array.isArray(value) && match[key] === id) {
        patch(match, value, key, raw);
        result = match;
      }
    }
    prev[k] = result;
  }
  if (isArray) {
    prev.length = next.length;
  } else {
    for (const k of Object.keys(prev)) {
      if (!Object.hasOwn(next, k)) {
        delete prev[k];
      }
    }
  }
}

/** Checks `reconcile()`'s arguments (in development) and runs the diff. */
export function reconcileInto(
  target: object,
  data: unknown,
  options: ReconcileOptions | undefined,
  raw: (v: unknown) => unknown,
): void {
  // Development only, to keep the runtime small: a mismatch would mix keys and indices.
  if (
    DEV &&
    (!isPlain(target) || !isPlain(data) || Array.isArray(target) !== Array.isArray(data))
  ) {
    throw new TypeError(
      "reconcile(target, data): both must be arrays or both plain objects, and target a store or a part of one",
    );
  }
  patch(target as Plain, data as Plain, options?.key ?? "id", raw);
}
