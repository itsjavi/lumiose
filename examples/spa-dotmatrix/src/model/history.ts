// Undo and redo by snapshots: songs are small, so each edit stores a plain copy of the song
// before it. Consecutive edits with the same key (dragging a slider) merge into one step.
export interface History<T> {
  push(before: T, label: string, key?: string): void;
  undo(current: T): { state: T; label: string } | undefined;
  redo(current: T): { state: T; label: string } | undefined;
  clear(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}

const LIMIT = 200;
const MERGE_MS = 1200;

export function createHistory<T>(onChange: () => void = () => {}): History<T> {
  let past: { state: T; label: string; key?: string; at: number }[] = [];
  let future: { state: T; label: string }[] = [];
  return {
    push(before, label, key) {
      const last = past.at(-1);
      const now = Date.now();
      future = [];
      if (key && last?.key === key && now - last.at < MERGE_MS) {
        last.at = now;
      } else {
        past.push({ state: before, label, key, at: now });
        if (past.length > LIMIT) past = past.slice(-LIMIT);
      }
      onChange();
    },
    undo(current) {
      const entry = past.pop();
      if (!entry) return undefined;
      future.push({ state: current, label: entry.label });
      onChange();
      return { state: entry.state, label: entry.label };
    },
    redo(current) {
      const entry = future.pop();
      if (!entry) return undefined;
      past.push({ state: current, label: entry.label, at: 0 });
      onChange();
      return { state: entry.state, label: entry.label };
    },
    clear() {
      past = [];
      future = [];
      onChange();
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
}
