// `store(obj)`: a deep reactive proxy that you mutate directly (spec §4.3).
//
// Plain objects and arrays are wrapped lazily, one proxy per raw object. Each
// property gets a trigger node on its first tracked read; writes fire the node
// only when the value changed. Adding or deleting keys (and array length
// changes) also fires a per-object KEYS node, which `ownKeys` tracks.
import { INSPECTED } from "../dom/dev.ts";
import { storeKey } from "../dom/devtools.ts";
import { batch } from "./effect.ts";
import {
  activeSub,
  createTrigger,
  setActiveSub,
  track,
  trigger,
  untrack,
  type TriggerNode,
} from "./reactive.ts";
import { isPlain, reconcileInto, type ReconcileOptions } from "./reconcile.ts";
import { copyPlain } from "./snapshot.ts";

type Key = string | symbol;

const KEYS: unique symbol = Symbol();
const proxies = new WeakMap<object, object>();
const raws = new WeakMap<object, object>();
const nodeMaps = new WeakMap<object, Record<Key, TriggerNode>>();

function isWrappable(value: unknown): value is object {
  return isPlain(value) && !raws.has(value);
}

function wrap<T extends object>(target: T): T {
  let proxy = proxies.get(target);
  if (proxy === undefined) {
    proxy = new Proxy(target as Record<Key, unknown>, handler);
    proxies.set(target, proxy);
    raws.set(proxy, target);
  }
  return proxy as T;
}

function toRaw<T>(value: T): T {
  return (
    (typeof value === "object" && value !== null
      ? (raws.get(value) as T | undefined)
      : undefined) ?? value
  );
}

function trackKey(target: object, key: Key): void {
  let nodes = nodeMaps.get(target);
  if (nodes === undefined) {
    nodeMaps.set(target, (nodes = Object.create(null) as Record<Key, TriggerNode>));
  }
  track((nodes[key] ??= createTrigger()));
  if (INSPECTED) storeKey(nodes[key]!, key);
}

function fire(target: object, key: Key): void {
  const node = nodeMaps.get(target)?.[key];
  if (node !== undefined) {
    trigger(node);
  }
}

function isIndex(key: Key): key is string {
  if (typeof key !== "string") {
    return false;
  }
  const n = Number(key);
  return Number.isInteger(n) && n >= 0 && String(n) === key;
}

/** Fires the nodes of indices removed by shrinking an array. */
function fireRemovedIndices(target: object, length: number): void {
  const nodes = nodeMaps.get(target);
  if (nodes === undefined) {
    return;
  }
  for (const key in nodes) {
    if (isIndex(key) && Number(key) >= length) {
      trigger(nodes[key]!);
    }
  }
}

// Array mutators run untracked: `push` reads `length`, and an effect that
// pushes must not subscribe to what it writes.
const arrayMutators: Record<Key, (this: unknown[], ...args: unknown[]) => unknown> =
  Object.create(null);
for (const name of [
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin",
] as const) {
  const method = Array.prototype[name] as (...args: unknown[]) => unknown;
  arrayMutators[name] = function (this: unknown[], ...args: unknown[]): unknown {
    const prev = setActiveSub(undefined);
    try {
      return method.apply(this, args);
    } finally {
      setActiveSub(prev);
    }
  };
}

const handler: ProxyHandler<Record<Key, unknown>> = {
  get(target, key, receiver) {
    if (typeof key === "symbol") {
      return Reflect.get(target, key, receiver);
    }
    if (Array.isArray(target)) {
      const mutator = arrayMutators[key];
      if (mutator !== undefined) {
        return mutator;
      }
    }
    if (activeSub !== undefined) {
      trackKey(target, key);
    }
    const value: unknown = Reflect.get(target, key, receiver);
    return isWrappable(value) ? wrap(value) : value;
  },

  set(target, key, value, receiver) {
    const raw: unknown = toRaw(value);
    if (typeof key === "symbol") {
      return Reflect.set(target, key, raw, receiver);
    }
    const isArray = Array.isArray(target);
    const oldLength = isArray ? (target as unknown[]).length : 0;
    const hadKey = isArray && isIndex(key) ? Number(key) < oldLength : Object.hasOwn(target, key);
    const old = target[key];
    if (!Reflect.set(target, key, raw, receiver)) {
      return false;
    }
    if (!hadKey) {
      fire(target, key);
      fire(target, KEYS);
    } else if (!Object.is(old, raw)) {
      fire(target, key);
    }
    if (isArray) {
      const length = (target as unknown[]).length;
      if (length !== oldLength) {
        if (key !== "length") {
          fire(target, "length");
        } else if (length < oldLength) {
          fireRemovedIndices(target, length);
        }
        fire(target, KEYS);
      }
    }
    return true;
  },

  deleteProperty(target, key) {
    const hadKey = Object.hasOwn(target, key);
    const deleted = Reflect.deleteProperty(target, key);
    if (deleted && hadKey && typeof key !== "symbol") {
      fire(target, key);
      fire(target, KEYS);
    }
    return deleted;
  },

  has(target, key) {
    if (activeSub !== undefined && typeof key !== "symbol") {
      trackKey(target, key);
    }
    return Reflect.has(target, key);
  },

  ownKeys(target) {
    if (activeSub !== undefined) {
      trackKey(target, KEYS);
    }
    return Reflect.ownKeys(target);
  },
};

/**
 * Wraps a plain object or array in a deep reactive proxy. Reads track per
 * property, writes notify only on change. Other values (class instances, Maps,
 * frozen objects) are returned as is.
 */
export function store<T extends object>(value: T): T {
  return isWrappable(value) ? wrap(value) : value;
}

/**
 * A deep plain copy of a store (or of any value inside one, or of plain data holding stores):
 * plain objects and arrays are copied, so the result works with `structuredClone()`,
 * `postMessage()` and `JSON.stringify()`, and later writes to the store do not change it. Reads
 * are not tracked. Other values (Dates, Maps, class instances) are kept as they are.
 */
export function snapshot<T>(value: T): T {
  return copyPlain(value, toRaw);
}

/**
 * Patches fresh `data` into a store (or into an object or array inside one) in place, as Solid's
 * `reconcile`: array items are matched by reference or by `options.key` (default `"id"`), and
 * items without the key by index; matched objects are merged deeply, keys missing from `data` are
 * deleted, and other values are replaced. Unchanged items keep their identity, and only changed
 * properties notify, in one batch. Reads are not tracked.
 */
export function reconcile<T extends object>(target: T, data: T, options?: ReconcileOptions): void {
  batch(() => untrack(() => reconcileInto(target, data, options, toRaw)));
}
