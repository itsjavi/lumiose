// Scoped state on the server (doc-6 §A, decision-33). `defineState()` keeps one instance per
// request: the request handler runs each request in a state scope (`runInRequestScope`), and a
// render outside a request (`renderToString` in a test or a script) gets one of its own. The
// factory reads request APIs (`locals()`, `cookies()`, …) directly; there is no seed API.
//
// The renderer sends the states a page needs (`encodeStates`, called by ./render.ts at each
// flush): those created so far that the Vite plugin gave an id (`$$id`, `<module>#<export>`),
// which it does only for states that client code (islands, SPA routes) can reach. What is sent is
// what the factory returned that the browser cannot rebuild: the signal or store itself, or the
// top-level signals and stores of the returned object. Computeds are derived again and functions
// rebuilt when the factory runs in the browser (../dom/state.ts).

import { AsyncLocalStorage } from "node:async_hooks";
import { LUM_STATE_VALUE, LumioseError } from "../app/diagnostics.ts";
import { runWithOwner } from "../core/owner.ts";
import { generation } from "../core/state.ts";
import { currentFrame, type StateAccessor, type StateScope } from "./frame.ts";
import { encodeData } from "./serialize.ts";

export type { StateAccessor, StateScope };

const storage = new AsyncLocalStorage<StateScope>();

export function createStateScope(): StateScope {
  return { values: new Map() };
}

export function runInStateScope<T>(scope: StateScope, fn: () => T): T {
  return storage.run(scope, fn);
}

// Tests: once `resetStates()` ran (the Vitest setup of @lumiose/vite calls it before each test),
// code outside a request or render shares one scope per test instead of throwing.
let testScope: StateScope | undefined;
let testGeneration = 0;

/** The current request's or render's scope; in tests, the current test's. */
export function currentStateScope(): StateScope | undefined {
  const scope = storage.getStore();
  if (scope !== undefined || generation === 0) return scope;
  if (testGeneration !== generation) {
    testGeneration = generation;
    testScope = createStateScope();
  }
  return testScope;
}

/** Server `defineState()`: the factory runs once per request, under the render's root owner. */
export function defineState<T>(factory: () => T): () => T {
  const read = (): T => {
    const scope = currentStateScope();
    if (scope === undefined) {
      throw new Error(
        "A defineState() accessor was called outside a request. On the server, scoped state lives as long as one request: call it in components, middleware, endpoints or actions, not at module scope.",
      );
    }
    const { values } = scope;
    if (values.has(read)) return values.get(read) as T;
    const value = runWithOwner(currentFrame()?.render.owner, factory);
    values.set(read, value);
    return value;
  };
  return read;
}

/** Server stores are the plain objects themselves (../core/server.ts): marked so they can be sent. */
export const serverStores = new WeakSet<object>();

const NONE = Symbol();

/** What is sent of one member: a signal's value, a store's object, or NONE. */
function sentValue(value: unknown): unknown {
  if (typeof value === "function") {
    const signal = value as { set?: unknown; peek?: () => unknown };
    return typeof signal.set === "function" && typeof signal.peek === "function"
      ? signal.peek()
      : NONE;
  }
  return typeof value === "object" && value !== null && serverStores.has(value) ? value : NONE;
}

/** The sent members of an instance: `{ "": value }` for a signal or store, else its top-level ones. */
function members(instance: unknown): Record<string, unknown> | undefined {
  const own = sentValue(instance);
  if (own !== NONE) return { "": own };
  if (typeof instance !== "object" || instance === null) return undefined;
  let out: Record<string, unknown> | undefined;
  for (const key of Object.keys(instance)) {
    const value = sentValue((instance as Record<string, unknown>)[key]);
    if (value !== NONE) (out ??= {})[key] = value;
  }
  return out;
}

/**
 * Encodes the states of `scope` that are not in `sent` yet (and adds them to it), keyed by id:
 * the payload's `s` record. States without an id, or that `isClient` rejects, are never sent.
 * Throws LUM4011 when a sent value is not plain data.
 */
export function encodeStates(
  scope: StateScope,
  sent: Set<StateAccessor>,
  isClient: ((ref: string) => boolean) | undefined,
): Record<string, unknown> | undefined {
  let out: Record<string, unknown> | undefined;
  for (const [read, instance] of scope.values) {
    if (sent.has(read)) continue;
    sent.add(read);
    const ref = read.$$id;
    if (ref === undefined || (isClient !== undefined && !isClient(ref))) continue;
    const data = members(instance);
    if (data === undefined) continue;
    (out ??= {})[ref] = encodeData(data, (path, reason) => {
      const at = path.startsWith('[""]') ? path.slice(4) : path;
      const what = at === "" ? "The value" : `Value "${at.replace(/^\./, "")}"`;
      throw new LumioseError(
        LUM_STATE_VALUE,
        `${what} of the scoped state ${ref.slice(ref.lastIndexOf("#") + 1)} (${ref}) is ${reason}. Islands use this state, so its signals and stores are sent to the browser and must hold plain data: strings, numbers, booleans, null, arrays, plain objects, Date, Map, Set, BigInt or URL. Keep other values in a computed or a function the factory returns, or in server-only state that no island imports`,
      );
    });
  }
  return out;
}
