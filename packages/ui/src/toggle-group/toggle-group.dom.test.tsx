// @vitest-environment happy-dom
// Toggle and ToggleGroup in the browser build (TASK-369): a standalone toggle the component
// presses, and a group whose value follows `bind:value` both ways.
import { flush, signal } from "lumiose";
import { render } from "lumiose/dom";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { Toggle } from "../toggle/toggle.tsx";
import { ToggleGroup } from "./toggle-group.tsx";

let dispose: (() => void) | undefined;

beforeAll(async () => {
  await import("./toggle-group.script.ts");
});

afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

const mount = (view: () => JSX.Element) => {
  const container = document.body.appendChild(document.createElement("div"));
  dispose = render(view, container);
  flush();
  return container;
};

it("presses a standalone toggle, and follows bind:pressed", () => {
  const bold = signal(false);
  const container = mount(() => (
    <Toggle aria-label="Bold" bind:pressed={bold}>
      B
    </Toggle>
  ));
  const button = container.querySelector("button")!;
  button.click();
  flush();
  expect(bold()).toBe(true);
  expect(button.getAttribute("aria-pressed")).toBe("true");
  bold.set(false);
  flush();
  expect(button.getAttribute("aria-pressed")).toBe("false");
});

it("reports a standalone toggle's presses through onPressedChange", () => {
  const changes = vi.fn();
  const container = mount(() => (
    <Toggle defaultPressed onPressedChange={changes}>
      Pin
    </Toggle>
  ));
  container.querySelector("button")!.click();
  flush();
  expect(changes).toHaveBeenCalledWith(false);
});

it("keeps a signal in sync with a group's bind:value", () => {
  const value = signal<string[]>(["a"]);
  const pressed = vi.fn();
  const container = mount(() => (
    <ToggleGroup bind:value={value}>
      <Toggle value="a">A</Toggle>
      <Toggle value="b" onPressedChange={pressed}>
        B
      </Toggle>
    </ToggleGroup>
  ));
  const [a, b] = container.querySelectorAll("button");
  b!.click();
  flush();
  expect(value()).toEqual(["b"]);
  expect(pressed).toHaveBeenCalledWith(true);
  expect(a!.getAttribute("aria-pressed")).toBe("false");
  value.set(["a"]);
  flush();
  expect(a!.getAttribute("aria-pressed")).toBe("true");
  expect(b!.getAttribute("aria-pressed")).toBe("false");
});

it("shows a controlled value again when onValueChange keeps it, and still switches (TASK-538)", () => {
  // One toggle always pressed: the callback ignores the empty value of a release.
  const view = signal("a");
  const container = mount(() => (
    <ToggleGroup
      aria-label="View"
      value={[view()]}
      onValueChange={(next) => {
        if (next[0]) view.set(next[0]);
      }}
    >
      <Toggle value="a">A</Toggle>
      <Toggle value="b">B</Toggle>
    </ToggleGroup>
  ));
  const [a, b] = container.querySelectorAll("button");
  const pressed = () => [a!, b!].map((each) => each.getAttribute("aria-pressed"));
  a!.click();
  flush();
  expect(view()).toBe("a");
  expect(pressed()).toEqual(["true", "false"]);
  // Pressing B releases A (a cancelable `pressedchange` on A) and the callback takes B.
  b!.click();
  flush();
  expect(view()).toBe("b");
  expect(pressed()).toEqual(["false", "true"]);
});

it("undoes a press that a controlled onValueChange does not take", () => {
  const changes = vi.fn();
  const container = mount(() => (
    <ToggleGroup aria-label="View" value={["a"]} onValueChange={changes}>
      <Toggle value="a">A</Toggle>
      <Toggle value="b">B</Toggle>
    </ToggleGroup>
  ));
  const [a, b] = container.querySelectorAll("button");
  b!.click();
  flush();
  expect(changes).toHaveBeenCalledWith(["b"]);
  expect([a!.getAttribute("aria-pressed"), b!.getAttribute("aria-pressed")]).toEqual([
    "true",
    "false",
  ]);
});

it("switches an uncontrolled group, reporting each value", () => {
  const changes = vi.fn();
  const container = mount(() => (
    <ToggleGroup aria-label="View" defaultValue={["a"]} onValueChange={changes}>
      <Toggle value="a">A</Toggle>
      <Toggle value="b">B</Toggle>
    </ToggleGroup>
  ));
  const [a, b] = container.querySelectorAll("button");
  b!.click();
  flush();
  expect(changes).toHaveBeenLastCalledWith(["b"]);
  expect([a!.getAttribute("aria-pressed"), b!.getAttribute("aria-pressed")]).toEqual([
    "false",
    "true",
  ]);
  b!.click();
  flush();
  expect(changes).toHaveBeenLastCalledWith([]);
  expect(b!.getAttribute("aria-pressed")).toBe("false");
});
