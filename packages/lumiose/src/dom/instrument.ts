// Client instrumentation (decision-49, TASK-299; owner: Spark): `onError` and `instrumentations`
// exported by `src/instrumentation.client.ts`. The client entry hands its exports to
// `setClientInstrumentation()` before any island hydrates or the SPA router starts
// (../app/client-entry.ts).
//
// Every call site is guarded by `INSTRUMENTED`, a build-time constant that `lumiose dev` and
// `lumiose build` define only for apps with that file (`import.meta.env.LUMIOSE_CLIENT_HOOKS`):
// elsewhere the bundler drops the guarded code and, with it, this module. Wrappers follow the
// server's observer rules (../app/server/instrumentation.ts): `call()` runs the phase once and
// never throws, a wrapper cannot change what the phase does, and what a wrapper or `onError`
// throws is logged without affecting the app.
import { lookupContext, type Owner } from "../core/owner.ts";
import { currentRoute } from "../app/router/hooks.ts";
import type { NavigationTarget, NavigationType } from "../app/router/hooks.ts";
import type { Routes } from "../app/routes/registry.ts";
import { observe, type InstrumentationResult } from "../app/server/instrumentation.ts";

/** Whether this build instruments the client: the app has `src/instrumentation.client.ts`. */
// Truthy rather than `true`: Vitest reads `import.meta.env` from process.env, as strings.
export const INSTRUMENTED: boolean = !!(
  import.meta.env as { LUMIOSE_CLIENT_HOOKS?: boolean | string } | undefined
)?.LUMIOSE_CLIENT_HOOKS;

/** Where an error happened in the browser (`ClientErrorInfo.phase`). */
export type ClientErrorPhase = "hydrate" | "render" | "effect" | "navigate" | "submit";

/** What `onError(error, info)` of `src/instrumentation.client.ts` receives with each error. */
export interface ClientErrorInfo {
  /**
   * `"hydrate"`: loading an island's module or hydrating it; `"render"`: an async component of an
   * island, or an error an `<ErrorBoundary>` caught; `"effect"`: an effect or binding of an island
   * after it hydrated; `"navigate"`: the SPA router (a page that throws, a module that does not
   * load); `"submit"`: a `submit()` that rejects.
   */
  phase: ClientErrorPhase;
  /** The current SPA route pattern; undefined on MPA pages. */
  route: Routes | undefined;
  /** The island's ref (`/src/Counter.tsx#Counter`), for errors in an island. */
  island: string | undefined;
}

/**
 * A wrapper around one phase: call `call()` where the phase should run and await it to time the
 * phase. The phase runs even when a wrapper does not call it, and the wrapper cannot change its
 * arguments or result.
 */
type Wrapper<Info> = (call: () => Promise<InstrumentationResult>, info: Info) => unknown;

/** What every wrapper's `info` holds. */
interface PhaseInfo {
  /** The current SPA route pattern when the phase starts; undefined on MPA pages. */
  route: Routes | undefined;
}

/**
 * One observer of `instrumentations` in `src/instrumentation.client.ts`: optional wrappers per
 * phase. With several observers, the first wraps the outermost.
 */
export interface ClientInstrumentation {
  /** An SPA navigation, until its page is on screen (`lumiose/router`). */
  navigate?: Wrapper<
    PhaseInfo & {
      type: Exclude<NavigationType, "leave" | "enter">;
      from: NavigationTarget | null;
      to: NavigationTarget | null;
    }
  >;
  /** A `submit()`, or a `submission()`'s, to a form action (`action`: its name). */
  submit?: Wrapper<PhaseInfo & { action: string; url: string }>;
  /** A request of `fetchJSON()` (`url`), or a `query()` function (`key`); not cache hits. */
  fetch?: Wrapper<PhaseInfo & ({ url: string } | { key: readonly unknown[] })>;
  /** Each island: loading its module and hydrating it. */
  hydrate?: Wrapper<PhaseInfo & { island: string }>;
}

type Phase = keyof ClientInstrumentation;
type Hooks = { [P in Phase]: NonNullable<ClientInstrumentation[P]>[] } & {
  onError: ((error: unknown, info: ClientErrorInfo) => unknown) | undefined;
};

const FILE = "src/instrumentation.client.ts";
const PHASES: readonly Phase[] = ["navigate", "submit", "fetch", "hydrate"];

let hooks: Hooks | undefined;
/** The client entry, while it has not run: phases that start meanwhile wait for its hooks. */
let pending: Promise<unknown> | undefined;

/** The island refs by their start comment (`<!--l:ID-->`), for errors after they hydrated. */
export const islandRefs: WeakMap<Node, string> = new WeakMap();
/** Owner context: the ref of the island an owner belongs to. */
export const ISLAND: unique symbol = Symbol();
/** The last error an async component reported: `"render"`, not `"effect"`. */
let renderError: unknown;

function failed(what: string): (error: unknown) => void {
  return (error) => console.error(`Lumiose: ${what} in ${FILE} threw.`, error);
}

/**
 * The client entry is loading (../app/client-entry.ts): phases that start before it ran (the first
 * islands) wait for its exports, so they are observed too.
 */
export function awaitClientInstrumentation(entry: Promise<unknown>): void {
  pending = entry.then(setClientInstrumentation);
}

/**
 * Reads the exports of `src/instrumentation.client.ts` (none when it threw); malformed ones are
 * logged and skipped.
 */
export function setClientInstrumentation(exports: unknown): void {
  const { onError, instrumentations } = (exports ?? {}) as Record<string, unknown>;
  const next: Hooks = { navigate: [], submit: [], fetch: [], hydrate: [], onError: undefined };
  if (typeof onError === "function") next.onError = onError as Hooks["onError"];
  else if (onError !== undefined)
    console.error(`Lumiose: ${FILE}: export onError must be a function.`);
  if (Array.isArray(instrumentations)) {
    for (const observer of instrumentations as Record<string, unknown>[]) {
      for (const phase of PHASES) {
        const wrapper = observer?.[phase];
        if (typeof wrapper === "function") {
          (next[phase] as unknown[]).push((call: unknown, info: unknown) =>
            wrapper.call(observer, call, info),
          );
        } else if (wrapper !== undefined) {
          console.error(`Lumiose: ${FILE}: instrumentations[].${phase} must be a function.`);
        }
      }
    }
  } else if (instrumentations !== undefined) {
    console.error(`Lumiose: ${FILE}: export instrumentations must be an array of observers.`);
  }
  hooks = next;
}

/** Runs `work` inside the wrappers of `phase`, if any. */
export function instrument<P extends Phase, T>(
  phase: P,
  info: Omit<Parameters<NonNullable<ClientInstrumentation[P]>>[1], "route">,
  work: () => Promise<T>,
): Promise<T> {
  if (hooks === undefined && pending !== undefined) {
    return pending.then(() => instrument(phase, info, work));
  }
  const wrappers = hooks?.[phase];
  if (wrappers === undefined || wrappers.length === 0) return work();
  return observe(
    wrappers as Wrapper<unknown>[],
    { ...info, route: currentRoute() },
    work,
    failed("an instrumentations wrapper"),
  );
}

/**
 * Sends an error to `onError`, if exported. `island`: a ref, or an owner inside an island; `route`:
 * the route of the page that failed, when it is not the current one (an SPA page loading).
 */
export function notify(
  error: unknown,
  phase: ClientErrorPhase,
  island?: string | Owner,
  route: Routes | undefined = currentRoute(),
): void {
  const onError = hooks?.onError;
  if (onError === undefined) return;
  const ref =
    typeof island === "object" ? (lookupContext(island, ISLAND, undefined) as string) : island;
  const report = failed("onError()");
  try {
    const result = onError(error, { phase, route, island: ref });
    if (result instanceof Promise) result.catch(report);
  } catch (failure) {
    report(failure);
  }
}

/** An async component is about to report `error` (../dom/async.ts). */
export function markRender(error: unknown): void {
  renderError = error;
}

/** The phase of an error that reached an island's root after it hydrated. */
export function phaseOf(error: unknown): "render" | "effect" {
  return error === renderError ? "render" : "effect";
}

/** For tests: forgets the instrumentation. */
export function resetClientInstrumentation(): void {
  hooks = pending = undefined;
}
