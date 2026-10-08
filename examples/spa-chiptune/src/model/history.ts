// Undo/redo as path patches. Every song edit is a list of { path, before, after } patches; undo
// writes the befores back in reverse, redo the afters. The same writes keep the audio engine in sync,
// because they all go through `write`.
import { batch, computed, signal } from "lumen";
import { clone } from "./song.ts";
import type { Path } from "./types.ts";

export interface Patch {
  path: Path;
  before: unknown;
  after: unknown;
}

export interface Entry<M = unknown> {
  label: string;
  patches: Patch[];
  /** Consecutive edits with the same key (a slider drag, a macro stroke) merge into one entry. */
  key?: string;
  /** Caller data restored on undo/redo, such as the cursor position. */
  meta?: M;
  time: number;
}

export interface HistoryOptions {
  read(path: Path): unknown;
  write(path: Path, value: unknown): void;
  limit?: number;
  /** How long an entry stays open for merging same-key edits. */
  coalesceMs?: number;
  now?: () => number;
}

const same = (a: unknown, b: unknown): boolean =>
  Object.is(a, b) ||
  (typeof a === "object" && typeof b === "object" && JSON.stringify(a) === JSON.stringify(b));

const pathKey = (path: Path): string => path.join("/");

export function createHistory<M = unknown>(options: HistoryOptions) {
  const { read, write, limit = 500, coalesceMs = 1500, now = () => Date.now() } = options;
  const past: Entry<M>[] = [];
  const future: Entry<M>[] = [];
  const version = signal(0);
  let open: Patch[] | null = null;

  const changed = () => version.update((v) => v + 1);

  function commit(label: string, patches: Patch[], key: string | undefined, meta: M | undefined) {
    if (patches.length === 0) return;
    const last = past[past.length - 1];
    const time = now();
    if (key !== undefined && last?.key === key && time - last.time < coalesceMs) {
      for (const patch of patches) {
        const existing = last.patches.find((p) => pathKey(p.path) === pathKey(patch.path));
        if (existing) existing.after = patch.after;
        else last.patches.push(patch);
      }
      last.time = time;
    } else {
      past.push({ label, patches, key, meta, time });
      if (past.length > limit) past.shift();
    }
    future.length = 0;
    changed();
  }

  return {
    /** Sets a value at `path`, recording it in the open transaction (or as its own entry). */
    set(path: Path, value: unknown): void {
      const before = clone(read(path));
      if (same(before, value)) return;
      const after = clone(value);
      write(path, clone(after));
      const patch = { path: [...path], before, after };
      if (open) open.push(patch);
      else commit("Edit", [patch], undefined, undefined);
    },

    /** Runs `fn` as one undoable step. Nested calls join the outer step. */
    transact(label: string, fn: () => void, step: { key?: string; meta?: M } = {}): void {
      if (open) {
        fn();
        return;
      }
      const patches: Patch[] = (open = []);
      try {
        batch(fn);
      } finally {
        open = null;
        commit(label, patches, step.key, step.meta);
      }
    },

    undo(): Entry<M> | undefined {
      const entry = past.pop();
      if (!entry) return undefined;
      batch(() => {
        for (let i = entry.patches.length - 1; i >= 0; i--) {
          const patch = entry.patches[i]!;
          write(patch.path, clone(patch.before));
        }
      });
      future.push(entry);
      changed();
      return entry;
    },

    redo(): Entry<M> | undefined {
      const entry = future.pop();
      if (!entry) return undefined;
      batch(() => {
        for (const patch of entry.patches) write(patch.path, clone(patch.after));
      });
      past.push(entry);
      changed();
      return entry;
    },

    clear(): void {
      past.length = 0;
      future.length = 0;
      changed();
    },

    /** Closes the merge window so the next same-key edit starts a new entry. */
    seal(): void {
      const last = past[past.length - 1];
      if (last) last.time = -Infinity;
    },

    canUndo: computed(() => (version(), past.length > 0)),
    canRedo: computed(() => (version(), future.length > 0)),
    undoLabel: computed(() => (version(), past[past.length - 1]?.label)),
    redoLabel: computed(() => (version(), future[future.length - 1]?.label)),
    size: computed(() => (version(), past.length)),
  };
}

export type History<M = unknown> = ReturnType<typeof createHistory<M>>;
