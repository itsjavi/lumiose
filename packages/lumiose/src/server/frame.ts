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
import { LUM_AWAIT_VALUE, LumioseError } from "../app/diagnostics.ts";
import { encodeData } from "./serialize.ts";
import { escapeText, html, isThenable, join, SSRHtml, type Html } from "./node.ts";

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
  readonly resolveAll: boolean;
  readonly nonce: string | undefined;
  readonly strictStyles: boolean;
  readonly moduleUrl: (specifier: string) => string;
  /** URL of the island loader script; sent once, with the first island records. */
  readonly loaderUrl: string | undefined;
  loaderSent: boolean;
  readonly onError: (error: unknown) => void;
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
}

export interface Frame {
  readonly render: RenderState;
  readonly unit: Unit;
  readonly island: IslandState | undefined;
  /** Island-relative instance path (`0.2.1`); "" outside islands. */
  readonly path: string;
  /** Child instances created so far (only counted inside islands). */
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
        const frame = current;
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
    return runAsync(component, props, frame, createOwner(getOwner()));
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
  const rendered = Promise.resolve(result).then((value) =>
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
 * then defaults its signal to `getAbortSignal()`.
 */
export function inAsyncRun(): boolean {
  return currentRun?.active === true;
}

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
  return Promise.resolve(value).then(
    (resolved) => {
      let failure: unknown;
      if (key !== undefined) {
        try {
          recordAwait(frame!, key, resolved);
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
