// `selector(source)`: O(1) selection checks for compiled `item.key === sig()` inside `.map`
// (contract doc-2 §2, spec §4.5, §6.3).
import {
  activeSub,
  getOwner,
  MUTABLE,
  renderEffect,
  runWithOwner,
  track,
  trigger,
  type TriggerNode,
} from "../core/internal.ts";
import { untrack } from "../core/reactive.ts";

interface KeyNode extends TriggerNode {
  key: unknown;
}

interface SelectorState {
  nodes: Map<unknown, KeyNode>;
  value: unknown;
}

/** Re-notifies only the readers of the previous and the next key. */
function notifySelection(state: SelectorState, value: unknown): void {
  const nodes = state.nodes;
  const prev = nodes.get(state.value);
  state.value = value;
  if (prev !== undefined) {
    trigger(prev);
  }
  const next = nodes.get(value);
  if (next !== undefined) {
    trigger(next);
  }
}

/**
 * Returns `isSelected(key)`. Each tracked reader depends on its key's node only, so a change of
 * `source` re-runs the bindings of two keys. A key's node is dropped when its last reader goes.
 * `source` first runs when a row reaches the comparison: the compiler creates the selector at the
 * component's top, and a comparison in a branch that never runs must not evaluate it (TASK-402).
 */
export function selector<T>(source: () => T): (key: T) => boolean {
  const nodes = new Map<unknown, KeyNode>();
  const drop = (node: TriggerNode): void => {
    nodes.delete((node as KeyNode).key);
  };
  const owner = getOwner();
  let watching = false;
  return (key: T): boolean => {
    if (activeSub !== undefined) {
      if (!watching) {
        // The effect belongs to the selector's owner, not to the first row that reads it.
        watching = true;
        runWithOwner(owner, () =>
          renderEffect<SelectorState, T>({ nodes, value: undefined }, source, notifySelection),
        );
      }
      let node = nodes.get(key);
      if (node === undefined) {
        nodes.set(
          key,
          (node = { subs: undefined, subsTail: undefined, flags: MUTABLE, key, unwatched: drop }),
        );
      }
      track(node);
    }
    // Reads are synchronous: compare with the latest value, not the last notified one.
    return Object.is(key, untrack(source));
  };
}
