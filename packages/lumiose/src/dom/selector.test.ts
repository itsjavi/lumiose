// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { computed, flushSync, signal } from "../core/index.ts";
import { createOwner, disposeOwner, runWithOwner } from "../core/internal.ts";
import { bind, list, selector, template, toggleClass } from "./index.ts";

const tTr = template(`<tr>`);

describe("selector", () => {
  it("re-runs only the bindings of the previous and the next key", () => {
    const selected = signal<number | undefined>(undefined);
    const owner = createOwner(undefined);
    const runs = new Map<number, number>();
    const tbody = document.createElement("tbody");
    const rows = signal(Array.from({ length: 100 }, (_, id) => ({ id })));
    runWithOwner(owner, () => {
      const isSelected = selector(selected);
      list(tbody, null, rows, (row) => {
        const tr = tTr();
        bind(
          tr,
          () => {
            runs.set(row.id, (runs.get(row.id) ?? 0) + 1);
            return isSelected(row.id);
          },
          (el, on) => toggleClass(el, "danger", on),
        );
        return tr;
      });
    });
    const total = (): number => [...runs.values()].reduce((a, b) => a + b, 0);
    expect(total()).toBe(100);
    selected.set(3);
    flushSync();
    expect(total()).toBe(101);
    expect(tbody.querySelectorAll(".danger")).toHaveLength(1);
    selected.set(42);
    flushSync();
    expect(total()).toBe(103);
    expect(runs.get(3)).toBe(3);
    expect(runs.get(42)).toBe(2);
    expect(tbody.children[42]!.className).toBe("danger");
    expect(tbody.children[3]!.className).toBe("");
    disposeOwner(owner);
  });

  it("reads the latest value synchronously and works untracked", () => {
    const selected = signal(1);
    const isSelected = selector(computed(() => selected() * 10));
    expect(isSelected(10)).toBe(true);
    selected.set(2);
    expect(isSelected(20)).toBe(true);
    expect(isSelected(10)).toBe(false);
  });

  it("drops a key's node when its last reader is disposed", () => {
    const selected = signal(0);
    const owner = createOwner(undefined);
    let isSelected!: (key: number) => boolean;
    const rows = signal([1, 2, 3]);
    const tbody = document.createElement("tbody");
    runWithOwner(owner, () => {
      isSelected = selector(selected);
      list(tbody, null, rows, (id) => {
        const tr = tTr();
        bind(
          tr,
          () => isSelected(id),
          (el, on) => toggleClass(el, "on", on),
        );
        return tr;
      });
    });
    // Rows 1-3 go: their bindings were the only readers of keys 1-3, whose nodes are dropped.
    const del = vi.spyOn(Map.prototype, "delete");
    rows.set([4]);
    flushSync();
    expect(del.mock.calls.map(([key]) => key).toSorted()).toEqual([1, 2, 3]);
    del.mockRestore();
    selected.set(4);
    flushSync();
    expect(tbody.firstElementChild!.className).toBe("on");
    // Old keys no longer notify anything: selecting 1 touches only row 4.
    selected.set(1);
    flushSync();
    expect(tbody.firstElementChild!.className).toBe("");
    disposeOwner(owner);
  });
});
