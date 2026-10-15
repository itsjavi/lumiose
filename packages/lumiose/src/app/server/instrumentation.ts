// Server instrumentation (decision-49, TASK-298): `src/instrumentation.server.ts` exports
// `register()`, run once per server instance before the first request, `onRequestError()`, which
// receives unexpected errors with the request, route and phase, and `instrumentations`, observers
// that wrap the phases of a request. Observers never change behaviour (React Router's model): the
// phase runs exactly once whatever a wrapper does, `call()` never throws, and an error a wrapper,
// `register()` or `onRequestError()` throws is logged without affecting the request.

import type { Routes } from "../routes/registry.ts";
import type { HttpMethod, RouteParamValues } from "./context.ts";

/** Where in a request an unexpected error happened (`RequestErrorInfo.phase`). */
export type RequestPhase = "middleware" | "action" | "endpoint" | "render" | "stream" | "waitUntil";

/** What `onRequestError(error, info)` receives with each unexpected server error. */
export interface RequestErrorInfo {
  request: Request;
  /** The matched route pattern; undefined for a URL no route matches. */
  route: Routes | undefined;
  params: RouteParamValues;
  /**
   * `"middleware"`: `src/middleware.ts` or a folder's (and the route's locale checks);
   * `"action"`: a form action; `"endpoint"`: a `route.ts` method; `"render"`: the page until its
   * shell is ready, an error page, or an `<ErrorBoundary>` there; `"stream"`: a streamed
   * `<Suspense>` boundary; `"waitUntil"`: work passed to `ctx.platform.waitUntil()`.
   */
  phase: RequestPhase;
  /**
   * The digest an `<ErrorBoundary>` fallback shows instead of the error outside dev
   * (decision-29), to match a reported page to this error. Undefined otherwise.
   */
  digest: string | undefined;
}

/** What `call()` resolves to: the phase's outcome. It never rejects. */
export type InstrumentationResult = { status: "success" } | { status: "error"; error: unknown };

/** What every wrapper's `info` holds. */
interface PhaseInfo {
  request: Request;
  /** The matched route pattern; undefined for a URL no route matches (`request` only). */
  route: Routes | undefined;
  params: RouteParamValues;
}

/**
 * A wrapper around one phase: call `call()` where the phase should run (once; later calls return
 * the same promise) and await it to time the phase. The phase runs even when a wrapper does not
 * call it, and the wrapper cannot change its arguments or result.
 */
type Wrapper<Info, Result = InstrumentationResult> = (
  call: () => Promise<Result>,
  info: Info,
) => unknown;

/**
 * One observer of `instrumentations` in `src/instrumentation.server.ts`: optional wrappers per
 * phase. With several observers, the first wraps the outermost.
 */
export interface ServerInstrumentation {
  /** The whole request until the response is ready to send (top-level requests only). */
  request?: Wrapper<PhaseInfo, InstrumentationResult & { response?: { status: number } }>;
  /** Each middleware file, root or folder (`file`, project-relative), around what follows it. */
  middleware?: Wrapper<PhaseInfo & { file: string }>;
  /** A form action; `name` is its key in `actions`, or `"default"` for `export const action`. */
  action?: Wrapper<PhaseInfo & { name: string }>;
  /** A `route.ts` method. */
  endpoint?: Wrapper<PhaseInfo & { method: HttpMethod }>;
  /** A page or error page, until its shell is ready. */
  render?: Wrapper<PhaseInfo>;
  /** Each streamed `<Suspense>` boundary, until its content is ready or failed. */
  stream?: Wrapper<PhaseInfo>;
}

/** The wrappers of each phase, outermost first; `onRequestError` when exported. */
export interface InstrumentationHooks {
  request: Array<NonNullable<ServerInstrumentation["request"]>>;
  middleware: Array<NonNullable<ServerInstrumentation["middleware"]>>;
  action: Array<NonNullable<ServerInstrumentation["action"]>>;
  endpoint: Array<NonNullable<ServerInstrumentation["endpoint"]>>;
  render: Array<NonNullable<ServerInstrumentation["render"]>>;
  stream: Array<NonNullable<ServerInstrumentation["stream"]>>;
  onRequestError: ((error: unknown, info: RequestErrorInfo) => unknown) | undefined;
}

const PHASES = ["request", "middleware", "action", "endpoint", "render", "stream"] as const;

/** `register()` once per module instance: per server instance (per isolate on workers). */
const registered = new WeakMap<object, Promise<void>>();

/**
 * Reads the exports of `src/instrumentation.server.ts` and runs its `register()` (once per module
 * instance). Throws a TypeError for malformed exports; `register()` errors go to `report`.
 */
export async function loadInstrumentation(
  module: Record<string, unknown>,
  file: string,
  report: (error: unknown) => void,
): Promise<InstrumentationHooks> {
  const { register, onRequestError, instrumentations } = module;
  for (const [name, value] of [
    ["register", register],
    ["onRequestError", onRequestError],
  ] as const) {
    if (value !== undefined && typeof value !== "function") {
      throw new TypeError(`${file}: export ${name} must be a function.`);
    }
  }
  if (
    instrumentations !== undefined &&
    (!Array.isArray(instrumentations) ||
      !instrumentations.every((item) => typeof item === "object" && item !== null))
  ) {
    throw new TypeError(
      `${file}: export instrumentations must be an array of observers ({ request?, middleware?, action?, endpoint?, render?, stream? }).`,
    );
  }
  const hooks: InstrumentationHooks = {
    request: [],
    middleware: [],
    action: [],
    endpoint: [],
    render: [],
    stream: [],
    onRequestError: onRequestError as InstrumentationHooks["onRequestError"],
  };
  for (const observer of (instrumentations ?? []) as Array<Record<string, unknown>>) {
    for (const phase of PHASES) {
      const wrapper = observer[phase];
      if (wrapper === undefined) continue;
      if (typeof wrapper !== "function") {
        throw new TypeError(`${file}: instrumentations[].${phase} must be a function.`);
      }
      (hooks[phase] as unknown[]).push((call: unknown, info: unknown) =>
        wrapper.call(observer, call, info),
      );
    }
  }
  if (typeof register === "function") {
    let done = registered.get(module);
    if (done === undefined) {
      done = (async () => {
        try {
          await register();
        } catch (error) {
          report(instrumentationError(file, "register()", error));
        }
      })();
      registered.set(module, done);
    }
    await done;
  }
  return hooks;
}

/**
 * Runs `work` once inside `wrappers` (outermost first) and returns its own value or rejection.
 * `outcome` adds to a successful result (`request`: the response status). What a wrapper throws
 * goes to `report`.
 */
export async function observe<Info, T>(
  wrappers: ReadonlyArray<Wrapper<Info, any>>,
  info: Info,
  work: () => Promise<T>,
  report: (error: unknown) => void,
  outcome?: (value: T) => object,
): Promise<T> {
  let pending: Promise<T> | undefined;
  const start = () => (pending ??= work());
  let call: () => Promise<InstrumentationResult> = () =>
    start().then(
      (value) => ({ status: "success" as const, ...outcome?.(value) }),
      (error: unknown) => ({ status: "error" as const, error }),
    );
  for (let index = wrappers.length - 1; index >= 0; index--) {
    call = wrapped(wrappers[index]!, call, info, report);
  }
  await call();
  return start();
}

/** `inner` behind `wrapper`: resolves once the wrapper settled and `inner` ran, with its result. */
function wrapped<Info>(
  wrapper: Wrapper<Info, any>,
  inner: () => Promise<InstrumentationResult>,
  info: Info,
  report: (error: unknown) => void,
): () => Promise<InstrumentationResult> {
  let result: Promise<InstrumentationResult> | undefined;
  return () =>
    (result ??= (async () => {
      let called: Promise<InstrumentationResult> | undefined;
      const call = () => (called ??= inner());
      try {
        await wrapper(call, info);
      } catch (error) {
        report(error);
      }
      return call();
    })());
}

/** An error thrown by the instrumentation itself, for the server log. */
export function instrumentationError(file: string, what: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${file}: ${what} threw: ${message}`, { cause: error });
}
