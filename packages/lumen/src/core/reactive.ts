// The reactive engine: execution context, and signal, computed and trigger nodes (spec §6.1).
// Effects and scheduling live in ./effect.ts, which installs the notify hook below.
import type { Owner } from "./owner.ts";
import {
  createReactiveSystem,
  DIRTY,
  MUTABLE,
  PENDING,
  RECURSED_CHECK,
  type Link,
  type ReactiveNode,
} from "./system.ts";

export type Equals<T> = (a: T, b: T) => boolean;

export interface SignalNode<T = unknown> extends ReactiveNode {
  currentValue: T;
  /** The latest written value. Reads apply it to `currentValue`. */
  pendingValue: T;
  equals: Equals<T>;
}

export interface ComputedNode<T = unknown> extends ReactiveNode {
  value: T | undefined;
  getter: (previous: T | undefined) => T;
  equals: Equals<T>;
}

/** A value-less node: readers track it, writers fire it (store properties, selectors). */
export interface TriggerNode extends ReactiveNode {
  /** Called when the node loses its last subscriber (selectors drop their per-key nodes). */
  unwatched?: ((node: TriggerNode) => void) | undefined;
}

// --- Execution context -------------------------------------------------------

/** The subscriber that records dependencies of the reads happening now. */
export let activeSub: ReactiveNode | undefined;
/** The owner that receives cleanups, children and context right now. */
export let currentOwner: Owner | undefined;
/** Tags links created during one tracking session, so repeated reads do not duplicate links. */
let cycle = 0;
/** Number of subscriber runs (effects, runs) in progress; writes inside them are "inner" writes. */
let runDepth = 0;

export function setActiveSub(sub: ReactiveNode | undefined): ReactiveNode | undefined {
  const prev = activeSub;
  activeSub = sub;
  return prev;
}

export function setCurrentOwner(owner: Owner | undefined): Owner | undefined {
  const prev = currentOwner;
  currentOwner = owner;
  return prev;
}

/** Starts a subscriber run; pair with `exitRun`. */
export function enterRun(): void {
  ++runDepth;
  ++cycle;
}

export function exitRun(): void {
  --runDepth;
}

export function untrack<T>(fn: () => T): T {
  const prev = activeSub;
  activeSub = undefined;
  try {
    return fn();
  } finally {
    activeSub = prev;
  }
}

// --- Graph -------------------------------------------------------------------

let notifyHook: (node: ReactiveNode) => void = () => {};

/** Installs the scheduler that receives watching nodes when their dependencies change. */
export function setNotify(fn: (node: ReactiveNode) => void): void {
  notifyHook = fn;
}

export const { link, unlink, propagate, checkDirty, shallowPropagate } = createReactiveSystem({
  update(node) {
    if ("getter" in node) {
      return updateComputed(node as ComputedNode);
    }
    if ("currentValue" in node) {
      return updateSignal(node as SignalNode);
    }
    node.flags = MUTABLE;
    return true;
  },
  notify(node) {
    notifyHook(node);
  },
  unwatched(node) {
    // Only computeds have dependencies. Unobserved computeds release them and
    // re-evaluate on their next read.
    if (node.depsTail !== undefined) {
      node.flags = MUTABLE | DIRTY;
      releaseDeps(node);
    } else {
      (node as TriggerNode).unwatched?.(node);
    }
  },
});

/** Removes the links left after `depsTail` by the run that just finished. */
export function purgeDeps(sub: ReactiveNode): void {
  const depsTail = sub.depsTail;
  let dep = depsTail !== undefined ? depsTail.nextDep : sub.deps;
  while (dep !== undefined) {
    dep = unlink(dep, sub);
  }
}

/** Removes every dependency link of `sub`. */
export function releaseDeps(sub: ReactiveNode): void {
  let dep: Link | undefined = sub.depsTail;
  while (dep !== undefined) {
    const prev: Link | undefined = dep.prevDep;
    unlink(dep, sub);
    dep = prev;
  }
}

function innerWrite(): boolean {
  return runDepth > 0;
}

// --- Signals -----------------------------------------------------------------

export function createSignalNode<T>(value: T, equals: Equals<T>): SignalNode<T> {
  return {
    currentValue: value,
    pendingValue: value,
    subs: undefined,
    subsTail: undefined,
    flags: MUTABLE,
    equals,
  };
}

function updateSignal(s: SignalNode): boolean {
  s.flags = MUTABLE;
  const prev = s.currentValue;
  return !s.equals(prev, (s.currentValue = s.pendingValue));
}

/** Applies a pending write, so a read always reflects the latest write. */
function settleSignal(s: SignalNode): void {
  if (s.flags & DIRTY && updateSignal(s)) {
    const subs = s.subs;
    if (subs !== undefined) {
      shallowPropagate(subs);
    }
  }
}

export function readSignal<T>(s: SignalNode<T>): T {
  settleSignal(s as SignalNode);
  if (activeSub !== undefined) {
    link(s, activeSub, cycle);
  }
  return s.currentValue;
}

export function peekSignal<T>(s: SignalNode<T>): T {
  settleSignal(s as SignalNode);
  return s.currentValue;
}

export function writeSignal<T>(s: SignalNode<T>, value: T): void {
  if (!s.equals(s.pendingValue, value)) {
    s.pendingValue = value;
    s.flags = MUTABLE | DIRTY;
    const subs = s.subs;
    if (subs !== undefined) {
      propagate(subs, innerWrite());
    }
  }
}

// --- Computeds ---------------------------------------------------------------

export function createComputedNode<T>(
  getter: (previous: T | undefined) => T,
  equals: Equals<T>,
): ComputedNode<T> {
  return {
    value: undefined,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: 0,
    getter,
    equals,
  };
}

/** Evaluates `c` while tracking its dependencies. Getters run without an owner: they must be pure. */
function evaluate<T>(c: ComputedNode<T>, sub: ReactiveNode | undefined): T {
  const prevSub = activeSub;
  const prevOwner = currentOwner;
  activeSub = sub;
  currentOwner = undefined;
  try {
    return c.getter(c.value);
  } finally {
    activeSub = prevSub;
    currentOwner = prevOwner;
  }
}

function updateComputed(c: ComputedNode): boolean {
  c.depsTail = undefined;
  c.flags = MUTABLE | RECURSED_CHECK;
  ++cycle;
  try {
    const value = evaluate(c, c);
    if (c.equals(c.value, value)) {
      return false;
    }
    c.value = value;
    return true;
  } finally {
    c.flags &= ~RECURSED_CHECK;
    purgeDeps(c);
  }
}

export function readComputed<T>(c: ComputedNode<T>): T {
  const sub = activeSub;
  if (sub === undefined && c.subs === undefined) {
    // Nothing observes this computed: evaluate it without subscribing, so no
    // source keeps a link to it. It holds no links, hence the DIRTY flag.
    const value = evaluate(c, undefined);
    if (c.flags === 0 || !c.equals(c.value as T, value)) {
      c.value = value;
    }
    c.flags = MUTABLE | DIRTY;
    return c.value as T;
  }
  const flags = c.flags;
  if (
    flags & DIRTY ||
    (flags & PENDING && (checkDirty(c.deps!, c) || ((c.flags = flags & ~PENDING), false)))
  ) {
    if (updateComputed(c as ComputedNode) && c.subs !== undefined) {
      shallowPropagate(c.subs);
    }
  } else if (flags === 0) {
    c.flags = MUTABLE | RECURSED_CHECK;
    ++cycle;
    try {
      c.value = evaluate(c, c);
    } finally {
      c.flags &= ~RECURSED_CHECK;
    }
  }
  if (sub !== undefined) {
    link(c, sub, cycle);
  }
  return c.value as T;
}

// --- Triggers ----------------------------------------------------------------

export function createTrigger(): TriggerNode {
  return { subs: undefined, subsTail: undefined, flags: MUTABLE };
}

/** Records a dependency of the active subscriber on `node`. */
export function track(node: TriggerNode): void {
  if (node.flags & DIRTY) {
    node.flags = MUTABLE;
    if (node.subs !== undefined) {
      shallowPropagate(node.subs);
    }
  }
  if (activeSub !== undefined) {
    link(node, activeSub, cycle);
  }
}

/** Marks everything that tracked `node` as changed. */
export function trigger(node: TriggerNode): void {
  node.flags = MUTABLE | DIRTY;
  if (node.subs !== undefined) {
    propagate(node.subs, innerWrite());
  }
}
