// Instance paths for await replay (spec §4.4 "Replay keys", contract doc-2 §4).
//
// While an island hydrates, each component instance gets a frame with its island-relative
// creation path (`0`, `0.2`, `0.2.1`, …), numbered like the server numbers its frames: the island
// root is `0`, and each instance numbers the components created during its body in order,
// including those created after an `await` (the run restores its frame). The first run of an async
// instance then looks up `instancePath:site:occurrence` in the island's recorded awaits instead of
// evaluating the awaited expression. Outside hydration no frame exists, and `createComponent`
// pays a single `undefined` check; bundles without islands hydration contain no frame code at all
// (see `setFrame`).
//
// Frames also carry the hydration cursor (./hydration.ts): `lumiose/dom/hydrate` hooks `setFrame` to
// install it, so an async run's continuation claims nodes from its own server block after each
// `await`. Without that import the hook stays unset and bundlers drop the claiming paths.
import type { Hydrator } from "./hydration.ts";

/**
 * The recorded value of an await, boxed, or `undefined` to evaluate the expression (a miss).
 * Installed per island by `lumiose/dom/hydrate`, which also reports misses in development. It runs
 * while the async run is active, so it can evaluate `thunk` for the reads the run must track.
 */
export type AwaitReplay = (key: string, thunk: () => unknown) => { value: unknown } | undefined;

export interface Frame {
  readonly path: string;
  /** Child instances created so far. */
  children: number;
  readonly replay: AwaitReplay;
  /** Per-site await counters of the instance's first run. */
  occurrences: number[] | undefined;
  /** The claim cursor; undefined when the island renders afresh (a mismatch fallback). */
  readonly h: Hydrator | undefined;
}

export let frame: Frame | undefined;

let onFrame: ((next: Frame | undefined) => void) | undefined;

/** Called by `lumiose/dom/hydrate` with what to run whenever the current frame changes. */
export function setFrameHook(hook: (next: Frame | undefined) => void): void {
  onFrame = hook;
}

/**
 * Sets the current frame (installing its cursor under hydration); returns the previous one.
 * Installed by the first `withIsland`, the only source of frames, so callers use `setFrame?.()`:
 * bundles without islands hydration never assign `frame` nor `setFrame`, and bundlers fold both to
 * `undefined` and drop instance paths and await replay.
 */
export let setFrame: ((next: Frame | undefined) => Frame | undefined) | undefined;

/** The frame of the next component instance created under `parent`; `h` overrides its cursor. */
export function childFrame(parent: Frame, h: Hydrator | undefined = parent.h): Frame {
  const index = parent.children++;
  return {
    path: parent.path === "" ? `${index}` : `${parent.path}.${index}`,
    children: 0,
    replay: parent.replay,
    occurrences: undefined,
    h,
  };
}

/**
 * Runs `fn`, which renders an island's root component, with instance paths, await replay and the
 * claim cursor `h` on. The first component created inside gets path `0`.
 */
export function withIsland<T>(replay: AwaitReplay, h: Hydrator | undefined, fn: () => T): T {
  const set = (setFrame ??= (next) => {
    const prev = frame;
    frame = next;
    onFrame?.(next);
    return prev;
  });
  const prev = set({ path: "", children: 0, replay, occurrences: undefined, h });
  try {
    return fn();
  } finally {
    set(prev);
  }
}
