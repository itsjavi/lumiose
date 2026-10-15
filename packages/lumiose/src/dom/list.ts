// Keyed list for compiled `.map()` (contract doc-2 §2, spec §4.5, §6.3).
//
// Reconciliation: clear and create-all fast paths; common prefix and suffix trimming; a swap fast
// path (the ends crossed over); then, for what remains, unmatched rows are removed (via
// `textContent` when nothing is reused and the list owns its parent), new rows are created, and
// only rows outside the longest increasing subsequence of old positions are moved.
//
// Rows are setup-once. A row's owner is lazy (allocated only when the row registers a cleanup, an
// effect or a child owner), and its index signal exists only when `render` declares the parameter.
// A row whose key matches but whose item changed (possible only with a `key` function) is
// re-rendered in place, so it never shows a stale item.
import type { Renderable } from "../contract/client.ts";
import {
  disposeOwner,
  getOwner,
  renderEffect,
  runWithLazyOwner,
  type Owner,
} from "../core/internal.ts";
import { signal, type Signal } from "../core/signal.ts";
import { hydrator } from "./hydration.ts";
import { createRange, detach, lastOf, place, renderRange, type RangeStart } from "./insert.ts";
import { INSPECTED } from "./dev.ts";
import { labelValue } from "./devtools.ts";

interface Row<T> {
  item: T;
  key: unknown;
  /** The row's node, or the start of the range of a row that renders several nodes. */
  node: Node;
  owner: Owner | undefined;
  index: Signal<number> | undefined;
}

interface ListState<T> {
  parent: Node;
  marker: Node | null;
  /** The rows. Short internal names (`r`, `f`, `x`) keep the runtime small (TASK-176). */
  r: Row<T>[];
  /** The row render function. */
  f: (item: T, index: () => number) => Renderable;
  key: ((item: T) => unknown) | undefined;
  /** Whether `f` takes the index. */
  x: boolean;
  /** The list's binding: the parent of the row owners. */
  owner: Owner | undefined;
}

const EMPTY: readonly never[] = [];

// Arguments and results of `renderRow`, passed without a closure. A nested list overwrites them
// only after the outer call has read its arguments, and the outer call writes the results last.
let rowState: ListState<any> | undefined;
let rowItem: unknown;
let rowIndex: Signal<number> | undefined;
let rowNode: Node | undefined;

function renderRow(): void {
  const state = rowState!;
  const index = rowIndex;
  const value =
    index === undefined
      ? (state.f as (item: unknown) => Renderable)(rowItem)
      : state.f(rowItem, index);
  // One node, or a range (an async component); several nodes, text or dynamic content get a range.
  rowNode = value instanceof Node && value.nodeType !== 11 ? value : renderRange(value);
}

function createRow<T>(state: ListState<T>, item: T, key: unknown, i: number): Row<T> {
  const index = state.x ? signal(i) : undefined;
  if (import.meta.env?.DEV && INSPECTED && index !== undefined)
    labelValue(index, "list index", true);
  rowState = state;
  rowItem = item;
  rowIndex = index;
  const owner = runWithLazyOwner(state.owner, renderRow);
  const row: Row<T> = { item, key, node: rowNode!, owner, index };
  rowState = rowItem = rowIndex = rowNode = undefined;
  return row;
}

function insertRow(parent: Node, row: Row<unknown>, ref: Node | null): void {
  place(parent, row.node, ref);
}

function removeRow(parent: Node, row: Row<unknown>): void {
  if (row.owner !== undefined) {
    disposeOwner(row.owner);
  }
  detach(parent, row.node);
}

/** Whether row `i` is in `parent` right after row `i - 1` (hydration: a row that claimed its node). */
function inPlace(parent: Node, rows: Row<unknown>[], i: number): boolean {
  const node = rows[i]!.node;
  if (node.parentNode !== parent) {
    return false;
  }
  const prev = rows[i - 1];
  return prev === undefined || lastOf(prev.node).nextSibling === node;
}

/** Whether the rows (and the marker, if any) are all of `parent`'s children. */
function ownsParent(parent: Node, rows: Row<unknown>[], marker: Node | null): boolean {
  const last = rows[rows.length - 1]!;
  const lastNode = lastOf(last.node);
  return (
    parent.firstChild === rows[0]!.node &&
    (marker === null
      ? parent.lastChild === lastNode
      : parent.lastChild === marker && marker.previousSibling === lastNode)
  );
}

function disposeRows(rows: Row<unknown>[], from: number, to: number): void {
  for (let i = from; i <= to; i++) {
    const owner = rows[i]!.owner;
    if (owner !== undefined) {
      disposeOwner(owner);
    }
  }
}

/** Removes every row; through `textContent` when the list owns its parent. */
function clearAll(parent: Node, rows: Row<unknown>[], marker: Node | null): void {
  disposeRows(rows, 0, rows.length - 1);
  if (ownsParent(parent, rows, marker)) {
    parent.textContent = "";
    if (marker !== null) {
      parent.appendChild(marker);
    }
  } else {
    for (const row of rows) {
      detach(parent, row.node);
    }
  }
}

/** Indices (into `sources`) of a longest increasing subsequence of its non-negative entries. */
export function longestIncreasingSubsequence(sources: Int32Array): number[] {
  const predecessors = new Int32Array(sources.length);
  const result: number[] = [];
  for (let i = 0; i < sources.length; i++) {
    const value = sources[i]!;
    if (value < 0) {
      continue;
    }
    const length = result.length;
    if (length === 0 || sources[result[length - 1]!]! < value) {
      predecessors[i] = length === 0 ? -1 : result[length - 1]!;
      result.push(i);
      continue;
    }
    let lo = 0;
    let hi = length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sources[result[mid]!]! < value) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    if (value < sources[result[lo]!]!) {
      predecessors[i] = lo === 0 ? -1 : result[lo - 1]!;
      result[lo] = i;
    }
  }
  for (let i = result.length - 1, k = result[i]!; i >= 0; i--) {
    result[i] = k;
    k = predecessors[k]!;
  }
  return result;
}

function reconcile<T>(state: ListState<T>, items: readonly T[]): void {
  const a = state.r;
  const aLen = a.length;
  const bLen = items.length;
  const marker = state.marker;
  const parent = marker?.parentNode ?? state.parent;
  if (bLen === 0) {
    if (aLen !== 0) {
      state.r = [];
      clearAll(parent, a, marker);
    }
    return;
  }
  // Apply functions run with the list's binding as the current owner.
  state.owner ??= getOwner();
  const keyOf = state.key;
  const keys: readonly unknown[] = keyOf === undefined ? items : items.map(keyOf);
  const b: Row<T>[] = [];
  b.length = bLen;
  state.r = b;
  if (aLen === 0) {
    // Under hydration, rows that claimed their server nodes are already in place.
    const hydrating = hydrator !== undefined;
    for (let i = 0; i < bLen; i++) {
      const row = (b[i] = createRow(state, items[i]!, keys[i], i));
      if (!hydrating || !inPlace(parent, b, i)) {
        insertRow(parent, row, marker);
      }
    }
    return;
  }

  let aStart = 0;
  let bStart = 0;
  let aEnd = aLen - 1;
  let bEnd = bLen - 1;
  while (aStart <= aEnd && bStart <= bEnd) {
    const first = a[aStart]!;
    const last = a[aEnd]!;
    if (first.key === keys[bStart]) {
      b[bStart++] = first;
      aStart++;
    } else if (last.key === keys[bEnd]) {
      b[bEnd--] = last;
      aEnd--;
    } else if (aStart < aEnd && first.key === keys[bEnd] && last.key === keys[bStart]) {
      // Swap: the first and last rows crossed over.
      const after = lastOf(last.node).nextSibling;
      insertRow(parent, last, first.node);
      insertRow(parent, first, after);
      b[bStart++] = last;
      b[bEnd--] = first;
      aStart++;
      aEnd--;
    } else {
      break;
    }
  }

  if (aStart > aEnd) {
    // Only additions remain.
    const ref = bEnd + 1 < bLen ? b[bEnd + 1]!.node : marker;
    for (let j = bStart; j <= bEnd; j++) {
      insertRow(parent, (b[j] = createRow(state, items[j]!, keys[j], j)), ref);
    }
  } else if (bStart > bEnd) {
    // Only removals remain.
    for (let i = aStart; i <= aEnd; i++) {
      removeRow(parent, a[i]!);
    }
  } else {
    reconcileMiddle(state, parent, a, b, items, keys, aStart, aEnd, bStart, bEnd);
  }

  if (keyOf !== undefined) {
    for (let j = 0; j < bLen; j++) {
      const row = b[j]!;
      if (row.item !== items[j]) {
        const fresh = (b[j] = createRow(state, items[j]!, keys[j], j));
        insertRow(parent, fresh, row.node);
        removeRow(parent, row);
      }
    }
  }
  if (state.x) {
    for (let j = 0; j < bLen; j++) {
      b[j]!.index!.set(j);
    }
  }
}

function reconcileMiddle<T>(
  state: ListState<T>,
  parent: Node,
  a: Row<T>[],
  b: Row<T>[],
  items: readonly T[],
  keys: readonly unknown[],
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): void {
  const bLen = b.length;
  const marker = state.marker;
  const sources = new Int32Array(bEnd - bStart + 1).fill(-1);
  const positions = new Map<unknown, number>();
  for (let j = bStart; j <= bEnd; j++) {
    positions.set(keys[j], j);
  }
  let reused = 0;
  let moved = false;
  let last = -1;
  for (let i = aStart; i <= aEnd; i++) {
    const j = positions.get(a[i]!.key);
    if (j !== undefined && sources[j - bStart] === -1) {
      sources[j - bStart] = i;
      b[j] = a[i]!;
      reused++;
      if (j < last) {
        moved = true;
      } else {
        last = j;
      }
    }
  }
  if (reused === 0 && aStart === 0 && aEnd === a.length - 1) {
    // Replace all: nothing survives (no prefix or suffix either). New rows are appended in order:
    // inserting each row before the previous one would make the browser re-match positional
    // selectors (`tr:nth-of-type(odd)`) on every following row, once per insertion.
    clearAll(parent, a, marker);
    for (let j = bStart; j <= bEnd; j++) {
      insertRow(parent, (b[j] = createRow(state, items[j]!, keys[j], j)), marker);
    }
    return;
  }
  for (let i = aStart; i <= aEnd; i++) {
    const row = a[i]!;
    const j = positions.get(row.key);
    if (j === undefined || b[j] !== row) {
      removeRow(parent, row);
    }
  }
  const sequence = moved ? longestIncreasingSubsequence(sources) : undefined;
  let s = sequence === undefined ? -1 : sequence.length - 1;
  let ref = bEnd + 1 < bLen ? b[bEnd + 1]!.node : marker;
  for (let j = bEnd; j >= bStart; j--) {
    const k = j - bStart;
    let row = b[j];
    if (sources[k] === -1) {
      insertRow(parent, (row = b[j] = createRow(state, items[j]!, keys[j], j)), ref);
    } else if (moved) {
      if (s >= 0 && sequence![s] === k) {
        s--;
      } else {
        insertRow(parent, row!, ref);
      }
    }
    ref = row!.node;
  }
}

/** Removes adopted (server-rendered) nodes that no row claimed during hydration. */
function removeUnclaimed(adopted: Node[], rows: Row<unknown>[]): void {
  const claimed = new Set<Node>();
  for (const row of rows) {
    for (let node: Node | null = row.node; node !== null; node = node.nextSibling) {
      claimed.add(node);
      if (node === lastOf(row.node)) {
        break;
      }
    }
  }
  for (const node of adopted) {
    if (!claimed.has(node)) {
      node.parentNode?.removeChild(node);
    }
  }
}

function copyItems<T>(items: readonly T[] | null | undefined): readonly T[] {
  return items == null ? EMPTY : items.slice();
}

export function list<T>(
  parent: Node,
  marker: Node | null,
  source: () => readonly T[] | null | undefined,
  render: (item: T, index: () => number) => Renderable,
  key?: (item: T) => unknown,
): void {
  const state: ListState<T> = {
    parent,
    marker,
    r: [],
    f: render,
    key,
    x: render.length > 1,
    owner: undefined,
  };
  const h = hydrator;
  const adopted = h === undefined ? undefined : h.region(parent, marker);
  // The copy tracks every index of store arrays and makes in-place mutations visible.
  renderEffect(state, () => copyItems(source()), reconcile);
  if (adopted !== undefined) {
    removeUnclaimed(adopted, state.r);
    h!.end(adopted);
  }
}

/**
 * `list` without a parent element, for `.map()` the compiler cannot anchor to one: component
 * children, fragments and branches. Returns a range (a `Renderable` node) that `insert` places as a
 * unit; rows are reconciled before the range's end marker, wherever the range is, with the same
 * keyed reconciliation (clears remove rows one by one, since the parent holds other nodes).
 */
export function listValue<T>(
  source: () => readonly T[] | null | undefined,
  render: (item: T, index: () => number) => Renderable,
  key?: (item: T) => unknown,
): RangeStart {
  const start = createRange(1);
  const end = start.$$end;
  list(end.parentNode!, end, source, render, key);
  return start;
}
