// Dynamic content: `insert` and `branch` (contract doc-2 §2, spec §4.5, §6.3).
//
// A region is the run of nodes a dynamic value occupies inside `parent`, just before `marker`
// (or at the end of `parent`). Its value is resolved to text, one node or a flat list of nodes,
// and reconciled against the nodes it rendered before: text nodes are updated in place, and nodes
// are kept, moved or removed by identity.
import type { Renderable } from "../contract/client.ts";
import {
  disposeOwner,
  getOwner,
  renderEffect,
  runWithLazyOwner,
  type Owner,
  type RenderEffect,
} from "../core/internal.ts";
import { setText } from "./attributes.ts";
import { hydrator } from "./hydration.ts";

/**
 * Text stays the value itself (a string, number or bigint), which the DOM converts to the same text
 * as `String()`. A converted string would stay alive as a region binding's last value (about 20
 * bytes per numeric child in Chrome), and converting integers grows V8's number-string cache by
 * about 64 kB once per page (TASK-267).
 */
type Part = Node | string | number | bigint;
/** A resolved value: nothing, one text, one node, or a flat list. */
type Content = Part | Part[] | null;

export interface Region {
  parent: Node;
  marker: Node | null;
  /** The nodes rendered now, in document order. */
  nodes: Node[];
  /** Owner of the latest evaluation of a dynamic value; disposed before the next one. */
  owner: Owner | undefined;
  /** The dynamic value rendered by the region's binding (read by `computeRegion`). */
  value: Renderable;
}

/** The initial `nodes` of every region; never mutated (regions replace their array). */
const NO_NODES: Node[] = [];

export function createRegion(parent: Node, marker: Node | null): Region {
  return {
    parent,
    marker,
    nodes: hydrator === undefined ? NO_NODES : hydrator.region(parent, marker),
    owner: undefined,
    value: undefined,
  };
}

/** Whether `value` is a document fragment (false for text: primitives have no `nodeType`). */
function isFragment(value: unknown): boolean {
  return (value as Node).nodeType === 11;
}

function flatten(value: Renderable, out: Part[]): void {
  while (typeof value === "function") {
    value = value();
  }
  if (value == null || typeof value === "boolean") {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value as readonly Renderable[]) {
      flatten(item, out);
    }
  } else if (isFragment(value)) {
    out.push(...Array.from((value as Node).childNodes));
  } else {
    out.push(value as Part);
  }
}

/** Calls nested functions (tracked by the caller's binding) and flattens arrays and fragments. */
function resolve(value: Renderable): Content {
  while (typeof value === "function") {
    value = value();
  }
  if (value == null || typeof value === "boolean") {
    return null;
  }
  if (Array.isArray(value) || isFragment(value)) {
    const parts: Part[] = [];
    flatten(value as Renderable, parts);
    return parts;
  }
  return value as Part;
}

function hasFunction(value: readonly Renderable[]): boolean {
  for (const item of value) {
    if (typeof item === "function" || (Array.isArray(item) && hasFunction(item))) {
      return true;
    }
  }
  return false;
}

// ---- ranges ---------------------------------------------------------------------------------------
// A range is a run of sibling nodes between two empty text nodes whose content changes on its own
// (async component instances, boundaries). Parents hold only its start node, which points to its
// end, and move or remove the whole run as a unit; content rendered into the range later goes
// before its end marker, wherever the range is at that time.

export interface RangeStart extends Text {
  $$end: Text;
}

/**
 * A new empty range inside a fragment of its own. Render into it with `end` as the marker.
 * Under hydration, `mode` makes it adopt server content (`Hydrator.range`): 1 claims the next
 * server block (`branchValue`, `listValue`, `<Suspense>`), 2 too but renders a `<!--[!-->` block
 * afresh (`<ErrorBoundary>`), 3 takes the rest of the enclosing region (boundary content). Without
 * a mode, content rendered into the range is created afresh.
 */
export function createRange(mode?: number): RangeStart {
  const start = document.createTextNode("") as RangeStart;
  const end = (start.$$end = document.createTextNode(""));
  document.createDocumentFragment().append(start, end);
  if (mode && hydrator !== undefined) {
    hydrator.range(start, mode);
  }
  return start;
}

/** A plain text node, which text content may reuse (a range's start is not one). */
function isText(node: Node | undefined): node is Text {
  return (
    node !== undefined && node.nodeType === 3 && (node as Partial<RangeStart>).$$end === undefined
  );
}

/** The last node of `node`'s range, or `node` itself. */
export function lastOf(node: Node): Node {
  return (node as Partial<RangeStart>).$$end ?? node;
}

/**
 * Inserts `node` (with its whole range) before `ref`. A range alone in a fragment of its own (a new
 * one, built off-document, or a detached one) goes in with that fragment: one insertion, however
 * many nodes it holds (TASK-522).
 */
export function place(parent: Node, node: Node, ref: Node | null): void {
  const end = (node as Partial<RangeStart>).$$end;
  if (end === undefined) {
    parent.insertBefore(node, ref);
    return;
  }
  const holder = node.parentNode;
  if (
    holder !== null &&
    holder !== parent &&
    holder.nodeType === 11 &&
    holder.firstChild === node &&
    holder.lastChild === end
  ) {
    parent.insertBefore(holder, ref);
    return;
  }
  let next: Node | null = node;
  while (next !== null) {
    const current: Node = next;
    next = current === end ? null : current.nextSibling;
    parent.insertBefore(current, ref);
  }
}

/** Removes `node`. A range moves into a fragment of its own, so it stays usable if kept alive. */
export function detach(parent: Node, node: Node): void {
  if ((node as Partial<RangeStart>).$$end === undefined) {
    parent.removeChild(node);
  } else {
    place(document.createDocumentFragment(), node, null);
  }
}

/** Replaces the region's nodes with `next`, keeping nodes present in both by identity. */
function reconcile(region: Region, next: Node[]): void {
  const current = region.nodes;
  const marker = region.marker;
  const parent = marker?.parentNode ?? region.parent;
  const last = current[current.length - 1];
  const after = marker ?? (last !== undefined ? lastOf(last).nextSibling : null);
  region.nodes = next;
  if (current.length === 1 && next.length === 1) {
    const prev = current[0]!;
    const node = next[0]!;
    if (prev !== node) {
      if (prev.parentNode === parent) {
        if (lastOf(prev) === prev && lastOf(node) === node) {
          parent.replaceChild(node, prev);
          return;
        }
        detach(parent, prev);
      }
      place(parent, node, after);
    }
    return;
  }
  if (current.length !== 0) {
    const keep = next.length === 0 ? undefined : new Set(next);
    for (const node of current) {
      if (keep?.has(node) !== true && node.parentNode === parent) {
        detach(parent, node);
      }
    }
  }
  let ref = after;
  for (let i = next.length - 1; i >= 0; i--) {
    const node = next[i]!;
    if (lastOf(node).nextSibling !== ref || node.parentNode !== parent) {
      place(parent, node, ref);
    }
    ref = node;
  }
}

/** Content that a nested effect renders (see `runResolve`); the outer effect writes nothing. */
const NESTED = [] as Content;

/** Writes resolved content into the region (a `bind` apply function). */
function applyRegion(region: Region, content: Content): void {
  if (content === NESTED) {
    return;
  }
  const current = region.nodes;
  if (typeof content !== "object") {
    const first = current[0];
    if (current.length === 1 && isText(first)) {
      first.data = content as string;
      return;
    }
    content = document.createTextNode(content as string);
    if (current.length === 0) {
      // First text of a dynamic text child (the common case): no reconciliation needed.
      region.nodes = [content];
      const marker = region.marker;
      (marker?.parentNode ?? region.parent).insertBefore(content, marker);
      return;
    }
  }
  if (content === null) {
    reconcile(region, []);
  } else if (Array.isArray(content)) {
    // Text reuses the text node rendered at the same position, if any.
    const nodes = content as Node[];
    for (let i = 0; i < content.length; i++) {
      const part = content[i]!;
      if (typeof part !== "object") {
        const prev = current[i];
        if (isText(prev)) {
          prev.data = part as string;
          nodes[i] = prev;
        } else {
          nodes[i] = document.createTextNode(part as string);
        }
      }
    }
    reconcile(region, nodes);
  } else if (current.length !== 1 || current[0] !== content) {
    reconcile(region, [content]);
  }
}

/** Holds the owner of an effect's latest evaluation (the region itself for its top effect). */
interface Scope {
  owner: Owner | undefined;
}

// Arguments of `runResolve`, passed without a closure. Nested calls overwrite them only after the
// outer call has read them, and the outer call writes `resolved` last.
let resolving: Renderable;
let resolvingRegion: Region | undefined;
let resolved: Content;

function isDynamic(value: Renderable): boolean {
  return typeof value === "function" || (Array.isArray(value) && hasFunction(value));
}

function runResolve(): void {
  let value = resolving;
  const region = resolvingRegion!;
  if (typeof value === "function") {
    value = value();
    if (isDynamic(value)) {
      // The function returned reactive content, such as a component's output from a `children`
      // getter. It gets an effect of its own, so its updates never call this function again
      // (which would create the component again).
      renderNested(region, value);
      resolved = NESTED;
      return;
    }
  }
  resolved = resolve(value);
}

/** Resolves a dynamic value under a fresh lazy owner, disposing the previous evaluation's owner. */
function evaluate(region: Region, scope: Scope, value: Renderable): Content {
  const prev = scope.owner;
  if (prev !== undefined) {
    scope.owner = undefined;
    disposeOwner(prev);
  }
  resolving = value;
  resolvingRegion = region;
  // Inside a binding's compute, the current owner is the binding itself.
  scope.owner = runWithLazyOwner(getOwner(), runResolve);
  const content = resolved;
  resolved = null;
  resolving = resolvingRegion = undefined;
  return content;
}

function renderNested(region: Region, value: Renderable): void {
  const scope: Scope = { owner: undefined };
  renderEffect(region, () => evaluate(region, scope, value), applyRegion);
}

/** A region binding's compute: `bind` calls it as a method of the binding, whose target is the region. */
function computeRegion(this: RenderEffect<Content, Region>): Content {
  const region = this.target;
  return evaluate(region, region, region.value);
}

/** Renders `value` into `region`: tracked and reconciled when it is or contains a function. */
export function renderInto(region: Region, value: Renderable): void {
  if (isDynamic(value)) {
    region.value = value;
    renderEffect(region, computeRegion, applyRegion);
  } else {
    applyRegion(region, resolve(value));
  }
}

/** Removes everything the region rendered. */
export function clearRegion(region: Region): void {
  reconcile(region, []);
}

export function insert(parent: Node, value: Renderable, marker: Node | null = null): void {
  if (
    hydrator === undefined &&
    typeof value !== "function" &&
    !(typeof value === "object" && value !== null && (Array.isArray(value) || isFragment(value)))
  ) {
    // Static text, node or range: no region to keep.
    if (value != null && typeof value !== "boolean") {
      place(
        parent,
        typeof value === "object" ? (value as Node) : document.createTextNode(value as string),
        marker,
      );
    }
    return;
  }
  const h = hydrator;
  const region = createRegion(parent, marker);
  const adopted = region.nodes;
  renderInto(region, value);
  h?.end(adopted);
}

// ---- insertText ----------------------------------------------------------------------------------
// A child that is probably text but not provably (`{id}`, `{row.label()}`) gets a text node in the
// template, like a provable one, and `insertText` writes it: strings and numbers set its data with
// no region, and only another kind of value falls back to `insert` semantics.

/** The `insert` region of a text node that fell back, and the owner of what it rendered. */
interface TextFallback {
  r: Region;
  o: Owner | undefined;
}

/**
 * Writes a maybe-text child into its template text node: a string or number sets its data,
 * nullish or a boolean empties it, a function is bound once (each value applied the same way),
 * and anything else (a node, an array, a nested function) renders like `insert` in a region before
 * the text node, which stays empty from then on. Under hydration the template walk has claimed the
 * text node; a fallback region claims the server's block instead.
 */
export function insertText(node: Text & { $$t?: TextFallback }, value: Renderable): void {
  if (hydrator?.block(node)) {
    // The server rendered a block here (a node, not text): open its region before the value is
    // evaluated, so what the value claims while it renders (a router outlet's range, a component)
    // comes from that block, as with `insert` (TASK-144).
    node.$$t = { r: createRegion(node.parentNode!, node), o: undefined };
  }
  if (typeof value === "function") {
    renderEffect(node, value, applyText);
  } else {
    applyText(node, value);
  }
}

function applyText(node: Text & { $$t?: TextFallback }, value: Renderable): void {
  let fallback = node.$$t;
  if (fallback === undefined) {
    if (value == null || (typeof value !== "object" && typeof value !== "function")) {
      setText(node, value);
      return;
    }
    node.data = "";
    fallback = node.$$t = { r: createRegion(node.parentNode!, node), o: undefined };
  } else if (fallback.o !== undefined) {
    disposeOwner(fallback.o);
  }
  // Under hydration, the server nodes the region adopted (as in `insert`).
  const region = fallback.r;
  const adopted = region.nodes;
  fallback.o = runWithLazyOwner(getOwner(), () => renderInto(region, value));
  hydrator?.end(adopted);
}

/**
 * Renders `value` (tracked like `insert`) into a new range; returns its start. Parent regions see
 * one static node, so changes inside never re-run them. `mode` is the hydration mode of
 * `createRange`.
 */
export function renderRange(value: Renderable, mode?: number): RangeStart {
  const start = createRange(mode);
  const end = start.$$end;
  insert(end.parentNode!, value, end);
  return start;
}

/**
 * Parentless `insert`, for the dynamic items of fragments and component children (doc-2 §2):
 * renders `value` (tracked like `insert`) into a new range that the consumer places as one node.
 * Under hydration the range claims the next server block, the one the server's `insert` wrote.
 */
export function insertValue(value: Renderable): RangeStart {
  return renderRange(value, 1);
}

// ---- branch --------------------------------------------------------------------------------------

interface BranchState extends Region {
  /** `whenTrue`, `whenFalse` (short internal names keep the runtime small, TASK-176). */
  t: () => Renderable;
  f: (() => Renderable) | undefined;
  /** Owner of the active branch. */
  w: Owner | undefined;
}

let branchState: BranchState | undefined;
let branchView: (() => Renderable) | undefined;

function runBranch(): void {
  const state = branchState!;
  const view = branchView;
  // The view function itself is rendered, so reads inside it are tracked by its own binding.
  renderInto(state, view === undefined ? null : view);
}

function applyBranch(state: BranchState, on: boolean): void {
  // Under hydration, the server must have rendered the same side.
  hydrator?.branch(state.nodes, on);
  const prev = state.w;
  if (prev !== undefined) {
    state.w = undefined;
    disposeOwner(prev);
  }
  state.owner = undefined;
  branchState = state;
  branchView = on ? state.t : state.f;
  state.w = runWithLazyOwner(getOwner(), runBranch);
  branchState = branchView = undefined;
}

/** Memoised on `!!cond()`: a flip disposes the active branch and renders the other one. */
export function branch(
  parent: Node,
  marker: Node | null,
  cond: () => unknown,
  whenTrue: () => Renderable,
  whenFalse?: () => Renderable,
): void {
  const h = hydrator;
  const state = createRegion(parent, marker) as BranchState;
  const adopted = state.nodes;
  state.t = whenTrue;
  state.f = whenFalse;
  state.w = undefined;
  renderEffect(state, () => !!cond(), applyBranch);
  h?.end(adopted);
}

/**
 * `branch` without a parent element, for conditionals the compiler cannot anchor to one: component
 * children, fragments and nested ternaries. Returns a range (a `Renderable` node) that `insert`
 * places as a unit; the branch renders before the range's end marker, wherever the range is, with
 * the same memoisation on `!!cond()`.
 */
export function branchValue(
  cond: () => unknown,
  whenTrue: () => Renderable,
  whenFalse?: () => Renderable,
): RangeStart {
  const start = createRange(1);
  const end = start.$$end;
  branch(end.parentNode!, end, cond, whenTrue, whenFalse);
  return start;
}
