// @vitest-environment happy-dom
// The shared dismissal model (TASK-396): outside presses with their filters, close requests (the
// Escape fallback; happy-dom has no CloseWatcher), nesting through the DOM, and layers that leave
// the page. Menu, Popover and Combobox run it in Chromium in examples/ui-e2e.
import { afterEach, describe, expect, it } from "vitest";
import { openLayer } from "./layer.ts";

const releases: (() => void)[] = [];

afterEach(() => {
  for (const release of releases.splice(0)) release();
  document.body.replaceChildren();
});

/** A layer: a popup inside `parent`, its own trigger next to it, and its dismissals. */
function layer(parent: Element = document.body) {
  const trigger = parent.appendChild(document.createElement("button"));
  const popup = parent.appendChild(document.createElement("div"));
  const dismissed: (Element | undefined)[] = [];
  const release = openLayer({
    popup,
    contains: (node) => popup.contains(node) || trigger.contains(node),
    dismiss: (where) => {
      dismissed.push(where);
      release();
    },
  });
  releases.push(release);
  return { trigger, popup, dismissed, release };
}

function press(down: Element, up: Element = down, init: PointerEventInit = {}) {
  const options = { bubbles: true, button: 0, isPrimary: true, ...init };
  down.dispatchEvent(new PointerEvent("pointerdown", options));
  up.dispatchEvent(new PointerEvent("pointerup", options));
}

function escape(target: Element = document.body) {
  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe("openLayer", () => {
  it("dismisses on a main-button press and release outside, with where it landed", () => {
    const outside = document.body.appendChild(document.createElement("p"));
    const { trigger, popup, dismissed } = layer();
    press(popup);
    press(trigger);
    // A press that starts inside and ends outside, or the other way, is not outside.
    press(popup, outside);
    press(outside, popup);
    press(outside, outside, { button: 2 });
    press(outside, outside, { button: 1 });
    press(outside, outside, { isPrimary: false });
    expect(dismissed).toEqual([]);
    press(outside);
    expect(dismissed).toEqual([outside]);
  });

  it("ignores a press on a node the press removed", () => {
    const chip = document.body.appendChild(document.createElement("span"));
    const { dismissed } = layer();
    chip.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, button: 0, isPrimary: true }),
    );
    chip.remove();
    document.body.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, button: 0, isPrimary: true }),
    );
    expect(dismissed).toEqual([]);
  });

  it("closes one layer per close request, the topmost, unless a handler took the key", () => {
    const parent = layer();
    const child = layer(parent.popup);
    const handled = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    handled.preventDefault();
    document.body.dispatchEvent(handled);
    expect(child.dismissed).toEqual([]);
    expect(escape().defaultPrevented).toBe(true);
    expect(child.dismissed).toEqual([undefined]);
    expect(parent.dismissed).toEqual([]);
    escape();
    expect(parent.dismissed).toEqual([undefined]);
    // Nothing left: the key goes on.
    expect(escape().defaultPrevented).toBe(false);
  });

  it("keeps a parent open for a press in its child, and closes the child for one in the parent", () => {
    const parent = layer();
    const child = layer(parent.popup);
    press(child.popup);
    expect(parent.dismissed).toEqual([]);
    expect(child.dismissed).toEqual([]);
    press(parent.popup);
    expect(child.dismissed).toEqual([parent.popup]);
    expect(parent.dismissed).toEqual([]);
  });

  it("closes the open layers a new one is not inside of", () => {
    const first = layer();
    const nested = layer(first.popup);
    expect(first.dismissed).toEqual([]);
    const sibling = layer();
    expect(nested.dismissed).toEqual([undefined]);
    expect(first.dismissed).toEqual([undefined]);
    expect(sibling.dismissed).toEqual([]);
  });

  it("forgets a layer whose popup left the page", () => {
    const parent = layer();
    const child = layer(parent.popup);
    child.popup.remove();
    escape();
    expect(child.dismissed).toEqual([]);
    expect(parent.dismissed).toEqual([undefined]);
  });
});

it("leaves an Escape that ends an input method's composition alone (TASK-438 M21)", () => {
  const { dismissed } = layer();
  // Safari: the key that cancels a composition comes after compositionend, with keyCode 229.
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    keyCode: 229,
    bubbles: true,
    cancelable: true,
  });
  document.body.dispatchEvent(event);
  expect(dismissed).toEqual([]);
  expect(event.defaultPrevented).toBe(false);
  escape();
  expect(dismissed).toEqual([undefined]);
});
