import { describe, expect, it } from "vitest";
import { effect, flushSync, reconcile, snapshot, store } from "./index.ts";
import { reconcile as serverReconcile } from "./server.ts";

/** Counts the runs of an effect that reads `fn`. */
function runs(fn: () => unknown): () => number {
  let count = 0;
  effect(() => {
    fn();
    count++;
  });
  flushSync();
  return () => count;
}

interface Book {
  id: number;
  title: string;
  tags?: string[];
}

describe("reconcile", () => {
  it("keeps the identity of unchanged rows and notifies only changed fields", () => {
    const books = store<Book[]>([
      { id: 1, title: "Dune" },
      { id: 2, title: "Emma" },
    ]);
    const [first, second] = [books[0], books[1]];
    const title1 = runs(() => books[0]!.title);
    const title2 = runs(() => books[1]!.title);
    const row0 = runs(() => books[0]);
    const length = runs(() => books.length);

    reconcile(books, [
      { id: 1, title: "Dune" },
      { id: 2, title: "Emma (2nd ed.)" },
    ]);
    flushSync();

    expect(books[0]).toBe(first);
    expect(books[1]).toBe(second);
    expect(second!.title).toBe("Emma (2nd ed.)");
    expect(title1()).toBe(1);
    expect(row0()).toBe(1);
    expect(length()).toBe(1);
    expect(title2()).toBe(2);
  });

  it("moves, inserts and removes rows by key", () => {
    const books = store<Book[]>([
      { id: 1, title: "A" },
      { id: 2, title: "B" },
      { id: 3, title: "C" },
    ]);
    const [a, , c] = [books[0], books[1], books[2]];
    const keys = runs(() => Object.keys(books));
    reconcile(books, [
      { id: 3, title: "C" },
      { id: 4, title: "D" },
      { id: 1, title: "A" },
    ]);
    flushSync();
    expect(books[0]).toBe(c);
    expect(books[2]).toBe(a);
    expect(snapshot(books)).toEqual([
      { id: 3, title: "C" },
      { id: 4, title: "D" },
      { id: 1, title: "A" },
    ]);
    // Same length: the key set did not change.
    expect(keys()).toBe(1);

    reconcile(books, [{ id: 1, title: "A" }]);
    flushSync();
    expect(books.length).toBe(1);
    expect(books[0]).toBe(a);
    expect(keys()).toBe(2);
  });

  it("uses a custom key", () => {
    const rows = store([{ slug: "x", n: 1 }]);
    const row = rows[0];
    reconcile(
      rows,
      [
        { slug: "y", n: 0 },
        { slug: "x", n: 2 },
      ],
      { key: "slug" },
    );
    expect(rows[1]).toBe(row);
    expect(row!.n).toBe(2);
  });

  it("merges nested objects deeply and deletes removed keys", () => {
    const state = store<{
      user: { name: string; address: { city: string; zip?: string } };
      extra?: number;
    }>({ user: { name: "Ada", address: { city: "London", zip: "N1" } }, extra: 1 });
    const user = state.user;
    const address = state.user.address;
    const name = runs(() => state.user.name);
    const city = runs(() => state.user.address.city);
    const zip = runs(() => state.user.address.zip);
    const hasExtra = runs(() => "extra" in state);

    reconcile(state, { user: { name: "Ada", address: { city: "Paris" } } });
    flushSync();

    expect(state.user).toBe(user);
    expect(state.user.address).toBe(address);
    expect(snapshot(state)).toEqual({ user: { name: "Ada", address: { city: "Paris" } } });
    expect(name()).toBe(1);
    expect(city()).toBe(2);
    expect(zip()).toBe(2);
    expect(hasExtra()).toBe(2);
  });

  it("replaces primitives, non-plain values and objects with a different key", () => {
    const date = new Date(0);
    const state = store<{ n: number; s: string | null; when: Date; item: Book | number }>({
      n: 1,
      s: "a",
      when: new Date(1),
      item: { id: 1, title: "A" },
    });
    const n = runs(() => state.n);
    const oldItem = state.item;
    reconcile(state, { n: 1, s: null, when: date, item: { id: 2, title: "B" } });
    flushSync();
    expect(n()).toBe(1);
    expect(state.s).toBeNull();
    expect(state.when).toBe(date);
    expect(state.item).not.toBe(oldItem);
    expect((state.item as Book).id).toBe(2);
    reconcile(state, { n: 2, s: "b", when: date, item: 5 });
    expect(state.item).toBe(5);
    expect(state.n).toBe(2);
  });

  it("merges unkeyed items by index and keeps primitive arrays in place", () => {
    const state = store({ points: [{ x: 1 }, { x: 2 }], tags: ["a", "b"] });
    const [p0, p1] = [state.points[0], state.points[1]];
    const tags = state.tags;
    const x0 = runs(() => state.points[0]!.x);
    const tag1 = runs(() => state.tags[1]);
    reconcile(state, { points: [{ x: 1 }, { x: 3 }, { x: 4 }], tags: ["a", "c"] });
    flushSync();
    expect(state.points[0]).toBe(p0);
    expect(state.points[1]).toBe(p1);
    expect(p1!.x).toBe(3);
    expect(state.points.length).toBe(3);
    expect(state.tags).toBe(tags);
    expect(x0()).toBe(1);
    expect(tag1()).toBe(2);
  });

  it("works on a nested path of a store", () => {
    const state = store({ books: [{ id: 1, title: "A" }] as Book[], other: 1 });
    const book = state.books[0];
    reconcile(state.books, [
      { id: 1, title: "A", tags: ["new"] },
      { id: 2, title: "B" },
    ]);
    expect(state.books[0]).toBe(book);
    expect(book!.tags).toEqual(["new"]);
    expect(state.books.length).toBe(2);
    expect(state.other).toBe(1);
  });

  it("runs as one batch and does not track inside an effect", () => {
    const state = store({ a: 1, b: 1 });
    let seen: number[] = [];
    runs(() => seen.push(state.a + state.b));
    seen = [];
    const fresh = store({ n: 0 });
    let effectRuns = 0;
    effect(() => {
      effectRuns++;
      reconcile(state, { a: 2 + fresh.n, b: 2 });
    });
    flushSync();
    expect(seen).toEqual([4]);
    // The effect read nothing from `state`: writing to it does not re-run the effect.
    state.a = 10;
    flushSync();
    expect(effectRuns).toBe(1);
  });

  it("rejects data of a different kind", () => {
    expect(() => reconcile(store<unknown[]>([]), {} as unknown[])).toThrow(TypeError);
  });

  it("patches plain objects on the server", () => {
    const books: Book[] = [{ id: 1, title: "A" }];
    const first = books[0];
    serverReconcile(books, [
      { id: 2, title: "B" },
      { id: 1, title: "A2" },
    ]);
    expect(books[1]).toBe(first);
    expect(first!.title).toBe("A2");
  });
});
