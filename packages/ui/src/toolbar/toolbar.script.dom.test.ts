// @vitest-environment happy-dom
// `<lu-toolbar>` on server HTML (TASK-383): the roving tab stop, the arrow keys along the
// orientation (swapped right to left), Home and End, looping, the keys a control keeps (a text
// field's caret), skipped native-disabled items, and a ToggleGroup inside that leaves its keys to
// the toolbar.
import { afterEach, beforeAll, expect, it } from "vitest";

beforeAll(async () => {
  await import("./toolbar.script.ts");
  await import("../toggle-group/toggle-group.script.ts");
});

afterEach(() => {
  document.body.innerHTML = "";
});

const settle = () => new Promise((resolve) => queueMicrotask(() => resolve(undefined)));

function mount(attributes = "", dir = "ltr") {
  document.body.innerHTML = `<div dir="${dir}" style="direction: ${dir}"><lu-toolbar role="toolbar" ${attributes}>
    <lu-toggle-group role="group"><button id="b" aria-pressed="false" value="b">B</button><button id="i" aria-pressed="false" value="i">I</button></lu-toggle-group>
    <hr>
    <button id="undo" aria-disabled="true">Undo</button>
    <button id="off" disabled>Off</button>
    <a id="help" href="/help">Help</a>
    <input id="size" value="12">
  </lu-toolbar></div>`;
}

const el = (id: string) => document.getElementById(id) as HTMLElement;
const key = (target: Element, name: string) =>
  target.dispatchEvent(
    new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }),
  );

it("keeps one tab stop, moved by the arrows, Home and End, looping, past disabled controls", async () => {
  mount();
  await settle();
  expect(["b", "i", "undo", "help", "size"].map((id) => el(id).tabIndex)).toEqual([
    0, -1, -1, -1, -1,
  ]);
  el("b").focus();
  key(el("b"), "ArrowRight");
  expect(document.activeElement).toBe(el("i"));
  key(el("i"), "ArrowRight");
  // An aria-disabled button stays an item; a disabled one does not.
  expect(document.activeElement).toBe(el("undo"));
  key(el("undo"), "ArrowRight");
  expect(document.activeElement).toBe(el("help"));
  expect(el("help").tabIndex).toBe(0);
  expect(el("b").tabIndex).toBe(-1);
  key(el("help"), "End");
  expect(document.activeElement).toBe(el("size"));
  key(el("size"), "Home");
  // Home stays in the text field.
  expect(document.activeElement).toBe(el("size"));
  key(el("help"), "Home");
  expect(document.activeElement).toBe(el("b"));
  key(el("b"), "ArrowLeft");
  expect(document.activeElement).toBe(el("size"));
});

it("leaves a text field's caret its Left and Right until it reaches the edge", async () => {
  mount();
  await settle();
  const size = el("size") as HTMLInputElement;
  size.focus();
  size.setSelectionRange(1, 1);
  key(size, "ArrowRight");
  expect(document.activeElement).toBe(size);
  size.setSelectionRange(2, 2);
  key(size, "ArrowRight");
  expect(document.activeElement).toBe(el("b"));
  size.focus();
  size.setSelectionRange(0, 0);
  key(size, "ArrowLeft");
  expect(document.activeElement).toBe(el("help"));
});

it("stops at the ends without loop focus, follows a vertical orientation and the direction", async () => {
  mount('data-orientation="vertical" data-loop-focus="false"');
  await settle();
  el("b").focus();
  key(el("b"), "ArrowUp");
  expect(document.activeElement).toBe(el("b"));
  key(el("b"), "ArrowRight");
  expect(document.activeElement).toBe(el("b"));
  key(el("b"), "ArrowDown");
  expect(document.activeElement).toBe(el("i"));
  document.body.innerHTML = "";
  mount("", "rtl");
  await settle();
  el("b").focus();
  key(el("b"), "ArrowLeft");
  expect(document.activeElement).toBe(el("i"));
});

it("lets a ToggleGroup inside press its toggles but not move focus", async () => {
  mount();
  await settle();
  el("i").click();
  expect(el("i").getAttribute("aria-pressed")).toBe("true");
  // The toolbar's tab stop moved with focus, not the group's.
  el("i").focus();
  expect(el("i").tabIndex).toBe(0);
  expect(el("b").tabIndex).toBe(-1);
});
