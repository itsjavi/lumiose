// @vitest-environment happy-dom
// `<lu-slider>` on server HTML (TASK-372): two thumbs kept in order and apart (push or none),
// Page Up and Page Down, Shift with an arrow, the track's custom properties and the value text.
// Pointer presses on the track need layout and are checked by examples/ui-e2e.
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import type { SliderElement } from "./slider.script.ts";

beforeAll(async () => {
  await import("./slider.script.ts");
});

afterEach(() => {
  document.body.innerHTML = "";
});

function mount(values: number[], attributes = "", output = true): SliderElement {
  document.body.innerHTML = `<lu-slider ${attributes}>${output ? `<output for="t0 t1"></output>` : ""}<div><div><div></div></div>${values
    .map((v, i) => `<input type="range" id="t${i}" min="0" max="100" step="1" value="${v}">`)
    .join("")}</div></lu-slider>`;
  return document.querySelector("lu-slider") as SliderElement;
}

const thumb = (i: number) => document.getElementById(`t${i}`) as HTMLInputElement;
const settle = () => new Promise((resolve) => queueMicrotask(() => resolve(undefined)));
/** The user moves thumb `i` to `value`, as the platform does: value, then `input`. */
const drag = (i: number, value: number) => {
  thumb(i).value = String(value);
  thumb(i).dispatchEvent(new Event("input", { bubbles: true }));
};
const key = (target: Element, name: string, shiftKey = false) =>
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key: name, shiftKey, bubbles: true, cancelable: true }),
  );

it("writes the selected range and the value text when it connects", async () => {
  const slider = mount([20, 70]);
  await settle();
  expect(slider.style.getPropertyValue("--lu-slider-start")).toBe("20%");
  expect(slider.style.getPropertyValue("--lu-slider-end")).toBe("70%");
  expect(document.querySelector("output")!.textContent).toBe("20 – 70");
  expect(slider.value).toEqual([20, 70]);
});

it("pushes the other thumb along, min-steps-between-values apart", () => {
  const slider = mount([20, 70], 'min-steps-between-values="5"');
  drag(0, 80);
  expect(slider.value).toEqual([80, 85]);
  drag(1, 10);
  expect(slider.value).toEqual([5, 10]);
  expect(slider.style.getPropertyValue("--lu-slider-end")).toBe("10%");
});

it("stops a thumb at its neighbour with thumb-collision-behavior none", () => {
  const slider = mount([20, 70], 'thumb-collision-behavior="none" min-steps-between-values="2"');
  drag(0, 90);
  expect(slider.value).toEqual([68, 70]);
  drag(1, 0);
  expect(slider.value).toEqual([68, 70]);
});

it("swaps thumbs dragged past each other with swap, and stops them with the keys", () => {
  const slider = mount([20, 60], 'thumb-collision-behavior="swap"');
  // The pointer drags thumb 0 natively past thumb 1.
  thumb(0).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, isPrimary: true }));
  drag(0, 70);
  expect(slider.value).toEqual([60, 70]);
  expect(document.activeElement).toBe(thumb(1));
  // Its drag goes on: thumb 0 stays put, thumb 1 follows the pointer, past the start too.
  drag(0, 80);
  expect(slider.value).toEqual([60, 80]);
  drag(0, 10);
  expect(slider.value).toEqual([10, 60]);
  expect(document.activeElement).toBe(thumb(0));
  document.dispatchEvent(new PointerEvent("pointerup", { isPrimary: true }));
  // No pointer: the keys and other moves stop at the neighbour.
  drag(0, 90);
  expect(slider.value).toEqual([60, 60]);
});

it("stops a pushed thumb at the end of the range, and the moved one before it", () => {
  const slider = mount([20, 95], 'min-steps-between-values="10"');
  drag(0, 99);
  expect(slider.value).toEqual([90, 100]);
});

it("moves by large-step with Page Up, Page Down and Shift with an arrow", () => {
  const slider = mount([50], 'large-step="20"', false);
  const input = vi.fn();
  const change = vi.fn();
  slider.addEventListener("input", input);
  slider.addEventListener("change", change);
  key(thumb(0), "PageUp");
  expect(slider.value).toBe(70);
  key(thumb(0), "PageDown");
  key(thumb(0), "PageDown");
  expect(slider.value).toBe(30);
  key(thumb(0), "ArrowRight", true);
  expect(slider.value).toBe(50);
  key(thumb(0), "ArrowDown", true);
  expect(slider.value).toBe(30);
  expect(input).toHaveBeenCalledTimes(5);
  expect(change).toHaveBeenCalledTimes(5);
  // Clamped to the range by the platform; no events when nothing moves.
  thumb(0).value = "100";
  key(thumb(0), "PageUp");
  expect(input).toHaveBeenCalledTimes(5);
});

it("sets the values without events, and formats aria-valuetext with format and locale", async () => {
  const slider = mount([10, 30], `format='{"style":"unit","unit":"percent"}' locale="en-US"`);
  await settle();
  expect(thumb(0).getAttribute("aria-valuetext")).toBe("10%");
  const input = vi.fn();
  slider.addEventListener("input", input);
  slider.value = [40, 60];
  expect(input).not.toHaveBeenCalled();
  expect(thumb(1).getAttribute("aria-valuetext")).toBe("60%");
  expect(document.querySelector("output")!.textContent).toBe("40% – 60%");
  expect(slider.style.getPropertyValue("--lu-slider-start")).toBe("40%");
});

it("follows the thumbs back after a form reset", async () => {
  const slider = mount([20, 70]);
  document.body.innerHTML = `<form>${document.body.innerHTML}</form>`;
  const form = document.querySelector("form")!;
  const moved = document.querySelector("lu-slider") as SliderElement;
  drag(0, 40);
  expect(moved.style.getPropertyValue("--lu-slider-start")).toBe("40%");
  form.reset();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(moved.value).toEqual([20, 70]);
  expect(moved.style.getPropertyValue("--lu-slider-start")).toBe("20%");
  expect(document.querySelector("output")!.textContent).toBe("20 – 70");
  expect(slider.isConnected).toBe(false);
});
