// @vitest-environment happy-dom
// `<lu-toggle-group>` on server HTML (TASK-369): pressing, one or several at a time, the
// cancelable `pressedchange`, `valuechange`, and the roving tab stop with the arrows, Home and End.
// The real browser is checked by examples/ui-e2e.
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import type { ToggleGroupElement } from "./toggle-group.script.ts";

beforeAll(async () => {
  await import("./toggle-group.script.ts");
});

afterEach(() => {
  document.body.innerHTML = "";
});

function mount(
  options: { attributes?: string; pressed?: string[]; disabled?: string[]; dir?: string } = {},
): ToggleGroupElement {
  const values = ["a", "b", "c"];
  document.body.innerHTML = `<div dir="${options.dir ?? "ltr"}" style="direction: ${options.dir ?? "ltr"}"><lu-toggle-group role="group" ${options.attributes ?? ""}>${values
    .map(
      (v) =>
        `<button type="button" id="t-${v}" value="${v}" aria-pressed="${options.pressed?.includes(v) ?? false}"${options.disabled?.includes(v) ? " disabled" : ""}>${v}</button>`,
    )
    .join("")}</lu-toggle-group></div>`;
  return document.querySelector("lu-toggle-group") as ToggleGroupElement;
}

const item = (value: string) => document.getElementById(`t-${value}`) as HTMLButtonElement;
const key = (target: Element, name: string) =>
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }),
  );
const settle = () => new Promise((resolve) => queueMicrotask(() => resolve(undefined)));

it("presses one toggle at a time, and releases it on a second press", () => {
  const group = mount({ pressed: ["a"] });
  const changes = vi.fn();
  group.addEventListener("valuechange", changes);
  item("b").click();
  expect(group.value).toEqual(["b"]);
  expect(item("a").getAttribute("aria-pressed")).toBe("false");
  item("b").click();
  expect(group.value).toEqual([]);
  expect(changes).toHaveBeenCalledTimes(2);
});

it("presses several with multiple", () => {
  const group = mount({ attributes: "multiple" });
  expect(group.multiple).toBe(true);
  item("a").click();
  item("c").click();
  expect(group.value).toEqual(["a", "c"]);
});

it("lets a pressedchange listener cancel a press", () => {
  const group = mount();
  const changes = vi.fn();
  group.addEventListener("valuechange", changes);
  item("a").addEventListener("pressedchange", (event) => {
    expect((event as CustomEvent).detail).toEqual({ pressed: true });
    event.preventDefault();
  });
  item("a").click();
  expect(group.value).toEqual([]);
  expect(changes).not.toHaveBeenCalled();
});

it("sets the value without events, and keeps one tab stop on a pressed toggle", async () => {
  const group = mount();
  await settle();
  expect([item("a").tabIndex, item("b").tabIndex]).toEqual([0, -1]);
  const changes = vi.fn();
  group.addEventListener("valuechange", changes);
  group.value = ["b"];
  expect(item("b").getAttribute("aria-pressed")).toBe("true");
  expect(changes).not.toHaveBeenCalled();
});

it("does nothing for a value equal to the current one: no write, no layout (TASK-539)", async () => {
  const group = mount({ pressed: ["a"] });
  await settle();
  // The tab stop's `checkVisibility()` forces a layout in a browser.
  const measure = vi.fn(() => true);
  for (const each of group.items) each.checkVisibility = measure;
  const writes = new MutationObserver(() => {});
  writes.observe(group, { subtree: true, attributes: true });
  group.value = ["a"];
  expect(writes.takeRecords()).toEqual([]);
  expect(measure).not.toHaveBeenCalled();
  group.value = ["b"];
  const pressed = writes.takeRecords().filter((each) => each.attributeName === "aria-pressed");
  expect(pressed.map((each) => (each.target as HTMLButtonElement).value)).toEqual(["a", "b"]);
  expect(measure).toHaveBeenCalled();
  writes.disconnect();
});

it("moves focus with the arrows, Home and End, looping and skipping disabled toggles", async () => {
  mount({ disabled: ["b"] });
  await settle();
  item("a").focus();
  key(item("a"), "ArrowRight");
  expect(document.activeElement).toBe(item("c"));
  expect(item("c").tabIndex).toBe(0);
  expect(item("a").tabIndex).toBe(-1);
  key(item("c"), "ArrowRight");
  expect(document.activeElement).toBe(item("a"));
  key(item("a"), "End");
  expect(document.activeElement).toBe(item("c"));
  key(item("c"), "Home");
  expect(document.activeElement).toBe(item("a"));
});

it("stops at the ends without loop focus, and follows a vertical orientation", async () => {
  mount({ attributes: 'data-orientation="vertical" data-loop-focus="false"' });
  await settle();
  item("a").focus();
  key(item("a"), "ArrowUp");
  expect(document.activeElement).toBe(item("a"));
  key(item("a"), "ArrowRight");
  expect(document.activeElement).toBe(item("a"));
  key(item("a"), "ArrowDown");
  expect(document.activeElement).toBe(item("b"));
});

it("swaps the horizontal arrows right to left", async () => {
  mount({ dir: "rtl" });
  await settle();
  item("a").focus();
  key(item("a"), "ArrowLeft");
  expect(document.activeElement).toBe(item("b"));
});
