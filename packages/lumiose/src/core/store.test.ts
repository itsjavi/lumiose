import { describe, expect, it } from "vitest";
import { computed, effect, flushSync, snapshot, store } from "./index.ts";

/** Counts the runs of an effect that reads `fn`, and records the values it saw. */
function watch<T>(fn: () => T): { runs: () => number; values: T[] } {
  const values: T[] = [];
  effect(() => {
    values.push(fn());
  });
  flushSync();
  return { runs: () => values.length, values };
}

describe("store", () => {
  it("tracks properties individually", () => {
    const state = store({ a: 1, b: 1 });
    const a = watch(() => state.a);
    state.b = 2;
    flushSync();
    expect(a.runs()).toBe(1);
    state.a = 2;
    flushSync();
    expect(a.values).toEqual([1, 2]);
  });

  it("does not notify when a write keeps the value", () => {
    const state = store({ a: 1 });
    const a = watch(() => state.a);
    state.a = 1;
    flushSync();
    expect(a.runs()).toBe(1);
  });

  it("is deep and returns a stable proxy per object", () => {
    const state = store({ user: { name: "Ada", tags: ["x"] } });
    expect(state.user).toBe(state.user);
    expect(store(state)).toBe(state);
    const name = watch(() => state.user.name);
    state.user.name = "Grace";
    flushSync();
    expect(name.values).toEqual(["Ada", "Grace"]);
    const replaced = watch(() => state.user.name);
    state.user = { name: "Linus", tags: [] };
    flushSync();
    expect(replaced.values).toEqual(["Grace", "Linus"]);
  });

  it("stores raw values when assigned a proxy", () => {
    const a = store({ inner: { v: 1 } });
    const b = store({ inner: { v: 0 } });
    b.inner = a.inner;
    expect(b.inner).toBe(a.inner);
    const seen = watch(() => b.inner.v);
    a.inner.v = 2;
    flushSync();
    expect(seen.values).toEqual([1, 2]);
  });

  it("tracks added and deleted keys", () => {
    const state = store<Record<string, number>>({ a: 1 });
    const keys = watch(() => Object.keys(state).join(","));
    const has = watch(() => "b" in state);
    const missing = watch(() => state.c);
    state.b = 2;
    flushSync();
    expect(keys.values).toEqual(["a", "a,b"]);
    expect(has.values).toEqual([false, true]);
    state.c = 3;
    flushSync();
    expect(missing.values).toEqual([undefined, 3]);
    delete state.a;
    flushSync();
    expect(keys.values).toEqual(["a", "a,b", "a,b,c", "b,c"]);
  });

  it("supports array push, pop, splice, index writes and length", () => {
    const state = store({ items: [1, 2, 3] });
    const joined = watch(() => state.items.join(","));
    const length = watch(() => state.items.length);
    state.items.push(4);
    flushSync();
    state.items.splice(1, 2);
    flushSync();
    state.items[0] = 9;
    flushSync();
    state.items.pop();
    flushSync();
    state.items[3] = 7;
    flushSync();
    state.items.length = 0;
    flushSync();
    expect(joined.values).toEqual(["1,2,3", "1,2,3,4", "1,4", "9,4", "9", "9,,,7", ""]);
    expect(length.values).toEqual([3, 4, 2, 1, 4, 0]);
  });

  it("notifies readers of removed indices when the length shrinks", () => {
    const list = store([1, 2, 3]);
    const third = watch(() => list[2]);
    list.length = 1;
    flushSync();
    expect(third.values).toEqual([3, undefined]);
  });

  it("supports iteration and nested objects in arrays", () => {
    const todos = store([{ done: false }, { done: false }]);
    const remaining = computed(() => todos.filter((t) => !t.done).length);
    const seen = watch(remaining);
    todos[0]!.done = true;
    flushSync();
    todos.push({ done: false });
    flushSync();
    let total = 0;
    for (const todo of todos) total += todo.done ? 0 : 1;
    expect(total).toBe(2);
    expect(seen.values).toEqual([2, 1, 2]);
  });

  it("an effect that pushes does not subscribe to the array it writes", () => {
    const log = store<string[]>([]);
    const trigger = store({ n: 0 });
    let runs = 0;
    effect(() => {
      runs++;
      log.push(`n=${trigger.n}`);
    });
    flushSync();
    trigger.n = 1;
    flushSync();
    expect(runs).toBe(2);
    expect([...log]).toEqual(["n=0", "n=1"]);
  });

  it("returns non-plain objects as is", () => {
    const date = new Date(0);
    const frozen = Object.freeze({ a: 1 });
    expect(store(date)).toBe(date);
    expect(store(frozen)).toBe(frozen);
    const state = store({ date, frozen, map: new Map<string, number>() });
    expect(state.date).toBe(date);
    expect(state.frozen).toBe(frozen);
    expect(state.map).toBeInstanceOf(Map);
  });
});

describe("snapshot", () => {
  it("copies nested objects and arrays into plain data that structuredClone accepts", () => {
    const date = new Date(0);
    const song = store({ title: "a", rows: [[{ note: 1 }], [{ note: 2 }]], meta: { date } });
    const copy = snapshot(song);
    expect(copy).toEqual({ title: "a", rows: [[{ note: 1 }], [{ note: 2 }]], meta: { date } });
    expect(structuredClone(copy)).toEqual(copy);
    expect(() => structuredClone(song)).toThrow();
    // Values are copied; non-plain values are kept.
    expect(copy.rows).not.toBe(song.rows);
    expect(copy.meta.date).toBe(date);
    // A nested store value, and plain data holding store proxies.
    expect(structuredClone(snapshot(song.rows[1]!))).toEqual([{ note: 2 }]);
    expect(structuredClone(snapshot({ first: song.rows[0] }))).toEqual({ first: [{ note: 1 }] });
  });

  it("is not reactive: later writes do not change it, and it tracks nothing", () => {
    const state = store({ list: [1, 2], nested: { n: 1 } });
    const seen = watch(() => snapshot(state));
    const copy = snapshot(state);
    state.list.push(3);
    state.nested.n = 2;
    flushSync();
    expect(copy).toEqual({ list: [1, 2], nested: { n: 1 } });
    expect(seen.runs()).toBe(1);
    expect(snapshot(state)).toEqual({ list: [1, 2, 3], nested: { n: 2 } });
  });

  it("keeps shared and circular references", () => {
    const shared = { n: 1 };
    const raw: Record<string, unknown> = { a: shared, b: shared };
    raw.self = raw;
    const copy = snapshot(store(raw));
    expect(copy.a).toBe(copy.b);
    expect(copy.self).toBe(copy);
  });
});
