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
} from "../core/internal.ts";
import { hydrator } from "./hydration.ts";

type Part = Node | string;
/** A resolved value: nothing, one text, one node, or a flat list. */
type Content = Part | Part[] | null;

export interface Region {
  parent: Node;
  marker: Node | null;
  /** The nodes rendered now, in document order. */
  nodes: Node[];
  /** Owner of the latest evaluation of a dynamic value; disposed before the next one. */
  owner: Owner | undefined;
}

export function createRegion(parent: Node, marker: Node | null): Region {
  return {
    parent,
    marker,
    nodes: hydrator === undefined ? [] : hydrator.region(parent, marker),
    owner: undefined,
  };
}

function isFragment(value: object): boolean {
  return (value as Node).nodeType === 11;
}

function flatten(value: Renderable, out: Part[]): void {
  while (typeof value === "function") {
    value = value();
  }
  if (value == null || typeof value === "boolean") {
    return;
  }
  if (typeof value !== "object") {
    out.push(String(value));
  } else if (Array.isArray(value)) {
    for (const item of value as readonly Renderable[]) {
      flatten(item, out);
    }
  } else if (isFragment(value)) {
    out.push(...Array.from((value as Node).childNodes));
  } else {
    out.push(value as Node);
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
  if (typeof value !== "object") {
    return String(value);
  }
  if (Array.isArray(value) || isFragment(value)) {
    const parts: Part[] = [];
    flatten(value as Renderable, parts);
    return parts;
  }
  return value as Node;
}

function hasFunction(value: readonly Renderable[]): boolean {
  for (const item of value) {
    if (typeof item === "function" || (Array.isArray(item) && hasFunction(item))) {
      return true;
    }
  }
  return false;
}

/** Replaces the region's nodes with `next`, keeping nodes present in both by identity. */
function reconcile(region: Region, next: Node[]): void {
  const current = region.nodes;
  const marker = region.marker;
  const parent = marker?.parentNode ?? region.parent;
  const last = current[current.length - 1];
  const after = marker ?? (last !== undefined ? last.nextSibling : null);
  region.nodes = next;
  if (current.length === 1 && next.length === 1) {
    const prev = current[0]!;
    const node = next[0]!;
    if (prev !== node) {
      if (prev.parentNode === parent) {
        parent.replaceChild(node, prev);
      } else {
        parent.insertBefore(node, after);
      }
    }
    return;
  }
  if (current.length !== 0) {
    const keep = next.length === 0 ? undefined : new Set(next);
    for (const node of current) {
      if (keep?.has(node) !== true && node.parentNode === parent) {
        parent.removeChild(node);
      }
    }
  }
  let ref = after;
  for (let i = next.length - 1; i >= 0; i--) {
    const node = next[i]!;
    if (node.nextSibling !== ref || node.parentNode !== parent) {
      parent.insertBefore(node, ref);
    }
    ref = node;
  }
}

/** Writes resolved content into the region (a `bind` apply function). */
function applyRegion(region: Region, content: Content): void {
  const current = region.nodes;
  if (typeof content === "string") {
    const first = current[0];
    if (current.length === 1 && first!.nodeType === 3) {
      (first as Text).data = content;
      return;
    }
    content = document.createTextNode(content);
  }
  if (content === null) {
    reconcile(region, []);
  } else if (Array.isArray(content)) {
    // Strings reuse the text node rendered at the same position, if any.
    const nodes = content as Node[];
    for (let i = 0; i < content.length; i++) {
      const part = content[i]!;
      if (typeof part === "string") {
        const prev = current[i];
        if (prev !== undefined && prev.nodeType === 3) {
          (prev as Text).data = part;
          nodes[i] = prev;
        } else {
          nodes[i] = document.createTextNode(part);
        }
      }
    }
    reconcile(region, nodes);
  } else if (current.length !== 1 || current[0] !== content) {
    reconcile(region, [content]);
  }
}

// Arguments of `runResolve`, passed without a closure. Nested calls overwrite them only after the
// outer call has read them, and the outer call writes `resolved` last.
let resolving: Renderable;
let resolved: Content;

function runResolve(): void {
  resolved = resolve(resolving);
}

/** Resolves a dynamic value under a fresh lazy owner, disposing the previous evaluation's owner. */
function evaluate(region: Region, value: Renderable): Content {
  const prev = region.owner;
  if (prev !== undefined) {
    region.owner = undefined;
    disposeOwner(prev);
  }
  resolving = value;
  // Inside a binding's compute, the current owner is the binding itself.
  region.owner = runWithLazyOwner(getOwner(), runResolve);
  const content = resolved;
  resolved = null;
  resolving = undefined;
  return content;
}

/** Renders `value` into `region`: tracked and reconciled when it is or contains a function. */
export function renderInto(region: Region, value: Renderable): void {
  if (typeof value === "function" || (Array.isArray(value) && hasFunction(value))) {
    renderEffect(region, () => evaluate(region, value), applyRegion);
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
    // Static text or node: no region to keep.
    if (value != null && typeof value !== "boolean") {
      parent.insertBefore(
        typeof value === "object" ? (value as Node) : document.createTextNode(String(value)),
        marker,
      );
    }
    return;
  }
  renderInto(createRegion(parent, marker), value);
}

// ---- branch --------------------------------------------------------------------------------------

interface BranchState extends Region {
  whenTrue: () => Renderable;
  whenFalse: (() => Renderable) | undefined;
  /** Owner of the active branch. */
  view: Owner | undefined;
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
  const prev = state.view;
  if (prev !== undefined) {
    state.view = undefined;
    disposeOwner(prev);
  }
  state.owner = undefined;
  branchState = state;
  branchView = on ? state.whenTrue : state.whenFalse;
  state.view = runWithLazyOwner(getOwner(), runBranch);
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
  const state = createRegion(parent, marker) as BranchState;
  state.whenTrue = whenTrue;
  state.whenFalse = whenFalse;
  state.view = undefined;
  renderEffect(state, () => !!cond(), applyBranch);
}
