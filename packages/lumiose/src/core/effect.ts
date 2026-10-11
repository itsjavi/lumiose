// Effects, async run subscribers and the scheduler (spec §6.2).
//
// Flush order: computeds are pulled lazily while effects check their
// dependencies; render effects (DOM bindings and async runs) run parents first,
// by owner depth; user effects run last, after the DOM is up to date.
import {
  abortLifetime,
  addCleanup,
  attachOwner,
  DISPOSED,
  disposeOwner,
  getOwner,
  handleError,
  resetOwner,
  STALE,
  SUBSCRIBER,
  type Owner,
} from "./owner.ts";
import {
  activeSub,
  checkDirty,
  enterRun,
  exitRun,
  purgeDeps,
  releaseDeps,
  setActiveSub,
  setCurrentOwner,
  setNotify,
  untrack,
} from "./reactive.ts";
import { DIRTY, PENDING, RECURSED_CHECK, WATCHING, type ReactiveNode } from "./system.ts";

const USER = 0;
const RENDER = 1;
const RUN = 2;

interface EffectNode extends Owner, ReactiveNode {
  kind: typeof USER | typeof RENDER | typeof RUN;
}

export type EffectFn = () => void | (() => void);

interface UserEffect extends EffectNode {
  fn: EffectFn;
}

/** A DOM binding: `compute` is tracked; `apply` writes the target only when the value changed. */
export interface RenderEffect<T = unknown, E = unknown> extends EffectNode {
  compute: () => T;
  apply: (target: E, value: T) => void;
  target: E;
  value: T | undefined;
}

/**
 * The subscriber of one async component run. It tracks across awaits: it is
 * paused before each await and resumed afterwards, and it is never re-run.
 * When a dependency changes it is invalidated (superseded) instead.
 */
export interface Run extends EffectNode {
  invalidate: (run: Run) => void;
  active: boolean;
  prevSub: ReactiveNode | undefined;
  prevOwner: Owner | undefined;
}

// --- Scheduler ---------------------------------------------------------------

let renderQueue: EffectNode[] = [];
let spareQueue: EffectNode[] = [];
let minDepth = 0;
let maxDepth = 0;
const userQueue: (EffectNode | undefined)[] = [];
let userIndex = 0;
let batchDepth = 0;
let flushing = false;
let scheduled = false;
let flushError: { error: unknown } | undefined;

function enqueue(node: EffectNode): void {
  if (node.kind === USER) {
    userQueue.push(node);
  } else {
    const depth = node.depth;
    if (renderQueue.length === 0) {
      minDepth = maxDepth = depth;
    } else if (depth < minDepth) {
      minDepth = depth;
    } else if (depth > maxDepth) {
      maxDepth = depth;
    }
    renderQueue.push(node);
  }
  if (!scheduled && !flushing && batchDepth === 0) {
    scheduled = true;
    queueMicrotask(flushMicrotask);
  }
}

setNotify((node) => {
  // WATCHING is restored when the node runs, so it is queued at most once.
  node.flags &= ~WATCHING;
  enqueue(node as EffectNode);
});

function flushMicrotask(): void {
  scheduled = false;
  flush();
}

/** Runs pending effects now. Inside a running flush, it does nothing. */
export function flush(): void {
  if (flushing) {
    return;
  }
  flushing = true;
  try {
    while (true) {
      if (renderQueue.length !== 0) {
        runRenderPass();
      } else if (userIndex < userQueue.length) {
        const node = userQueue[userIndex]!;
        userQueue[userIndex++] = undefined;
        runSafely(node);
      } else {
        break;
      }
    }
  } finally {
    userQueue.length = 0;
    userIndex = 0;
    flushing = false;
  }
  const failure = flushError;
  if (failure !== undefined) {
    flushError = undefined;
    throw failure.error;
  }
}

function runRenderPass(): void {
  const queue = renderQueue;
  renderQueue = spareQueue;
  spareQueue = queue;
  if (minDepth === maxDepth) {
    for (let i = 0; i < queue.length; i++) {
      runSafely(queue[i]!);
    }
  } else {
    // Bucket by depth so parents run before children: a parent that replaces
    // a subtree disposes the children's bindings before they would run.
    const buckets: EffectNode[][] = [];
    for (let i = 0; i < queue.length; i++) {
      const node = queue[i]!;
      (buckets[node.depth - minDepth] ??= []).push(node);
    }
    for (const bucket of buckets) {
      if (bucket !== undefined) {
        for (let i = 0; i < bucket.length; i++) {
          runSafely(bucket[i]!);
        }
      }
    }
  }
  queue.length = 0;
}

function runSafely(node: EffectNode): void {
  try {
    if (node.kind === USER) {
      runUser(node as UserEffect);
    } else if (node.kind === RENDER) {
      runRender(node as RenderEffect);
    } else {
      runRun(node as Run);
    }
  } catch (error) {
    report(node, error);
  }
}

/** Sends an effect error to the nearest error handler; unhandled errors are rethrown when the flush ends. */
function report(node: EffectNode, error: unknown): void {
  try {
    handleError(node, error);
  } catch (unhandled) {
    flushError ??= { error: unhandled };
  }
}

/** Whether a notified node's dependencies really changed; computeds are pulled here. */
function isDirty(node: EffectNode): boolean {
  const flags = node.flags;
  if (flags & DIRTY || (flags & PENDING && checkDirty(node.deps!, node))) {
    return true;
  }
  if (node.deps !== undefined) {
    node.flags = WATCHING | (flags & RECURSED_CHECK);
  }
  return false;
}

/** Starts a tracking session of `node`, which also becomes the current owner. */
function startTracking(node: EffectNode): void {
  node.depsTail = undefined;
  node.flags = WATCHING | RECURSED_CHECK;
  enterRun();
}

/** Ends the session: drops the links not re-read in it. */
function endTracking(node: EffectNode): void {
  exitRun();
  node.flags &= ~RECURSED_CHECK;
  if (node.state & DISPOSED) {
    releaseDeps(node);
  } else {
    purgeDeps(node);
  }
}

/** Runs `fn` as a tracking session of `node`, which is also the current owner. */
function runTracked<T>(node: EffectNode, fn: () => T): T {
  startTracking(node);
  const prevSub = setActiveSub(node);
  const prevOwner = setCurrentOwner(node);
  try {
    return fn();
  } finally {
    setActiveSub(prevSub);
    setCurrentOwner(prevOwner);
    endTracking(node);
  }
}

export function batch<T>(fn: () => T): T {
  ++batchDepth;
  try {
    return fn();
  } finally {
    if (--batchDepth === 0) {
      flush();
    }
  }
}

/** Opens a batch without a closure (delegated event handlers); pair with `endBatch`. */
export function startBatch(): void {
  ++batchDepth;
}

export function endBatch(): void {
  if (--batchDepth === 0) {
    flush();
  }
}

// --- User effects ------------------------------------------------------------

/**
 * Runs `fn` after the DOM updates, and again whenever what it read changes.
 * `fn` may return a cleanup. Returns a disposer.
 */
export function effect(fn: EffectFn): () => void {
  const node: UserEffect = {
    parent: undefined,
    depth: 0,
    firstChild: undefined,
    nextSibling: undefined,
    prevSibling: undefined,
    cleanups: undefined,
    context: undefined,
    lifetime: undefined,
    state: SUBSCRIBER,
    deps: undefined,
    depsTail: undefined,
    flags: DIRTY,
    kind: USER,
    fn,
  };
  attachOwner(node, getOwner());
  if (!(node.state & DISPOSED)) {
    enqueue(node);
  }
  return () => disposeOwner(node);
}

function runUser(node: UserEffect): void {
  if (node.state & DISPOSED || !isDirty(node)) {
    return;
  }
  if (node.firstChild !== undefined || node.cleanups !== undefined || node.lifetime !== undefined) {
    try {
      resetOwner(node);
    } catch (error) {
      report(node, error);
    }
    if (node.state & DISPOSED) {
      return;
    }
  }
  const cleanup = runTracked(node, node.fn);
  if (typeof cleanup === "function") {
    addCleanup(node, cleanup);
  }
}

/** Runs `fn` once, untracked, after the current owner's DOM is mounted. It may return a cleanup. */
export function onMount(fn: EffectFn): void {
  effect(() => untrack(fn));
}

// --- Render effects ----------------------------------------------------------

/**
 * Creates a DOM binding (`bind` in the compiler-runtime contract). `compute` runs
 * now, tracked; `apply(target, value)` runs now and then whenever the computed
 * value changes (`Object.is`), untracked. `compute` may be a signal itself. Both
 * run with the binding as the current owner; it is never reset, only disposed
 * with its owner.
 */
export function renderEffect<E, T>(
  target: E,
  compute: () => T,
  apply: (target: E, value: T) => void,
): RenderEffect<T, E> {
  const node: RenderEffect<T, E> = {
    parent: undefined,
    depth: 0,
    firstChild: undefined,
    nextSibling: undefined,
    prevSibling: undefined,
    cleanups: undefined,
    context: undefined,
    lifetime: undefined,
    state: SUBSCRIBER,
    deps: undefined,
    depsTail: undefined,
    flags: 0,
    kind: RENDER,
    compute,
    apply,
    target,
    value: undefined,
  };
  attachOwner(node, getOwner());
  if (!(node.state & DISPOSED)) {
    runBinding(node, true);
  }
  return node;
}

function runRender(node: RenderEffect): void {
  if (!(node.state & DISPOSED) && isDirty(node)) {
    runBinding(node, false);
  }
}

/** One frame for both phases: `compute` tracked, then `apply` untracked if the value changed. */
function runBinding<T, E>(node: RenderEffect<T, E>, initial: boolean): void {
  startTracking(node);
  const prevSub = setActiveSub(node);
  const prevOwner = setCurrentOwner(node);
  let tracking = true;
  try {
    const value = node.compute();
    tracking = false;
    endTracking(node);
    setActiveSub(undefined);
    if (initial || !Object.is(value, node.value)) {
      node.apply(node.target, (node.value = value));
    }
  } finally {
    setActiveSub(prevSub);
    setCurrentOwner(prevOwner);
    if (tracking) {
      endTracking(node);
    }
  }
}

// --- Async runs ----------------------------------------------------------------

/**
 * Whether a run was ever created. Only `createRun` sets it, so bundles without async components
 * and resources fold it to `false` and drop code that only runs inside runs (the fetchJSON cache,
 * behind app/cache/run-fetch.ts).
 */
export let hasRuns = false;

/**
 * Creates the subscriber and owner of one async component run under `parent`.
 * `invalidate` is called once, during a flush, when something the run read has
 * changed; by then the run has stopped tracking and its lifetime is aborted.
 * The run stays alive (its UI and cleanups) until it is disposed.
 */
export function createRun(invalidate: (run: Run) => void, parent: Owner | undefined): Run {
  hasRuns = true;
  const run: Run = {
    parent: undefined,
    depth: 0,
    firstChild: undefined,
    nextSibling: undefined,
    prevSibling: undefined,
    cleanups: undefined,
    context: undefined,
    lifetime: undefined,
    state: SUBSCRIBER,
    deps: undefined,
    depsTail: undefined,
    flags: WATCHING,
    kind: RUN,
    invalidate,
    active: false,
    prevSub: undefined,
    prevOwner: undefined,
  };
  attachOwner(run, parent);
  return run;
}

/**
 * Makes `run` the active subscriber and owner. Reads track into it, appending
 * to the links of earlier segments. A superseded or disposed run no longer tracks.
 */
export function resumeRun(run: Run): void {
  if (run.active) {
    return;
  }
  run.active = true;
  run.prevOwner = setCurrentOwner(run);
  if (run.state & (DISPOSED | STALE)) {
    run.prevSub = setActiveSub(undefined);
  } else {
    run.prevSub = setActiveSub(run);
    run.flags |= RECURSED_CHECK;
  }
  enterRun();
}

/** Restores the subscriber and owner that were active before `resumeRun`. The run keeps its links. */
export function pauseRun(run: Run): void {
  if (!run.active) {
    return;
  }
  run.active = false;
  exitRun();
  setActiveSub(run.prevSub);
  setCurrentOwner(run.prevOwner);
  run.prevSub = run.prevOwner = undefined;
  run.flags &= ~RECURSED_CHECK;
  if (run.state & (DISPOSED | STALE) && run.deps !== undefined) {
    // Disposed or superseded mid-segment: drop the links made after that.
    releaseDeps(run);
  }
}

/** Whether `node` is the subscriber of an async run. */
export function isRun(node: ReactiveNode | undefined): boolean {
  return node !== undefined && (node as EffectNode).kind === RUN;
}

function runRun(run: Run): void {
  if (run.state & (DISPOSED | STALE) || !isDirty(run)) {
    return;
  }
  run.flags = 0;
  releaseDeps(run);
  if (activeSub === run) {
    setActiveSub(undefined);
  }
  abortLifetime(run);
  run.invalidate(run);
}
