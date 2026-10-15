// The dev hook registry of the in-page inspector (decision-59, TASK-341; owner: Spark).
//
// In `lumiose dev` with the inspector on, the reactive core, the DOM runtime and the island loader
// report here, behind `INSPECTED`: components as they render (name, props, source location,
// parent), the signals, computeds, effects and bindings created meanwhile, signal writes, effect
// and binding runs with the writes that caused them, and island transitions. Builds define neither
// `DEV` nor the inspector flag, so the bundler drops every call site and, with them, this module:
// keep its top level free of side effects (the registry is created by the first hook).
//
// The inspector (@lumiose/vite's dev client) reads the registry from
// `globalThis[Symbol.for("lumiose.devtools")]`, which a browser extension could read too. Its shape
// is internal; `version` changes when it does.
//
// This module imports no runtime module that imports it (../core/owner.ts calls `ownerCreated`
// while it initializes): what it needs from owners comes through `inspectOwners()`.
import type { Owner } from "../core/owner.ts";
import type { ComputedNode, SignalNode } from "../core/reactive.ts";
import type { ReactiveNode } from "../core/system.ts";

/** Where the inspector finds the registry. */
export const REGISTRY_KEY: unique symbol = Symbol.for("lumiose.devtools") as never;

export type ReactiveKind = "signal" | "computed" | "effect" | "binding" | "store" | "trigger";

/** A component instance, from its render on. */
export interface ComponentRecord {
  id: number;
  name: string;
  /** `src/Counter.stsx:4:17`, which the compiler passes in dev. */
  source: string | undefined;
  /** The props object (getters stay live; `snapshot()` reads them safely). */
  props: unknown;
  parent: ComponentRecord | undefined;
  children: ComponentRecord[];
  /** The top-level nodes it rendered (none when it returned a function or text). */
  nodes: Node[];
  /** The signals, computeds, effects and bindings created while it rendered. */
  reactive: ReactiveRecord[];
  /** For the root of an island: the island. */
  island: IslandRecord | undefined;
}

/** A signal write. */
export interface WriteRecord {
  /** Order among writes; runs compare it with their own. */
  seq: number;
  time: number;
  value: unknown;
  previous: unknown;
  /** Where the write happened (its stack); stores and triggers have none. */
  where: Error | undefined;
}

/** A write that made an effect or binding run, through the computeds in `via` (outermost first). */
export interface Cause {
  source: ReactiveRecord;
  write: WriteRecord;
  via: ReactiveRecord[];
}

/** A run of an effect or binding after its first one. */
export interface RunRecord {
  record: ReactiveRecord;
  /** The write sequence when it ran: writes with a higher one came later. */
  seq: number;
  time: number;
  causes: Cause[];
}

export interface ReactiveRecord {
  id: number;
  kind: ReactiveKind;
  /** The variable name (the compiler passes it in dev) or the store property. */
  label: string | undefined;
  /** Created by Lumiose itself (a resource's state, the router's URL), not by the app. */
  internal: boolean;
  node: ReactiveNode;
  component: ComponentRecord | undefined;
  /** A binding's DOM node: the element or text it updates, or the parent of the region. */
  host: Node | undefined;
  /** The write sequence it was created at. */
  seq: number;
  write: WriteRecord | undefined;
  runs: number;
  run: RunRecord | undefined;
}

export type IslandState = "waiting" | "loading" | "hydrating" | "hydrated" | "failed";

export interface IslandRecord {
  id: number;
  /** `/src/Counter.stsx#Counter`. */
  ref: string;
  strategy: string;
  /** The strategy's value: `client:visible`'s root margin, `client:media`'s query. */
  value: string | undefined;
  state: IslandState;
  /** `performance.now()` of each step, when it happened. */
  armed: number | undefined;
  loading: number | undefined;
  loaded: number | undefined;
  hydrated: number | undefined;
  failed: number | undefined;
  error: unknown;
  /** The island's range markers (`<!--l:ID-->`, `<!--/l:ID-->`). */
  start: Node | undefined;
  end: Node | undefined;
  component: ComponentRecord | undefined;
}

/** The island loader's record of an island (./islands.ts), as the registry reads it. */
interface LoaderIsland {
  id: number;
  ref: string;
  strategy: string;
  value?: string | undefined;
  s?: Node | undefined;
  e?: Node | undefined;
}

export interface Registry {
  version: 1;
  /** Component trees: islands, SPA pages and `render()` roots. */
  roots: ComponentRecord[];
  islands: IslandRecord[];
  /** Signals and computeds created outside components (module scope, event handlers), newest last. */
  global: ReactiveRecord[];
  /** The latest runs of effects and bindings, newest last. */
  updates: RunRecord[];
  /** Grows with every change, so a reader knows when to render again. */
  changes: number;
  recordOf(node: ReactiveNode): ReactiveRecord | undefined;
  /** The bindings that update `node` or its text children. */
  bindingsOf(node: Node): ReactiveRecord[];
  /** What reads `record` now: the computeds, effects and bindings it would re-run. */
  dependents(record: ReactiveRecord): (ReactiveRecord | undefined)[];
  /** The current value; `stale` for a computed that will re-evaluate on its next read. */
  valueOf(record: ReactiveRecord): { value: unknown; stale: boolean };
  /** The component's props, getters evaluated untracked under a throwaway owner. */
  snapshot(component: ComponentRecord): PropEntry[];
  /** Drops the records of components and islands no longer in the document. */
  prune(): void;
}

export type PropEntry =
  | { key: string; kind: "value"; value: unknown }
  | { key: string; kind: "children" }
  | { key: string; kind: "error"; value: unknown };

/** Bounds of the lists that would otherwise grow for the whole session. */
const MAX_GLOBAL = 500;
const MAX_UPDATES = 200;
const MAX_ROOTS = 256;
/** How deep `Why did this update` follows computeds. */
const MAX_VIA = 8;
/**
 * `DIRTY | PENDING` of ../core/system.ts: a computed that will re-evaluate. Not imported: under a
 * bundle that leaves core out, the import would stay for its side effects.
 */
const STALE = 16 | 32;

interface State extends Registry {
  stack: ComponentRecord[];
  records: WeakMap<ReactiveNode, ReactiveRecord>;
  functions: WeakMap<object, ReactiveRecord>;
  owners: WeakMap<Owner, ComponentRecord>;
  hosts: WeakMap<Node, ReactiveRecord[]>;
  sources: WeakMap<object, string>;
  names: WeakMap<object, string>;
  islandsById: Map<number, IslandRecord>;
  hydrating: IslandRecord | undefined;
  /** Above 0 while `snapshot()` evaluates getters: nothing is recorded. */
  paused: number;
  seq: number;
  ids: number;
}

let state: State | undefined;

/** What the registry needs from ../core/owner.ts and ../core/reactive.ts. */
export interface OwnerTools {
  /** The owner things created now attach to, without materializing a lazy one. */
  lookup(): Owner | undefined;
  create(parent: Owner | undefined): Owner;
  dispose(owner: Owner): void;
  run<T>(owner: Owner | undefined, fn: () => T): T;
  setActiveSub(sub: ReactiveNode | undefined): ReactiveNode | undefined;
}

let tools: OwnerTools | undefined;

/** ../core/owner.ts hands over its tools once it initialized. */
export function inspectOwners(ownerTools: OwnerTools): void {
  tools = ownerTools;
}

/** The registry, created by the first hook; none outside the browser (the dev server's runtime). */
function registry(): State | undefined {
  if (state === undefined && typeof document !== "undefined") {
    state = createState();
    (globalThis as Record<symbol, unknown>)[REGISTRY_KEY] = state;
  }
  return state !== undefined && state.paused === 0 ? state : undefined;
}

/** For tests: forgets what was recorded. */
export function resetRegistry(): void {
  delete (globalThis as Record<symbol, unknown>)[REGISTRY_KEY];
  state = undefined;
}

function createState(): State {
  const s: State = {
    version: 1,
    roots: [],
    islands: [],
    global: [],
    updates: [],
    changes: 0,
    stack: [],
    records: new WeakMap(),
    functions: new WeakMap(),
    owners: new WeakMap(),
    hosts: new WeakMap(),
    sources: new WeakMap(),
    names: new WeakMap(),
    islandsById: new Map(),
    hydrating: undefined,
    paused: 0,
    seq: 0,
    ids: 0,
    recordOf: (node) => s.records.get(node),
    bindingsOf(node) {
      const out = [...(s.hosts.get(node) ?? [])];
      for (const child of node.childNodes) {
        if (child.nodeType === 3) out.push(...(s.hosts.get(child) ?? []));
      }
      return out;
    },
    dependents(record) {
      const out: (ReactiveRecord | undefined)[] = [];
      for (let link = record.node.subs; link !== undefined; link = link.nextSub) {
        out.push(s.records.get(link.sub));
      }
      return out;
    },
    valueOf(record) {
      const node = record.node;
      if (record.kind === "signal")
        return { value: (node as SignalNode).pendingValue, stale: false };
      if (record.kind === "computed") {
        return { value: (node as ComputedNode).value, stale: !!(node.flags & STALE) };
      }
      if (record.kind === "binding") {
        return { value: (node as unknown as { value: unknown }).value, stale: false };
      }
      return { value: undefined, stale: false };
    },
    snapshot: (component) => snapshot(s, component),
    prune: () => prune(s),
  };
  return s;
}

function changed(s: State): void {
  s.changes++;
}

/** The component whose render is creating things now, or the one that owns the current owner. */
function current(s: State): ComponentRecord | undefined {
  const top = s.stack[s.stack.length - 1];
  if (top !== undefined) return top;
  const owner = tools?.lookup();
  return owner === undefined ? undefined : s.owners.get(owner);
}

// --- Components ----------------------------------------------------------------------------------

/** A component starts rendering (./component.ts). Pair with `exitComponent`. */
export function enterComponent(component: object, props: unknown): ComponentRecord | undefined {
  const s = registry();
  if (s === undefined) return undefined;
  const parent = current(s);
  const record: ComponentRecord = {
    id: ++s.ids,
    name: s.names.get(component) ?? ((component as { name?: string }).name || "(anonymous)"),
    source: s.sources.get(component),
    props,
    parent,
    children: [],
    nodes: [],
    reactive: [],
    island: undefined,
  };
  if (parent !== undefined) {
    parent.children.push(record);
  } else {
    const island = s.hydrating;
    if (island !== undefined && island.component === undefined) {
      island.component = record;
      record.island = island;
    }
    if (s.roots.push(record) > MAX_ROOTS) prune(s);
  }
  s.stack.push(record);
  changed(s);
  return record;
}

/** The component returned `result` (or threw). */
export function exitComponent(record: ComponentRecord | undefined, result: unknown): void {
  if (record === undefined || state === undefined) return;
  const stack = state.stack;
  stack.splice(stack.lastIndexOf(record), 1);
  record.nodes = nodesOf(result);
  changed(state);
}

/** The component that is rendering now (a hot-update wrapper keeps it for its later renders). */
export function currentComponent(): ComponentRecord | undefined {
  const s = registry();
  return s === undefined ? undefined : s.stack[s.stack.length - 1];
}

/**
 * Renders `record` again (lumiose/dom/hot re-renders an edited component in place): what its
 * previous render created is gone, and the new render's records replace it.
 */
export function renderComponent<T>(record: ComponentRecord | undefined, render: () => T): T {
  if (record === undefined || state === undefined) return render();
  record.children = [];
  record.reactive = [];
  state.stack.push(record);
  let result: T | undefined;
  try {
    return (result = render());
  } finally {
    exitComponent(record, result);
  }
}

/** Names a component the runtime creates without a name (the SPA router's root); returns it. */
export function nameComponent<C extends object>(component: C, name: string): C {
  registry()?.names.set(component, name);
  return component;
}

/** The compiler passes a component's source location in dev (lumiose/dom/hot's `$hot`). */
export function locateComponent(component: object, source: string): void {
  registry()?.sources.set(component, source);
}

function nodesOf(result: unknown): Node[] {
  if (typeof Node === "undefined") return [];
  if (result instanceof Node) return [result];
  if (!Array.isArray(result)) return [];
  const out: Node[] = [];
  for (const item of result.flat(Infinity)) if (item instanceof Node) out.push(item);
  return out;
}

// --- Owners and reactive nodes ---------------------------------------------------------------------

/** An owner was created under `parent` (../core/owner.ts): it belongs to the current component. */
export function ownerCreated(owner: Owner, parent: Owner | undefined): void {
  const s = registry();
  if (s === undefined) return;
  const component =
    s.stack[s.stack.length - 1] ?? (parent === undefined ? undefined : s.owners.get(parent));
  if (component !== undefined) s.owners.set(owner, component);
}

/**
 * A reactive node was created: a signal or computed (`fn`, the function the app holds), an effect,
 * or a binding (`target`, what it updates).
 */
export function nodeCreated(
  node: ReactiveNode,
  kind: ReactiveKind,
  fn?: object,
  target?: unknown,
): void {
  const s = registry();
  if (s === undefined) return;
  const owner = kind === "effect" || kind === "binding" ? (node as unknown as Owner) : undefined;
  const component = owner !== undefined ? s.owners.get(owner) : current(s);
  const record = recordNode(s, node, kind, component);
  if (fn !== undefined) s.functions.set(fn, record);
  if (kind === "binding" && typeof Node !== "undefined") {
    const host =
      target instanceof Node
        ? target
        : (target as { parent?: unknown } | null)?.parent instanceof Node
          ? (target as { parent: Node }).parent
          : undefined;
    if (host !== undefined) {
      record.host = host;
      const list = s.hosts.get(host);
      if (list === undefined) s.hosts.set(host, [record]);
      else list.push(record);
    }
  }
}

function recordNode(
  s: State,
  node: ReactiveNode,
  kind: ReactiveKind,
  component: ComponentRecord | undefined,
): ReactiveRecord {
  const record: ReactiveRecord = {
    id: ++s.ids,
    kind,
    label: undefined,
    internal: false,
    node,
    component,
    host: undefined,
    seq: s.seq,
    write: undefined,
    runs: 0,
    run: undefined,
  };
  s.records.set(node, record);
  if (component !== undefined) {
    component.reactive.push(record);
  } else if (kind !== "effect" && kind !== "binding" && kind !== "trigger") {
    if (s.global.push(record) > MAX_GLOBAL) s.global.shift();
  }
  changed(s);
  return record;
}

/**
 * Names a signal or computed: after its variable (the compiler's dev output through
 * lumiose/dom/hot's `$label`), or, `internal`, after what the runtime made it for.
 */
export function labelValue(value: unknown, label: string, internal = false): void {
  const record = registry()?.functions.get(value as object);
  if (record !== undefined) {
    record.label = label;
    record.internal = internal;
  }
}

/** `value` (a function the app holds, such as a ref) reads `signal`, which takes its labels. */
export function aliasValue(value: object, signal: object, label: string): void {
  const s = registry();
  const record = s?.functions.get(signal);
  if (s === undefined || record === undefined) return;
  s.functions.set(value, record);
  record.label = label;
  record.internal = true;
}

/** A store property's node, on its first tracked read (../core/store.ts). */
export function storeKey(node: ReactiveNode, key: PropertyKey): void {
  const s = registry();
  if (s === undefined || s.records.has(node)) return;
  recordNode(s, node, "store", current(s)).label = String(key);
}

/** A signal (or a trigger: a store property, a selector key) changed. */
export function nodeWritten(node: ReactiveNode, previous: unknown, value: unknown): void {
  const s = registry();
  if (s === undefined) return;
  const record = s.records.get(node) ?? recordNode(s, node, "trigger", undefined);
  record.write = {
    seq: ++s.seq,
    time: performance.now(),
    value,
    previous,
    where: record.kind === "signal" ? new Error("write") : undefined,
  };
  changed(s);
}

/** An effect or binding runs again because something it read changed (../core/effect.ts). */
export function nodeRan(node: ReactiveNode): void {
  const s = registry();
  const record = s?.records.get(node);
  if (s === undefined || record === undefined) return;
  const since = record.run?.seq ?? record.seq;
  const causes: Cause[] = [];
  collectCauses(s, node, since, [], causes);
  const run: RunRecord = { record, seq: s.seq, time: performance.now(), causes };
  // An effect's first run is queued like a re-run; it is not an update.
  const first = record.runs++ === 0 && record.kind === "effect";
  record.run = run;
  if (!first && s.updates.push(run) > MAX_UPDATES) s.updates.shift();
  changed(s);
}

/** The writes after `since` among `node`'s dependencies, through computeds. */
function collectCauses(
  s: State,
  node: ReactiveNode,
  since: number,
  via: ReactiveRecord[],
  out: Cause[],
): void {
  for (let link = node.deps; link !== undefined; link = link.nextDep) {
    const dep = link.dep;
    const record = s.records.get(dep);
    if ("getter" in dep) {
      if (record !== undefined && via.length < MAX_VIA) {
        collectCauses(s, dep, since, [...via, record], out);
      }
    } else if (record?.write !== undefined && record.write.seq > since) {
      out.push({ source: record, write: record.write, via });
    }
  }
}

// --- Islands ------------------------------------------------------------------------------------

/** The island loader moved an island to `next` (./islands.ts). */
export function islandState(island: LoaderIsland, next: IslandState, error?: unknown): void {
  const s = registry();
  if (s === undefined) return;
  let record = s.islandsById.get(island.id);
  if (record === undefined || (record.start !== undefined && record.start !== island.s)) {
    record = {
      id: island.id,
      ref: island.ref,
      strategy: island.strategy,
      value: island.value,
      state: next,
      armed: undefined,
      loading: undefined,
      loaded: undefined,
      hydrated: undefined,
      failed: undefined,
      error: undefined,
      start: island.s,
      end: island.e,
      component: undefined,
    };
    s.islandsById.set(island.id, record);
    s.islands.push(record);
  }
  const now = performance.now();
  record.state = next;
  record.start = island.s;
  record.end = island.e;
  if (next === "waiting") record.armed ??= now;
  else if (next === "loading") record.loading = now;
  else if (next === "hydrating") {
    record.loaded = now;
    record.component = undefined;
    s.hydrating = record;
  } else {
    if (s.hydrating === record) s.hydrating = undefined;
    if (next === "hydrated") record.hydrated = now;
    else {
      record.failed = now;
      record.error = error;
    }
  }
  changed(s);
}

// --- Reading ------------------------------------------------------------------------------------

function snapshot(s: State, component: ComponentRecord): PropEntry[] {
  const props = component.props;
  const out: PropEntry[] = [];
  if (props === null || typeof props !== "object" || tools === undefined) return out;
  const { create, dispose, run, setActiveSub } = tools;
  // Getters may render (a JSX prop): whatever they create goes with this owner, unrecorded.
  const owner = create(undefined);
  const prevSub = setActiveSub(undefined);
  s.paused++;
  try {
    for (const key of Object.keys(props)) {
      if (key.startsWith("$$")) continue;
      if (key === "children") {
        out.push({ key, kind: "children" });
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(props, key)!;
      try {
        const value =
          descriptor.get === undefined
            ? descriptor.value
            : run(owner, () => descriptor.get!.call(props));
        out.push({ key, kind: "value", value });
      } catch (error) {
        out.push({ key, kind: "error", value: error });
      }
    }
  } finally {
    s.paused--;
    setActiveSub(prevSub);
    try {
      dispose(owner);
    } catch {
      // A cleanup of something a getter created threw: not the app's concern.
    }
  }
  return out;
}

function connected(nodes: Node[]): boolean {
  for (const node of nodes) if (node.isConnected) return true;
  return false;
}

/** Whether a component is still on the page; prunes its dead children on the way. */
function alive(record: ComponentRecord): boolean {
  record.children = record.children.filter(alive);
  if (record.nodes.length > 0) return connected(record.nodes);
  return record.children.length > 0 || record.reactive.some((r) => r.host?.isConnected);
}

function prune(s: State): void {
  s.roots = s.roots.filter(alive);
  s.islands = s.islands.filter((island) => {
    const keep = island.start === undefined || island.start.isConnected;
    if (!keep && s.islandsById.get(island.id) === island) s.islandsById.delete(island.id);
    return keep;
  });
}
