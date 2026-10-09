// @vitest-environment happy-dom
// Component-level hot updates (TASK-146): `$hot` keeps one wrapper per component across module
// versions, and only the instances of a changed component re-render.
import { describe, expect, it, vi } from "vitest";
import { flushSync, signal } from "../core/index.ts";
import { $hot, $hotAccept } from "./hot.ts";
import { bind, createComponent, mount } from "./index.ts";

function hotContext() {
  return { data: {} as Record<string, unknown>, invalidate: vi.fn() };
}

const Plain = () => null;

/** A sibling with DOM state the user edits. */
function Other() {
  const input = document.createElement("input");
  input.value = "kept";
  return input;
}

describe("$hot", () => {
  it("re-renders only the instances of a changed component; the rest keeps its state", () => {
    const hot = hotContext();
    let renders = 0;
    const version = (label: string) => () => {
      renders++;
      const count = signal(0);
      const button = document.createElement("button");
      button.addEventListener("click", () => count.update((n) => n + 1));
      bind(button, count, (el: HTMLButtonElement, n: number) => {
        el.textContent = `${label} ${n}`;
      });
      return button;
    };
    const Counter = $hot(hot, "Counter", version("v1"), "1");
    const app = document.body.appendChild(document.createElement("div"));
    mount(
      () => [
        createComponent(Counter, {}),
        createComponent(Counter, {}),
        createComponent(Other, {}),
      ],
      app,
    );
    const input = app.querySelector("input")!;
    input.value = "edited by the user";
    app.querySelector("button")!.click();
    flushSync();
    expect(app.querySelector("button")!.textContent).toBe("v1 1");
    expect(renders).toBe(2);

    // The module runs again with a changed Counter: the same wrapper comes back.
    expect($hot(hot, "Counter", version("v2"), "2")).toBe(Counter);
    flushSync();
    expect([...app.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["v2 0", "v2 0"]);
    expect(renders).toBe(4);
    expect(app.querySelector("input")).toBe(input);
    expect(input.value).toBe("edited by the user");

    // An unchanged version re-renders nothing.
    $hot(hot, "Counter", version("v3"), "2");
    flushSync();
    expect(renders).toBe(4);
  });

  it("returns the component itself without import.meta.hot", () => {
    expect($hot(undefined, "Plain", Plain, "1")).toBe(Plain);
  });
});

describe("$hotAccept", () => {
  it("keeps an update component-level only while the exports are the same components", () => {
    const hot = hotContext();
    const A = $hot(hot, "A", () => null, "1");
    $hotAccept(hot, ["A"]);
    $hotAccept(hot, ["A"], { A });
    expect(hot.invalidate).not.toHaveBeenCalled();
    // A new export: importers must see it.
    $hotAccept(hot, ["A", "b"], { A, b: 1 });
    expect(hot.invalidate).toHaveBeenCalledTimes(1);
    // An export that is not a component (a constant, a signal).
    $hotAccept(hot, ["A", "b"], { A, b: 2 });
    expect(hot.invalidate).toHaveBeenCalledTimes(2);
    // `export *`: the exports cannot be listed.
    $hotAccept(hot, null, { A });
    expect(hot.invalidate).toHaveBeenCalledTimes(3);
  });
});
