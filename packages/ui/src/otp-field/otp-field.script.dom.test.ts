// @vitest-environment happy-dom
// `<lu-otp-field>` on server HTML (TASK-376): the value kept to the allowed characters and the
// length (typing, a paste with spaces, autofill), `valueinvalid`, the slots and their states,
// overwriting at the caret in a full field, `valuecomplete` and auto-submit, and a reset. Presses
// on slots need layout and are checked by examples/ui-e2e.
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import type { OTPFieldElement } from "./otp-field.script.ts";

beforeAll(async () => {
  await import("./otp-field.script.ts");
});

afterEach(() => {
  document.body.innerHTML = "";
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function mount(attributes = 'length="4"', value = ""): OTPFieldElement {
  document.body.innerHTML = `<form><lu-otp-field ${attributes}><input name="code" value="${value}" maxlength="4"><div data-slot></div><div data-slot></div><div data-orientation="horizontal"></div><div data-slot></div><div data-slot></div></lu-otp-field></form>`;
  return document.querySelector("lu-otp-field") as OTPFieldElement;
}

const input = () => document.querySelector("input")!;
const shown = () => [...document.querySelectorAll("[data-slot]")].map((slot) => slot.textContent);
/** Puts `text` in the input as typing or a paste would. */
const type = (text: string) => {
  input().value = text;
  input().dispatchEvent(new Event("input", { bubbles: true }));
};

it("keeps digits only, drops spaces, and reports other characters", async () => {
  const field = mount();
  await settle();
  const invalid = vi.fn();
  field.addEventListener("valueinvalid", (event) => invalid((event as CustomEvent).detail.value));
  type("1 2");
  expect(field.value).toBe("12");
  expect(invalid).not.toHaveBeenCalled();
  type("12a3");
  expect(field.value).toBe("123");
  expect(invalid).toHaveBeenCalledWith("12a3");
  expect(shown()).toEqual(["1", "2", "3", ""]);
  expect([...document.querySelectorAll("[data-slot][data-filled]")]).toHaveLength(3);
});

it("fills every slot from a paste, clamped to the length, and completes once", async () => {
  const field = mount();
  await settle();
  const complete = vi.fn();
  field.addEventListener("valuecomplete", (event) => complete((event as CustomEvent).detail.value));
  type("123 456");
  expect(field.value).toBe("1234");
  expect(shown()).toEqual(["1", "2", "3", "4"]);
  expect(field.hasAttribute("data-complete")).toBe(true);
  await settle();
  expect(complete).toHaveBeenCalledTimes(1);
  expect(complete).toHaveBeenCalledWith("1234");
  type("1234");
  await settle();
  expect(complete).toHaveBeenCalledTimes(1);
});

it("types over the character at the caret when the field is full", async () => {
  mount('length="4"', "1234");
  await settle();
  input().focus();
  input().setSelectionRange(1, 1);
  const event = new InputEvent("beforeinput", {
    inputType: "insertText",
    data: "9",
    bubbles: true,
    cancelable: true,
  });
  input().dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(input().value).toBe("1934");
  expect(input().selectionStart).toBe(2);
  // WebKit's `beforeinput` into a full field with `maxlength` has no data: the key press tells.
  input().dispatchEvent(new KeyboardEvent("keydown", { key: "7", bubbles: true }));
  const empty = new InputEvent("beforeinput", {
    inputType: "insertText",
    data: "",
    bubbles: true,
    cancelable: true,
  });
  input().dispatchEvent(empty);
  expect(empty.defaultPrevented).toBe(true);
  expect(input().value).toBe("1974");
});

it("follows other validation types, and masks the slots", async () => {
  const field = mount('length="4" validation-type="alpha" mask');
  await settle();
  type("ab1c");
  expect(field.value).toBe("abc");
  expect(shown()).toEqual(["•", "•", "•", ""]);
});

it("normalizes what is entered with normalizeValue, before the allowed characters", async () => {
  const field = mount('length="4" validation-type="alphanumeric"');
  await settle();
  // An "O" for a zero, and capitals.
  field.normalizeValue = (text) => text.toUpperCase().replaceAll("O", "0");
  const invalid = vi.fn();
  field.addEventListener("valueinvalid", invalid);
  type("ab-o");
  expect(field.value).toBe("AB0");
  expect(shown()).toEqual(["A", "B", "0", ""]);
  expect(invalid).toHaveBeenCalledOnce();
  field.value = "xy12";
  expect(field.value).toBe("XY12");
});

it("submits the form when complete with auto-submit", async () => {
  mount('length="4" auto-submit');
  await settle();
  const form = document.querySelector("form")!;
  const submit = vi.fn((event: Event) => event.preventDefault());
  form.addEventListener("submit", submit);
  form.requestSubmit = vi.fn(() => form.dispatchEvent(new Event("submit", { cancelable: true })));
  type("5678");
  await settle();
  expect(submit).toHaveBeenCalledTimes(1);
});

it("sets the value without events, and follows a form reset", async () => {
  const field = mount('length="4"', "12");
  await settle();
  const events = vi.fn();
  field.addEventListener("input", events);
  field.value = "9x87";
  expect(field.value).toBe("987");
  expect(events).not.toHaveBeenCalled();
  expect(shown()).toEqual(["9", "8", "7", ""]);
  document.querySelector("form")!.reset();
  await settle();
  expect(shown()).toEqual(["1", "2", "", ""]);
});
