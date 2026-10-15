// Context frames and async runs on the server (spec §6.4, contract doc-2 §3-4).
//
// There is no reactive graph on the server. Each component instance runs under its own owner (so
// context providers, `useContext`, `onCleanup` and `getAbortSignal()` work as on the client) and under a frame that
// carries the render-wide state: the request's render, the flush unit (shell or Suspense
// boundary), the enclosing island and the instance path used for await replay keys.
//
// Frames and owners live in module state while code runs synchronously. Async components restore
// them explicitly: `$await` pauses the run before awaiting and resolves to a resume function that
// the component calls in its own continuation, so concurrent requests never see each other's
// frames or context.

import {
  createOwner,
  currentOwner,
  getOwner,
  runWithLazyOwner,
  type Owner,
} from "../core/internal.ts";
import { setCurrentOwner } from "../core/reactive.ts";
import { LUM_AWAIT_VALUE, LUM_STREAM_TIMEOUT, LumioseError } from "../app/diagnostics.ts";
import type { ServerEntry } from "../app/cache/server.ts";
import { encodeData } from "./serialize.ts";
import { escapeText, html, isThenable, join, SSRHtml, type Html } from "./node.ts";

/** A scoped state accessor as compiled: `$$id` is set when the state can reach the browser. */
export interface StateAccessor {
  (): unknown;
  $$id?: string;
}

/** The scoped state instances of one request (or render), in creation order (./state.ts). */
export interface StateScope {
  readonly values: Map<StateAccessor, unknown>;
  /** The request's async cache entries (../app/cache/server.ts), by URL or key hash. */
  cache?: Map<string, ServerEntry>;
}

/** A server component as compiled: getter props in, renderable content out. */
export type ServerComponent<P> = (props: P) => unknown;

/** The serialized island record (spec §7.4). Optional fields are omitted when empty. */
export interface IslandRecord {
  id: number;
  ref: string;
  strategy: string;
  props: unknown;
  value?: string;
  slots?: string[];
  awaits?: Record<string, unknown>;
  /** The render's `idPrefix`, for the island's `useId()` in the browser. */
  idPrefix?: string;
}

export interface IslandState {
  readonly id: number;
  readonly ref: string;
  readonly record: IslandRecord;
  /** The unit that flushes the full record (follow `merged` with `resolveUnit`). */
  readonly unit: Unit;
}

/** What one flushed chunk carries besides HTML: the shell, or one streamed Suspense boundary. */
export interface Unit {
  /** Boundary name suffix (`lb<id>`), assigned when the boundary streams; -1 otherwise. */
  id: number;
  /** The unit the boundary's placeholder lives in; undefined for the shell. */
  readonly parent: Unit | undefined;
  /** Set when a boundary resolved synchronously and was folded into its parent. */
  merged: Unit | undefined;
  state: UnitState;
  html: string;
  islands: IslandState[];
  /** Await records of islands created in other units (appended records). */
  awaits: Map<IslandState, Record<string, unknown>> | undefined;
  preloads: string[];
  styles: string[];
  /** Boundaries whose placeholder is inside this unit, waiting for it to flush. */
  waiting: Unit[];
}

export const PENDING = 0;
export const READY = 1;
export const FLUSHED = 2;
export const FAILED = 3;
export type UnitState = typeof PENDING | typeof READY | typeof FLUSHED | typeof FAILED;

export interface HeadEntry {
  depth: number;
  html: string;
}

export interface RenderState {
  /** Prerendering: every `<Suspense>` renders into the shell (see `resolvesAll`). */
  readonly resolveAll: boolean;
  /**
   * Whether the response still streams (`response().setStreaming()`, decision-58). Once it reads
   * false, boundaries render into the shell, and those already streaming are inlined (./render.ts).
   */
  readonly streaming: (() => boolean) | undefined;
  /** `lumiose({ streamTimeout })` in milliseconds (decision-58); undefined when off. */
  readonly streamTimeout: number | undefined;
  /** Its timer, started by the first async work (`withTimeout`). */
  timeout: StreamTimeout | undefined;
  /** With `streaming`: each streamed boundary by id, settled once its content is placed or failed. */
  readonly streamed: Array<{ unit: Unit; settled: Promise<unknown> }> | undefined;
  readonly nonce: string | undefined;
  readonly strictStyles: boolean;
  readonly moduleUrl: (specifier: string) => string;
  /** URL of the island loader script; sent once, with the first island records. */
  readonly loaderUrl: string | undefined;
  loaderSent: boolean;
  /** Errors no `<ErrorBoundary>` handled; `streamed` when they belong to a streamed boundary. */
  readonly onError: (error: unknown, streamed?: boolean) => void;
  /** Each error an `<ErrorBoundary>` caught, with its digest when sanitized (./render.ts). */
  readonly onCaughtError: (error: unknown, info: CaughtErrorInfo) => void;
  /** Each streamed boundary's content, settling once it is ready or failed (instrumentation). */
  readonly onBoundary: ((settled: Promise<unknown>) => void) | undefined;
  /** `<ErrorBoundary>` fallbacks get a generic error with a digest (production, decision-29). */
  readonly sanitizeErrors: boolean;
  /** The request's root owner: disposed (aborting `getAbortSignal()`) when the render ends. */
  readonly owner: Owner;
  readonly shell: Unit;
  shellDone: boolean;
  done: boolean;
  nextIsland: number;
  nextBoundary: number;
  nextStyle: number;
  title: HeadEntry | undefined;
  metas: Map<string, HeadEntry>;
  head: string[];
  /** Streamed boundaries not yet flushed or failed. */
  pending: number;
  emit: ((chunk: string) => void) | undefined;
  close: (() => void) | undefined;
  swapSent: boolean;
  /** The scoped states of the request (./state.ts) and those the page payload already sent. */
  readonly states: StateScope;
  readonly sentStates: Set<StateAccessor>;
  /** The async cache entries the page payload already sent. */
  readonly sentCache: Set<string>;
  readonly isClientState: ((ref: string) => boolean) | undefined;
  /** A chunk with island records was sent: from then on, chunks carry the payload. */
  hydrates: boolean;
  /** `renderToStream(root, { idPrefix })`: prepended to every `useId()` (./id.ts). */
  readonly idPrefix: string;
}

/** The `streamTimeout` timer of a render: both promises resolve once it expires. */
export interface StreamTimeout {
  /** Async component runs fail then: the nearest `<ErrorBoundary>` renders. */
  readonly early: Promise<void>;
  /** A task later: boundaries whose content is still pending fail. */
  readonly late: Promise<void>;
  /** The LUM5009 error of one failed run or boundary (each gets its own digest). */
  readonly error: () => LumioseError;
  readonly cancel: () => void;
}

/** Whether `<Suspense>` boundaries render into the shell: prerendering, or `setStreaming(false)`. */
export function resolvesAll(render: RenderState): boolean {
  return render.resolveAll || (render.streaming !== undefined && !render.streaming());
}

/**
 * `value`, failing with LUM5009 once the render's `streamTimeout` expires (decision-58): `early`
 * for async component runs, so the rejection starts where the render waits and the nearest
 * `<ErrorBoundary>` handles it; `late` for whole boundaries, a task later, once those fallbacks
 * had their turn.
 */
export function withTimeout<T>(
  render: RenderState | undefined,
  value: Promise<T>,
  late = false,
): Promise<T> {
  if (render?.streamTimeout === undefined || render.done) return value;
  const timeout = (render.timeout ??= startTimeout(render.streamTimeout));
  const expired = (late ? timeout.late : timeout.early).then((): never => {
    throw timeout.error();
  });
  return Promise.race([value, expired]);
}

function startTimeout(ms: number): StreamTimeout {
  let expireEarly!: () => void;
  let expireLate!: () => void;
  const early = new Promise<void>((resolve) => (expireEarly = resolve));
  const late = new Promise<void>((resolve) => (expireLate = resolve));
  let lateTimer: ReturnType<typeof setTimeout> | undefined;
  const timer = setTimeout(() => {
    expireEarly();
    lateTimer = setTimeout(expireLate, 0);
  }, ms);
  // A pending render does not keep a process alive on its own (Node; elsewhere timers are numbers).
  (timer as { unref?: () => void }).unref?.();
  return {
    early,
    late,
    error: () =>
      new LumioseError(
        LUM_STREAM_TIMEOUT,
        `This part of the page was still loading when lumiose({ streamTimeout }) expired after ${ms} ms. Find the slow data source, render an <ErrorBoundary> around it, or raise streamTimeout`,
      ),
    cancel: () => {
      clearTimeout(timer);
      if (lateTimer !== undefined) clearTimeout(lateTimer);
    },
  };
}

/** Where an `<ErrorBoundary>` caught an error: `digest` is set when the fallback got a generic one. */
export interface CaughtErrorInfo {
  digest: string | undefined;
  /** Inside a streamed boundary, after the shell was sent. */
  streamed: boolean;
}

export interface Frame {
  readonly render: RenderState;
  readonly unit: Unit;
  readonly island: IslandState | undefined;
  /**
   * Island-relative instance path (`0.2.1`). Outside islands, the id scope of `useId()`: "" for the
   * render, then `2-`, `2-0-`, … for the scopes `scope()` forks.
   */
  readonly path: string;
  /**
   * Inside islands, the child instances created so far, `useId()` calls included. Outside islands,
   * the `useId()` calls and forked scopes so far.
   */
  children: number;
  /** Per-site await counters of this run (only inside islands). */
  occurrences: number[] | undefined;
  /** Inside a `<Suspense>` boundary of a streaming render. */
  readonly streamed: boolean;
}

let current: Frame | undefined;

export function currentFrame(): Frame | undefined {
  return current;
}

/** The render state, or a clear error when a render-only API runs outside a render. */
export function renderFrame(api: string): Frame {
  if (current === undefined) {
    throw new Error(
      `${api} can only be used while rendering with renderToStream() or renderToString().`,
    );
  }
  return current;
}

/** Runs `fn` with `frame` and `owner` as the current frame and owner. */
export function withFrame<T>(frame: Frame | undefined, owner: Owner | undefined, fn: () => T): T {
  const prevFrame = current;
  const prevOwner = setCurrentOwner(owner);
  current = frame;
  try {
    return fn();
  } finally {
    current = prevFrame;
    setCurrentOwner(prevOwner);
  }
}

function instanceFrame(parent: Frame | undefined): Frame | undefined {
  if (parent === undefined || parent.island === undefined) return parent;
  return {
    render: parent.render,
    unit: parent.unit,
    island: parent.island,
    path: `${parent.path}.${parent.children++}`,
    children: 0,
    occurrences: undefined,
    streamed: parent.streamed,
  };
}

/**
 * The frame for code that runs later, outside the synchronous render of `frame`: an async run, a
 * promise's content, an error fallback. Outside islands it forks a new `useId()` scope, numbered
 * now, so that ids do not depend on the order in which promises settle: the same page renders the
 * same ids. Inside islands frames already follow instance paths, which hydration matches.
 */
export function scope(frame: Frame | undefined): Frame | undefined {
  return frame === undefined || frame.island !== undefined
    ? frame
    : { ...frame, path: `${frame.path}${frame.children++}-`, children: 0 };
}

// --- Content -----------------------------------------------------------------------------------

/**
 * Renders a value in content position: strings are escaped text, nodes are raw HTML, arrays are
 * joined, functions (getters, signals) are called, and promises resolve concurrently in order.
 */
export function content(value: unknown): Html {
  switch (typeof value) {
    case "string":
      return escapeText(value);
    case "number":
    case "bigint":
      return String(value);
    case "function":
      return content((value as () => unknown)());
    case "object":
      if (value === null) return "";
      if (value instanceof SSRHtml) return value.t;
      if (Array.isArray(value)) return contentList(value);
      if (isThenable(value)) {
        const frame = scope(current);
        const owner = getOwner();
        return Promise.resolve(value).then((resolved) =>
          withFrame(frame, owner, () => content(resolved)),
        );
      }
      return escapeText(String(value));
    default:
      return "";
  }
}

function contentList(values: readonly unknown[]): Html {
  if (values.length === 1) return content(values[0]);
  const pieces: Html[] = [];
  for (const value of values) pieces.push(content(value));
  return join(pieces);
}

// --- Components --------------------------------------------------------------------------------

// oxlint-disable-next-line no-empty-function
const AsyncFunction = (async () => {}).constructor;

/**
 * Runs a component under a new owner and, inside islands, a new instance frame. A native
 * `async function` takes the async path (contract doc-2 §4); everything else renders synchronously.
 */
export function createComponent<P>(
  component: ServerComponent<P>,
  props: P,
): SSRHtml | Promise<SSRHtml> {
  return runComponent(component, props, instanceFrame(current));
}

export function runComponent<P>(
  component: ServerComponent<P>,
  props: P,
  frame: Frame | undefined,
): SSRHtml | Promise<SSRHtml> {
  if (component instanceof AsyncFunction) {
    return runAsync(component, props, scope(frame), createOwner(getOwner()));
  }
  // The hot path of every sync component. Its owner is lazy (as for client list rows): it exists
  // only once the component provides context, registers a cleanup, reads `getAbortSignal()` or awaits,
  // so most server components allocate no owner and the render's disposal has nothing to walk.
  const prevFrame = current;
  current = frame;
  nextComponent = component as ServerComponent<unknown>;
  nextProps = props;
  try {
    runWithLazyOwner(currentOwner, runNext);
  } finally {
    current = prevFrame;
  }
  const out = lastOutput!;
  lastOutput = undefined;
  return out;
}

// `runNext`'s input and output, in module state so that the hot path allocates no closure. It reads
// its input before the component runs (nested components reuse the slots) and writes its output
// last, which `runComponent` takes right after.
let nextComponent: ServerComponent<unknown> | undefined;
let nextProps: unknown;
let lastOutput: SSRHtml | Promise<SSRHtml> | undefined;

function runNext(): void {
  const component = nextComponent!;
  const props = nextProps;
  nextComponent = nextProps = undefined;
  const result = component(props);
  lastOutput = result instanceof SSRHtml ? result : html(content(result));
}

// --- Async runs --------------------------------------------------------------------------------

interface Run {
  readonly frame: Frame | undefined;
  readonly owner: Owner;
  active: boolean;
  prevFrame: Frame | undefined;
  prevOwner: Owner | undefined;
  prevRun: Run | undefined;
}

let currentRun: Run | undefined;

function resume(run: Run): void {
  if (run.active) return;
  run.active = true;
  run.prevFrame = current;
  run.prevOwner = setCurrentOwner(run.owner);
  run.prevRun = currentRun;
  current = run.frame;
  currentRun = run;
}

function pause(run: Run): void {
  if (!run.active) return;
  run.active = false;
  current = run.prevFrame;
  setCurrentOwner(run.prevOwner);
  currentRun = run.prevRun;
  run.prevFrame = run.prevOwner = run.prevRun = undefined;
}

function runAsync<P>(
  component: ServerComponent<P>,
  props: P,
  frame: Frame | undefined,
  owner: Owner,
): Promise<SSRHtml> {
  const run: Run = {
    frame,
    owner,
    active: false,
    prevFrame: undefined,
    prevOwner: undefined,
    prevRun: undefined,
  };
  resume(run);
  let result: unknown;
  try {
    result = component(props);
  } catch (error) {
    result = Promise.reject(error);
  } finally {
    // `$await` or `$leave` normally paused it already; hand-written async code may not call them.
    pause(run);
  }
  // `streamTimeout` fails the run where it waits (decision-58): its own awaits, not its children.
  const rendered = withTimeout(frame?.render, Promise.resolve(result)).then((value) =>
    value instanceof SSRHtml ? value.t : withFrame(frame, owner, () => content(value)),
  );
  // Inside islands the instance's output is a block: the range the client's async instance
  // claims (dom/async.ts), so instances hydrate independently once their awaits replay.
  return rendered.then((out) => new SSRHtml(frame?.island === undefined ? out : block(out)));
}

/** A hydration block: `<!--[-->…<!--]-->` (contract doc-2 §3). */
export function block(inner: string): string {
  return `<!--[-->${inner}<!--]-->`;
}

/**
 * Whether an async component run is executing (between a resume and a pause): `fetchJSON()`
 * then defaults its signal to `getAbortSignal()` and uses the async cache.
 */
export function inAsyncRun(): boolean {
  return currentRun?.active === true;
}

/**
 * Runs `fn` outside any async run, frame or owner but `owner`: the async cache's loaders, shared by
 * several runs (their own `fetchJSON` calls are plain requests).
 */
export function detached<T>(owner: Owner, fn: () => T): T {
  const run = currentRun;
  currentRun = undefined;
  try {
    return withFrame(undefined, owner, fn);
  } finally {
    currentRun = run;
  }
}

/**
 * Promises the async cache returned (../app/cache/server.ts). Awaited directly inside an island,
 * their value travels in the page payload, so the await record only holds a marker: `c:<key>`.
 */
export const cachedValues: WeakSet<object> = new WeakSet();

/**
 * `await e` in an async component compiles to `(await $await(() => e, site))()`. Evaluates the
 * thunk in the run, pauses it, and resolves to a function that resumes the run in the component's
 * own continuation and returns the value (or throws the rejection there, so `catch` blocks run
 * with the frame restored). Inside islands, the value is recorded under
 * `instancePath:site:occurrence` for hydration replay.
 */
export function $await<T>(
  thunk: () => T | PromiseLike<T>,
  site: number,
): Promise<() => Awaited<T>> {
  const run = currentRun;
  const frame = current;
  let key: string | undefined;
  if (frame?.island !== undefined) {
    const occurrences = (frame.occurrences ??= []);
    const occurrence = occurrences[site] ?? 0;
    occurrences[site] = occurrence + 1;
    key = `${frame.path}:${site}:${occurrence}`;
  }
  // A synchronous throw leaves the run active: it propagates in the body, whose `$leave` pauses it.
  const value = thunk();
  if (run !== undefined) pause(run);
  // A cached value is sent once in the page payload; the client awaits the cache again.
  const cached = key !== undefined && cachedValues.has(value as object);
  return Promise.resolve(value).then(
    (resolved) => {
      let failure: unknown;
      if (key !== undefined) {
        try {
          if (cached) recordAwait(frame!, `c:${key}`, 1);
          else recordAwait(frame!, key, resolved);
        } catch (error) {
          failure = error;
        }
      }
      return () => {
        if (run !== undefined) resume(run);
        if (failure !== undefined) throw failure;
        return resolved;
      };
    },
    (error: unknown) => () => {
      if (run !== undefined) resume(run);
      throw error;
    },
  );
}

/** `finally { $leave() }` around async component bodies: pauses the run when the body ends. */
export function $leave(): void {
  if (currentRun !== undefined) pause(currentRun);
}

function recordAwait(frame: Frame, key: string, value: unknown): void {
  const island = frame.island!;
  const data = encodeData(value, (path, reason) => {
    throw new LumioseError(
      LUM_AWAIT_VALUE,
      `The value awaited at ${key}${path} in island ${island.ref} is ${reason}. Values awaited inside islands are sent to the browser for hydration and must be plain data; return JSON from an endpoint (fetchJSON) or map it to plain objects`,
    );
  });
  const unit = resolveUnit(frame.unit);
  if (resolveUnit(island.unit) === unit) {
    (island.record.awaits ??= {})[key] = data;
  } else {
    const awaits = (unit.awaits ??= new Map());
    let records = awaits.get(island);
    if (records === undefined) awaits.set(island, (records = {}));
    records[key] = data;
  }
}

/** Follows folded (synchronously resolved) boundaries to the unit that will flush. */
export function resolveUnit(unit: Unit): Unit {
  while (unit.merged !== undefined) unit = unit.merged;
  return unit;
}

/** Compiler-emitted tag for async component definitions (contract doc-2 §4); the server path needs no dispatch change. */
export function $async<C extends (props: never) => unknown>(component: C): C {
  (component as C & { $$async?: true }).$$async = true;
  return component;
}
