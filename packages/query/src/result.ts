// Writes query-core observer results into a result store (doc-6 §E). `data` goes through
// `reconcile()`: unchanged parts keep their identity and only changed fields notify, which is
// TanStack's structural sharing done by the store.
import { batch, reconcile, snapshot, untrack } from "lumiose";
import type { ReconcileOption } from "./types.ts";

type Plain = Record<string, unknown>;

function isPlain(value: unknown): value is Plain {
  if (value === null || typeof value !== "object") return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return Array.isArray(value) || proto === Object.prototype || proto === null;
}

/**
 * The plain copy a result store starts from. `data` is copied: a store writes into the object it
 * wraps, and the cache's object is shared by every observer of the query.
 */
export function initialResult<T extends object>(result: T, option: ReconcileOption<any> = "id"): T {
  const copy: Plain = { ...(result as Plain) };
  if (option !== false && isPlain(copy.data)) copy.data = snapshot(copy.data);
  return copy as T;
}

function writeData(state: Plain, next: unknown, option: ReconcileOption<unknown>): void {
  if (option === false) {
    state.data = next;
  } else if (typeof option === "function") {
    state.data = option(state.data, next);
  } else {
    const prev = state.data;
    if (isPlain(next) && isPlain(prev) && Array.isArray(next) === Array.isArray(prev)) {
      reconcile(prev, snapshot(next), { key: option });
    } else {
      state.data = isPlain(next) ? snapshot(next) : next;
    }
  }
}

/** Writes `result` into `state` in one batch: only fields that changed notify. */
export function writeResult(
  state: object,
  result: object,
  option: ReconcileOption<any> = "id",
): void {
  batch(() =>
    untrack(() => {
      for (const [key, value] of Object.entries(result)) {
        if (key === "data") writeData(state as Plain, value, option);
        else (state as Plain)[key] = value;
      }
    }),
  );
}
