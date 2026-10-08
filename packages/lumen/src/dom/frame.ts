// Instance paths for await replay (spec §4.4 "Replay keys", contract doc-2 §4).
//
// While an island hydrates, each component instance gets a frame with its island-relative
// creation path (`0`, `0.2`, `0.2.1`, …), numbered like the server numbers its frames: the island
// root is `0`, and each instance numbers the components created during its body in order,
// including those created after an `await` (the run restores its frame). The first run of an async
// instance then looks up `instancePath:site:occurrence` in the island's recorded awaits instead of
// evaluating the awaited expression. Outside hydration no frame exists, and `createComponent`
// pays a single `undefined` check.

/**
 * The recorded value of an await, boxed, or `undefined` to evaluate the expression (a miss).
 * Installed per island by `lumen/dom/hydrate` (TASK-18), which also reports mismatches.
 */
export type AwaitReplay = (key: string) => { value: unknown } | undefined;

export interface Frame {
  readonly path: string;
  /** Child instances created so far. */
  children: number;
  readonly replay: AwaitReplay;
  /** Per-site await counters of the instance's first run. */
  occurrences: number[] | undefined;
}

export let frame: Frame | undefined;

/** Sets the current frame; returns the previous one. */
export function setFrame(next: Frame | undefined): Frame | undefined {
  const prev = frame;
  frame = next;
  return prev;
}

/** The frame of the next component instance created under `parent`. */
export function childFrame(parent: Frame): Frame {
  const index = parent.children++;
  return {
    path: parent.path === "" ? `${index}` : `${parent.path}.${index}`,
    children: 0,
    replay: parent.replay,
    occurrences: undefined,
  };
}

/**
 * Runs `fn`, which renders an island's root component, with instance paths and await replay on.
 * The first component created inside gets path `0`.
 */
export function withIsland<T>(replay: AwaitReplay, fn: () => T): T {
  const prev = setFrame({ path: "", children: 0, replay, occurrences: undefined });
  try {
    return fn();
  } finally {
    frame = prev;
  }
}
