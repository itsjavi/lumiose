// @vitest-environment happy-dom
// Button's script (TASK-364): an `aria-disabled` button stays focusable but its clicks do
// nothing: no handlers, no form submission. Buttons with a role of their own are left alone.
import { afterEach, beforeAll, expect, it, vi } from "vitest";

beforeAll(async () => {
  await import("./button.script.ts");
});

afterEach(() => {
  document.body.innerHTML = "";
});

it("cancels the clicks of aria-disabled buttons, before other handlers and the form", () => {
  document.body.innerHTML = `<form><button type="submit" aria-disabled="true"><span>Save</span></button></form>`;
  const form = document.querySelector("form")!;
  const button = document.querySelector("button")!;
  const handler = vi.fn();
  const submit = vi.fn((event: Event) => event.preventDefault());
  button.addEventListener("click", handler);
  form.addEventListener("submit", submit);
  document.querySelector("span")!.click();
  button.click();
  expect(handler).not.toHaveBeenCalled();
  expect(submit).not.toHaveBeenCalled();
  button.focus();
  expect(document.activeElement).toBe(button);
});

it("lets enabled buttons and buttons with a role through", () => {
  document.body.innerHTML = `<button aria-disabled="false">A</button><button role="tab" aria-disabled="true">B</button>`;
  const [a, b] = document.querySelectorAll("button");
  const handler = vi.fn();
  a!.addEventListener("click", handler);
  b!.addEventListener("click", handler);
  a!.click();
  b!.click();
  expect(handler).toHaveBeenCalledTimes(2);
});

it("keeps presses, Enter and Space from the handlers, not from capturing listeners (TASK-450 L23)", () => {
  document.body.innerHTML = `<div><button aria-disabled="true">Save</button></div>`;
  const button = document.querySelector("button")!;
  const own = vi.fn();
  const around = vi.fn();
  const capturing = vi.fn();
  for (const type of ["pointerdown", "mousedown", "keydown", "keyup"]) {
    button.addEventListener(type, own);
    button.parentElement!.addEventListener(type, around);
    window.addEventListener(type, capturing, true);
  }
  button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
  button.dispatchEvent(enter);
  button.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true, cancelable: true }));
  expect(own).not.toHaveBeenCalled();
  expect(around).not.toHaveBeenCalled();
  expect(capturing).toHaveBeenCalledTimes(4);
  expect(enter.defaultPrevented).toBe(true);
  // The other keys go on: Tab, a toolbar's arrows.
  const arrow = new KeyboardEvent("keydown", {
    key: "ArrowRight",
    bubbles: true,
    cancelable: true,
  });
  button.dispatchEvent(arrow);
  expect(own).toHaveBeenCalledTimes(1);
  expect(around).toHaveBeenCalledTimes(1);
  expect(arrow.defaultPrevented).toBe(false);
  for (const type of ["pointerdown", "mousedown", "keydown", "keyup"]) {
    window.removeEventListener(type, capturing, true);
  }
});
