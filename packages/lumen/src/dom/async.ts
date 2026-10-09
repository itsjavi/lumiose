// Async components on the client (decision-13, spec §4.4, contract doc-2 §4).
//
// An instance renders into its own range and owns one run at a time:
// - Each run is a fresh core `Run`: the subscriber that tracks the body's reads (before and after
//   awaits) and the owner of everything the body creates. `$await` pauses it synchronously and
//   resolves to a resume function, which the compiled continuation calls to restore it.
// - When something the shown run read changes, the run is superseded: its `lifetime()` aborts and
//   a new run starts at once. The old UI stays until the new run resolves; then, in one step, the
//   old run is disposed and the new content replaces it in the range. A run superseded before it
//   resolved is disposed at once, and its result is dropped, so the latest run always wins.
// - Until it is shown, a run is the boundary of the async content its body creates (nested async
//   components, resources): it swaps in only once that content has settled too, so a re-run never
//   reveals half-loaded UI nor triggers a `<Suspense>` fallback. Once shown, new pending content
//   below it (a branch mounting an async component) goes to the boundary above.
// - The first run is pending content for the nearest boundary; `pending()` is true while a later
//   run is in flight, and every run in flight counts for `busy()`. Rejections go to the nearest
//   error handler (`<ErrorBoundary>`).
import type { Renderable } from "../contract/client.ts";
import {
  addCleanup,
  beginBusy,
  createOwner,
  createRun,
  DISPOSED,
  disposeOwner,
  getOwner,
  handleError,
  lifetimeOf,
  lookupContext,
  PENDING,
  pauseRun,
  REVISION,
  resumeRun,
  runWithOwner,
  suspend,
  SUSPENSE,
  type Boundary,
  type Owner,
  type Run,
} from "../core/internal.ts";
import { signal, type Signal } from "../core/signal.ts";
import { childFrame, frame, setFrame, type Frame } from "./frame.ts";
import { hydrator } from "./hydration.ts";
import { createRange, renderInto, type RangeStart, type Region } from "./insert.ts";

type AsyncComponent = (props: any) => Promise<Renderable>;

interface Instance {
  /** The component, its props and owner (short internal names keep the runtime small, TASK-176). */
  c: AsyncComponent;
  q: unknown;
  owner: Owner;
  /** The region it renders into. */
  g: Region;
  /** `pending()` of the instance. */
  p: Signal<boolean>;
  /** Ends the instance's hold on its Suspense boundary. */
  r: () => void;
  /** The router's revision, re-read by each run. */
  v: (() => number) | undefined;
  /** The run on screen, and the latest run. */
  s: AsyncRun | undefined;
  l: AsyncRun | undefined;
}

interface AsyncRun extends Run {
  /** Its instance. */
  i: Instance;
  frame: Frame | undefined;
  /** The run and frame it replaced while active (`resume`/`pause`). */
  u: AsyncRun | undefined;
  y: Frame | undefined;
  /** Ends its `busy()` count. */
  d: () => void;
  /** Suspense content still pending below it, and its value waiting for that. */
  w: number;
  o: { value: Renderable } | undefined;
}

/** The run whose body is executing now (between a resume and a pause). */
let currentRun: AsyncRun | undefined;

function resume(run: AsyncRun): void {
  if (!run.active) {
    resumeRun(run);
    run.u = currentRun;
    run.y = setFrame(run.frame);
    currentRun = run;
  }
}

function pause(run: AsyncRun): void {
  if (run.active) {
    pauseRun(run);
    currentRun = run.u;
    setFrame(run.y);
    run.u = run.y = undefined;
  }
}

/** `createComponent` for a native async function: returns the instance's range. */
export function createAsync(component: AsyncComponent, props: unknown): RangeStart {
  const owner = createOwner(getOwner());
  const start = createRange();
  if (owner.state & DISPOSED) {
    // Created by the continuation of a run that was disposed meanwhile: render nothing.
    return start;
  }
  const end = start.$$end;
  const flag = signal(false);
  // Under hydration the range adopts the instance's server block, and the first run claims its
  // content with a cursor of its own (carried by its frame), after its awaits replay.
  const claimed = hydrator?.fork(start);
  const instance: Instance = {
    c: component,
    q: props,
    owner,
    g: {
      parent: end.parentNode!,
      marker: end,
      nodes: claimed === undefined ? [] : claimed[0],
      owner: undefined,
      value: undefined,
    },
    p: flag,
    r: suspend(owner),
    v: lookupContext(owner, REVISION, undefined) as (() => number) | undefined,
    s: undefined,
    l: undefined,
  };
  (owner.context ??= {})[PENDING] = flag;
  addCleanup(owner, instance.r);
  const parentFrame = frame;
  startRun(instance, parentFrame === undefined ? undefined : childFrame(parentFrame, claimed?.[1]));
  return start;
}

function startRun(instance: Instance, runFrame: Frame | undefined): void {
  const run = createRun(invalidate, instance.owner) as AsyncRun;
  run.i = instance;
  run.frame = runFrame;
  run.u = run.y = undefined;
  run.w = 0;
  run.o = undefined;
  addCleanup(run, (run.d = beginBusy()));
  (run.context ??= {})[SUSPENSE] = {
    update: (fn) => hold(run, fn),
  } satisfies Boundary;
  instance.l = run;
  resume(run);
  let result: Promise<Renderable>;
  try {
    instance.v?.();
    result = instance.c(instance.q);
  } catch (error) {
    result = Promise.reject(error);
  } finally {
    // `$await` or `$leave` paused it already; hand-written async code may call neither.
    pause(run);
  }
  Promise.resolve(result).then(
    (value) => settle(run, value),
    (error: unknown) => fail(run, error),
  );
}

/** Called during a flush when something the run read changed: start the next run. */
function invalidate(superseded: Run): void {
  const instance = (superseded as AsyncRun).i;
  if (superseded !== instance.s) {
    disposeOwner(superseded);
  }
  if (instance.s !== undefined) {
    instance.p.set(true);
  }
  startRun(instance, undefined);
}

/** Whether `run` lost to a newer run or was disposed; its outcome is then dropped. */
function dropped(run: AsyncRun): boolean {
  if (run === run.i.l && !(run.state & DISPOSED)) {
    return false;
  }
  disposeOwner(run);
  return true;
}

/** The run's boundary: counts content it is waiting for; once shown, forwards to the one above. */
function hold(run: AsyncRun, fn: (count: number) => number): void {
  const instance = run.i;
  if (instance.s === run) {
    (lookupContext(instance.owner, SUSPENSE, undefined) as Boundary | undefined)?.update(fn);
    return;
  }
  run.w = fn(run.w);
  const output = run.o;
  if (run.w === 0 && output !== undefined) {
    run.o = undefined;
    show(run, output.value);
  }
}

function settle(run: AsyncRun, value: Renderable): void {
  run.d();
  if (run.w > 0 && !(run.state & DISPOSED)) {
    run.o = { value };
  } else {
    show(run, value);
  }
}

function show(run: AsyncRun, value: Renderable): void {
  if (dropped(run)) {
    return;
  }
  const instance = run.i;
  const prev = instance.s;
  try {
    // The atomic swap: the old run's owner goes in the same step as its nodes. It is disposed
    // while still shown, so what it registered with the boundary above is released there.
    if (prev !== undefined) {
      disposeOwner(prev);
    }
    instance.s = run;
    // A hydrating first run renders with its frame, so content created lazily still claims.
    const prevFrame = setFrame(run.frame);
    try {
      runWithOwner(run, () => renderInto(instance.g, value));
    } finally {
      setFrame(prevFrame);
    }
  } catch (error) {
    handleError(instance.owner, error);
  } finally {
    instance.p.set(false);
    instance.r();
  }
}

function fail(run: AsyncRun, error: unknown): void {
  run.d();
  if (dropped(run)) {
    return;
  }
  // The failed run keeps tracking what it read, so a change to its inputs retries it.
  const instance = run.i;
  instance.p.set(false);
  instance.r();
  handleError(instance.owner, error);
}

/**
 * `await e` in an async component compiles to `(await $await(() => e, site))()`. Evaluates the
 * thunk inside the run (so its reads are tracked), or, while an island hydrates, replays the value
 * recorded under `instancePath:site:occurrence`. Pauses the run synchronously and resolves to a
 * function that resumes it in the component's own continuation and returns the value, or throws
 * the rejection there. Never rejects.
 */
export function $await<T>(
  thunk: () => T | PromiseLike<T>,
  site: number,
): Promise<() => Awaited<T>> {
  const run = currentRun;
  const runFrame = run?.frame;
  let recorded: { value: unknown } | undefined;
  if (runFrame !== undefined) {
    const occurrences = (runFrame.occurrences ??= []);
    const occurrence = occurrences[site] ?? 0;
    occurrences[site] = occurrence + 1;
    recorded = runFrame.replay(`${runFrame.path}:${site}:${occurrence}`, thunk);
  }
  // A synchronous throw leaves the run active: it propagates in the body, whose `$leave` pauses it.
  const value = recorded === undefined ? thunk() : (recorded.value as T);
  if (run !== undefined) {
    pause(run);
  }
  return Promise.resolve(value).then(
    (resolved) => () => {
      if (run !== undefined) {
        restore(run);
      }
      return resolved;
    },
    (error: unknown) => () => {
      if (run !== undefined) {
        restore(run);
      }
      throw error;
    },
  );
}

/** Resumes `run` in its continuation; a run disposed meanwhile stops with its lifetime's reason. */
function restore(run: AsyncRun): void {
  if (run.state & DISPOSED) {
    throw lifetimeOf(run).reason;
  }
  resume(run);
}

/** `finally { $leave() }` around async component bodies: pauses the run when the body ends. */
export function $leave(): void {
  if (currentRun !== undefined) {
    pause(currentRun);
  }
}

/** A component tagged by `$async`: `$$async` is the async path that `createComponent` takes. */
export interface AsyncTagged {
  $$async?: (component: any, props: unknown) => Renderable;
}

/**
 * Compiler-emitted tag for async component definitions (contract doc-2 §4):
 * `export const X = $async(async function X(props) { … })`. It stores the async path on the
 * component, so `createComponent` reaches it only through the tag and bundles without async
 * components never contain it.
 */
export function $async<C extends (props: never) => unknown>(component: C): C {
  (component as C & AsyncTagged).$$async = createAsync;
  return component;
}
