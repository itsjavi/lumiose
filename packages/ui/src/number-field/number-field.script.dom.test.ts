// @vitest-environment happy-dom
// `<lu-number-field>` on server HTML (TASK-375): the keys, the buttons (a press, holding, a click
// from a key), commit-time clamping and formatting, the hidden input, the wheel and a reset.
// Pointer drags on a scrub area need layout and are checked by examples/ui-e2e.
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import type { NumberFieldElement } from "./number-field.script.ts";

beforeAll(async () => {
  await import("./number-field.script.ts");
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function mount(options: { attributes?: string; input?: string } = {}): NumberFieldElement {
  document.body.innerHTML = `<form><lu-number-field ${options.attributes ?? 'min="0" max="20"'}><input type="hidden"><button type="button" data-action="decrement" tabindex="-1"></button>${options.input ?? '<input type="number" name="n" value="5">'}<button type="button" data-action="increment" tabindex="-1"></button></lu-number-field></form>`;
  return document.querySelector("lu-number-field") as NumberFieldElement;
}

const input = () => document.querySelector<HTMLInputElement>("input:not([type=hidden])")!;
const hidden = () => document.querySelector<HTMLInputElement>("input[type=hidden]")!;
const button = (action: string) =>
  document.querySelector<HTMLButtonElement>(`button[data-action=${action}]`)!;
const key = (name: string, shiftKey = false) =>
  input().dispatchEvent(
    new KeyboardEvent("keydown", { key: name, shiftKey, bubbles: true, cancelable: true }),
  );

it("steps with the arrows, Shift, Page Up and Page Down, and goes to the ends with Home and End", async () => {
  const field = mount();
  await settle();
  const events = vi.fn();
  field.addEventListener("input", () => events("input"));
  field.addEventListener("change", () => events("change"));
  key("ArrowUp");
  expect(field.value).toBe(6);
  key("ArrowUp", true);
  expect(field.value).toBe(16);
  key("PageUp");
  expect(field.value).toBe(20);
  key("PageDown");
  key("ArrowDown");
  expect(field.value).toBe(9);
  key("Home");
  expect(field.value).toBe(0);
  key("End");
  expect(field.value).toBe(20);
  expect(events.mock.calls.filter(([type]) => type === "change")).toHaveLength(7);
});

const alt = (name: string) =>
  input().dispatchEvent(
    new KeyboardEvent("keydown", { key: name, altKey: true, bubbles: true, cancelable: true }),
  );

it("steps by small-step with Alt, and snaps to the step's multiples with snap-on-step", async () => {
  const field = mount({ attributes: 'min="0" max="20" small-step="0.5"' });
  await settle();
  alt("ArrowUp");
  expect(field.value).toBe(5.5);
  key("ArrowUp");
  expect(field.value).toBe(6.5);
  field.setAttribute("snap-on-step", "");
  key("ArrowUp");
  expect(field.value).toBe(7);
  field.value = 7.2;
  key("ArrowDown");
  expect(field.value).toBe(7);
  // A large step lands on its own multiples: tens.
  key("ArrowUp", true);
  expect(field.value).toBe(10);
  field.value = 13;
  key("PageDown");
  expect(field.value).toBe(10);
  // A Shift press on a button takes the large step too.
  button("decrement").dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
  expect(field.value).toBe(0);
});

it("disables a button at its end of the range", async () => {
  const field = mount();
  await settle();
  key("End");
  expect(button("increment").disabled).toBe(true);
  expect(button("decrement").disabled).toBe(false);
  field.value = 0;
  expect(button("decrement").disabled).toBe(true);
});

it("steps once per click from a key or a screen reader, and keeps stepping while held", async () => {
  const field = mount();
  await settle();
  button("increment").click();
  expect(field.value).toBe(6);
  vi.useFakeTimers();
  const press = (type: string) =>
    button("decrement").dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        isPrimary: true,
        pointerId: 1,
      }),
    );
  const change = vi.fn();
  field.addEventListener("change", change);
  press("pointerdown");
  expect(field.value).toBe(5);
  vi.advanceTimersByTime(400 + 60 * 2);
  expect(field.value).toBe(2);
  dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
  // The click that ends the press does not step again.
  button("decrement").click();
  vi.advanceTimersByTime(1000);
  expect(field.value).toBe(2);
  expect(change).toHaveBeenCalledTimes(1);
  button("decrement").click();
  expect(field.value).toBe(1);
});

it("clamps a typed number when it is committed, unless out of range is allowed", async () => {
  const field = mount();
  await settle();
  input().value = "99";
  input().dispatchEvent(new Event("change", { bubbles: true }));
  // Only the browser's own `change` commits: a synthetic one is the element's.
  expect(field.value).toBe(99);
  key("Enter");
  expect(field.value).toBe(20);
  const loose = mount({ attributes: 'min="0" max="20" allow-out-of-range' });
  await settle();
  input().value = "99";
  key("Enter");
  expect(loose.value).toBe(99);
});

it("formats, moves the name to the hidden input and keeps it current", async () => {
  const field = mount({
    attributes: `min="0" format='{"style":"currency","currency":"EUR"}' locale="de-DE"`,
    input: '<input type="text" role="spinbutton" name="price" value="5,00\u00a0€">',
  });
  await settle();
  expect(input().hasAttribute("name")).toBe(false);
  expect(hidden().name).toBe("price");
  expect(hidden().value).toBe("5");
  key("ArrowUp", true);
  expect(input().value).toBe("15,00\u00a0€");
  expect(hidden().value).toBe("15");
  expect(input().getAttribute("aria-valuenow")).toBe("15");
  expect(input().getAttribute("aria-valuetext")).toBe("15,00\u00a0€");
  input().value = "1.234,567";
  input().dispatchEvent(new Event("input", { bubbles: true }));
  expect(hidden().value).toBe("1234.567");
  key("Enter");
  expect(input().value).toBe("1.234,57\u00a0€");
  expect(field.value).toBe(1234.57);
  input().value = "abc";
  key("Enter");
  expect(input().value).toBe("1.234,57\u00a0€");
  input().value = "-3";
  key("Enter");
  expect(field.value).toBe(0);
});

it("steps on the wheel only with allow-wheel-scrub and focus", async () => {
  const field = mount({ attributes: 'min="0" max="20" allow-wheel-scrub' });
  await settle();
  const wheel = () =>
    input().dispatchEvent(
      new WheelEvent("wheel", { deltaY: -100, bubbles: true, cancelable: true }),
    );
  wheel();
  expect(field.value).toBe(5);
  input().focus();
  wheel();
  expect(field.value).toBe(6);
});

it("follows a form reset", async () => {
  const field = mount({
    attributes: `format='{"maximumFractionDigits":1}' locale="en-US"`,
    input: '<input type="text" role="spinbutton" name="n" value="5">',
  });
  await settle();
  key("ArrowUp");
  expect(hidden().value).toBe("6");
  document.querySelector("form")!.reset();
  await settle();
  expect(field.value).toBe(5);
  expect(hidden().value).toBe("5");
});

it("falls back from format options and a locale the browser refuses (TASK-473, L12)", async () => {
  for (const attributes of [
    `format='{"style":"currency"}' locale="en-US"`,
    `format='{"maximumFractionDigits":1}' locale="!!"`,
  ]) {
    const field = mount({ attributes, input: '<input type="text" role="spinbutton" value="5">' });
    await settle();
    key("ArrowUp");
    expect(field.value).toBe(6);
    expect(input().value).toBe("6");
    document.body.innerHTML = "";
  }
});
