// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { effect, flushSync, signal } from "../core/index.ts";
import { createOwner, disposeOwner, runWithOwner, type Owner } from "../core/internal.ts";
import { attach, bindChecked, bindValue, template, useRef } from "./index.ts";
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
    flushSync();
    expect(area.value).toBe("typed");
    text.set("set");
    flushSync();
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
      flushSync();
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
    flushSync();
    expect(input.checked).toBe(true);
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
    flushSync();
    expect(log).toEqual(["a1 true", "b1"]);
    a.set(2);
    flushSync();
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
    flushSync();
    tooltip.set(true);
    flushSync();
    expect(log).toEqual(["focus", "focus cleanup", "focus", "tooltip"]);
  });
});

describe("refs", () => {
  it("useRef calls the ref with the element; ref() reads like a signal", () => {
    const el = document.createElement("input");
    const input = ref<HTMLInputElement>();
    const seen: (HTMLInputElement | undefined)[] = [];
    root(() => effect(() => void seen.push(input())));
    flushSync();
    useRef(el, input as (el: Element) => void);
    useRef(el, undefined);
    flushSync();
    expect(input()).toBe(el);
    expect(seen).toEqual([undefined, el]);
  });
});
