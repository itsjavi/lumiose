// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { effect, flush, signal } from "../core/index.ts";
import { createOwner, disposeOwner, runWithOwner, type Owner } from "../core/internal.ts";
import { attach, bind, bindChecked, bindProperty, bindValue, template, useRef } from "./index.ts";
import { ref } from "./public.ts";

function root(fn: () => void): Owner {
  const owner = createOwner(undefined);
  runWithOwner(owner, fn);
  return owner;
}

function type(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("bindValue", () => {
  it("binds text inputs and textareas both ways", () => {
    const input = document.createElement("input");
    const area = document.createElement("textarea");
    const text = signal("a");
    root(() => {
      bindValue(input, text);
      bindValue(area, text);
    });
    expect(input.value).toBe("a");
    type(input, "typed");
    expect(text()).toBe("typed");
    flush();
    expect(area.value).toBe("typed");
    text.set("set");
    flush();
    expect(input.value).toBe("set");
  });

  it("binds selects", () => {
    const select = template(`<select><option value=a>A<option value=b>B`)() as HTMLSelectElement;
    const choice = signal("b");
    root(() => bindValue(select, choice));
    expect(select.value).toBe("b");
    type(select, "a");
    expect(choice()).toBe("a");
  });

  it("uses valueAsNumber for number signals on number and range inputs", () => {
    for (const kind of ["number", "range"]) {
      const input = document.createElement("input");
      input.type = kind;
      const n = signal(3);
      root(() => bindValue(input, n));
      expect(input.value).toBe("3");
      type(input, "7");
      expect(n()).toBe(7);
      n.set(5);
      flush();
      expect(input.valueAsNumber).toBe(5);
    }
    const asText = document.createElement("input");
    asText.type = "number";
    const s = signal("1");
    root(() => bindValue(asText, s));
    type(asText, "2");
    expect(s()).toBe("2");
  });

  it("stops listening when disposed", () => {
    const input = document.createElement("input");
    const text = signal("a");
    const owner = root(() => bindValue(input, text));
    disposeOwner(owner);
    type(input, "b");
    expect(text()).toBe("a");
  });
});

describe("bindChecked", () => {
  it("binds checkboxes both ways", () => {
    const input = document.createElement("input");
    input.type = "checkbox";
    const on = signal(true);
    root(() => bindChecked(input, on));
    expect(input.checked).toBe(true);
    input.checked = false;
    input.dispatchEvent(new Event("change"));
    expect(on()).toBe(false);
    on.set(true);
    flush();
    expect(input.checked).toBe(true);
  });
});

describe("bindProperty", () => {
  // A light-DOM element like `lu-menu`: an `open` property and an `openchange` event.
  class TestMenu extends HTMLElement {
    open = false;
    toggle(): void {
      this.open = !this.open;
      this.dispatchEvent(new Event("openchange", { bubbles: true }));
    }
  }
  customElements.define("test-menu", TestMenu);

  it("sets the property and reads it back on the element's xchange, change and input events", () => {
    const menu = document.createElement("test-menu") as TestMenu;
    const open = signal(true);
    root(() => bindProperty(menu, "open", open));
    expect(menu.open).toBe(true);
    menu.toggle();
    expect(open()).toBe(false);
    open.set(true);
    flush();
    expect(menu.open).toBe(true);
    for (const name of ["change", "input"]) {
      menu.open = false;
      menu.dispatchEvent(new Event(name));
      expect(open(), name).toBe(false);
      open.set(true);
      flush();
    }
  });

  it("ignores the events of its children and stops listening when disposed", () => {
    const menu = document.createElement("test-menu") as TestMenu;
    const child = menu.appendChild(document.createElement("input"));
    const open = signal(false);
    const owner = root(() => bindProperty(menu, "open", open));
    menu.open = true;
    child.dispatchEvent(new Event("change", { bubbles: true }));
    expect(open()).toBe(false);
    disposeOwner(owner);
    menu.dispatchEvent(new Event("openchange"));
    expect(open()).toBe(false);
  });
});

describe("attach", () => {
  it("runs each attachment after mount in its own tracked scope, with cleanups", () => {
    const el = document.createElement("div");
    const log: string[] = [];
    const a = signal(1);
    const b = signal(1);
    const owner = root(() =>
      attach(el, () => [
        (node) => {
          log.push(`a${a()} ${node === el}`);
          return () => log.push(`a${a.peek()} cleanup`);
        },
        false,
        () => {
          log.push(`b${b()}`);
        },
      ]),
    );
    expect(log).toEqual([]);
    flush();
    expect(log).toEqual(["a1 true", "b1"]);
    a.set(2);
    flush();
    expect(log).toEqual(["a1 true", "b1", "a2 cleanup", "a2 true"]);
    disposeOwner(owner);
    expect(log.at(-1)).toBe("a2 cleanup");
  });

  it("restarts every attachment when the list changes", () => {
    const el = document.createElement("div");
    const log: string[] = [];
    const tooltip = signal(false);
    root(() =>
      attach(el, () => [
        () => {
          log.push("focus");
          return () => log.push("focus cleanup");
        },
        tooltip() &&
          (() => {
            log.push("tooltip");
          }),
      ]),
    );
    flush();
    tooltip.set(true);
    flush();
    expect(log).toEqual(["focus", "focus cleanup", "focus", "tooltip"]);
  });

  it("N attachments that measure, then write, share one render pass (decision-80)", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const log: string[] = [];
    const rows = Array.from({ length: 5 }, () => signal(10));
    const owner = root(() =>
      rows.forEach((height, i) => {
        const el = document.createElement("div");
        container.append(el);
        bind(el, height, (node, value) => {
          log.push(`write ${i}`);
          node.style.height = `${value}px`;
        });
        attach(el, () => [
          (node) => {
            // What a measurement would see: how many rows already show their new height.
            const updated = [...container.children].filter(
              (row) => (row as HTMLElement).style.height === "20px",
            );
            log.push(`measure ${i} ${(node as HTMLElement).style.height} ${updated.length}`);
            height.set(20);
          },
        ]);
      }),
    );
    log.length = 0;
    flush();
    expect(log).toEqual([
      ...rows.map((_, i) => `measure ${i} 10px 0`),
      ...rows.map((_, i) => `write ${i}`),
    ]);
    expect([...container.children].map((row) => (row as HTMLElement).style.height)).toEqual(
      rows.map(() => "20px"),
    );
    disposeOwner(owner);
    container.remove();
  });
});

describe("refs", () => {
  it("useRef calls the ref with the element; ref() reads like a signal", () => {
    const el = document.createElement("input");
    const input = ref<HTMLInputElement>();
    const seen: (HTMLInputElement | undefined)[] = [];
    root(() => effect(() => void seen.push(input())));
    flush();
    useRef(el, input as (el: Element) => void);
    useRef(el, undefined);
    flush();
    expect(input()).toBe(el);
    expect(seen).toEqual([undefined, el]);
  });
});

// The element changes the signal, then code writes the previous value back before the flush: the
// signal's net value is unchanged, and the element must still show it (TASK-388).
describe("two-way bindings: the previous value written back before the flush (TASK-388)", () => {
  it("bindValue applies it to a text input and a number input", () => {
    const input = document.createElement("input");
    const text = signal("a");
    const range = document.createElement("input");
    range.type = "range";
    const level = signal(3);
    root(() => {
      bindValue(input, text);
      bindValue(range, level);
    });
    type(input, "b");
    text.set("a");
    flush();
    expect(input.value).toBe("a");
    type(range, "7");
    level.set(3);
    flush();
    expect(range.valueAsNumber).toBe(3);
    // A plain edit is not written back over itself.
    type(input, "c");
    flush();
    expect(input.value).toBe("c");
  });

  it("bindChecked applies it", () => {
    const box = document.createElement("input");
    box.type = "checkbox";
    const on = signal(false);
    root(() => bindChecked(box, on));
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    on.set(false);
    flush();
    expect(box.checked).toBe(false);
  });

  it("bindProperty applies it", () => {
    const menu = document.createElement("test-menu") as HTMLElement & {
      open: boolean;
      toggle(): void;
    };
    const open = signal(false);
    root(() => bindProperty(menu, "open", open));
    menu.toggle();
    open.set(false);
    flush();
    expect(menu.open).toBe(false);
  });
});
