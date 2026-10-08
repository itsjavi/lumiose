// A writable view over any state, usable with `bind:value` / `bind:checked` (which take anything
// shaped like a signal: a getter with `set`).
export interface Lens<T> {
  (): T;
  set(value: T): void;
}

export function lens<T>(get: () => T, set: (value: T) => void): Lens<T> {
  const read = (() => get()) as Lens<T>;
  read.set = set;
  return read;
}
