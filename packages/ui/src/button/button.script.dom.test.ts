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
