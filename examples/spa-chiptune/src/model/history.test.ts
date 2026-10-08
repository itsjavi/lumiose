import { describe, expect, it } from "vitest";
import { createHistory } from "./history.ts";
import { getAt, setAt } from "./song.ts";
import type { Path } from "./types.ts";

function setup() {
  const data = { a: 1, list: [{ v: 1 }, { v: 2 }], name: "x" };
  const writes: [Path, unknown][] = [];
  let time = 0;
  const history = createHistory({
    read: (path) => getAt(data, path),
    write: (path, value) => {
      writes.push([path, value]);
      setAt(data, path, value);
    },
    now: () => time,
  });
  return { data, writes, history, tick: (ms: number) => (time += ms) };
}

describe("history", () => {
  it("undoes and redoes a transaction as one step", () => {
    const { data, history } = setup();
    history.transact("Two edits", () => {
      history.set(["a"], 5);
      history.set(["list", 1, "v"], 9);
    });
    expect(data).toMatchObject({ a: 5, list: [{ v: 1 }, { v: 9 }] });
    expect(history.canUndo()).toBe(true);
    expect(history.undo()?.label).toBe("Two edits");
    expect(data).toMatchObject({ a: 1, list: [{ v: 1 }, { v: 2 }] });
    expect(history.canRedo()).toBe(true);
    history.redo();
    expect(data).toMatchObject({ a: 5, list: [{ v: 1 }, { v: 9 }] });
  });

  it("skips no-op writes and snapshots object values", () => {
    const { data, writes, history } = setup();
    history.set(["a"], 1);
    expect(writes).toHaveLength(0);
    const item = { v: 7 };
    history.set(["list", 0], item);
    item.v = 8; // later mutation of the caller's object does not leak into history
    history.undo();
    history.redo();
    expect(data.list[0]).toEqual({ v: 7 });
  });

  it("merges same-key edits inside the window", () => {
    const { data, history, tick } = setup();
    for (const v of [2, 3, 4]) {
      history.transact("Drag", () => history.set(["a"], v), { key: "a" });
      tick(100);
    }
    expect(history.size()).toBe(1);
    history.undo();
    expect(data.a).toBe(1);
    history.redo();
    tick(5000);
    history.transact("Drag", () => history.set(["a"], 6), { key: "a" });
    expect(history.size()).toBe(2);
  });

  it("clears the redo stack on a new edit", () => {
    const { history } = setup();
    history.set(["a"], 2);
    history.undo();
    history.set(["name"], "y");
    expect(history.canRedo()).toBe(false);
  });
});
