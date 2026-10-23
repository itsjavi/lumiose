// @vitest-environment happy-dom
// The components' listeners run inside `batch()`, as delegated event handlers do (TASK-540): what
// a callback writes is in the DOM as soon as the event's dispatch returns, with no flush.
import { flush, signal } from "lumiose";
import { render } from "lumiose/dom";
import { afterEach, beforeAll, expect, it } from "vitest";
import { Checkbox } from "./checkbox/checkbox.tsx";
import { Select } from "./select/select.tsx";
import { Toggle } from "./toggle/toggle.tsx";
import { ToggleGroup } from "./toggle-group/toggle-group.tsx";

let dispose: (() => void) | undefined;

beforeAll(async () => {
  await import("./toggle-group/toggle-group.script.ts");
});

afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

function mount(view: () => JSX.Element): HTMLElement {
  const container = document.body.appendChild(document.createElement("div"));
  dispose = render(view, container);
  flush();
  return container;
}

it("renders a native event's callback writes before the event returns", () => {
  const checked = signal(false);
  const count = signal(0);
  const container = mount(() => (
    <>
      <Checkbox.Root
        aria-label="Agree"
        onCheckedChange={(next) => {
          checked.set(next);
          count.set(count() + 1);
        }}
      />
      <output>{`${checked()} ${count()}`}</output>
    </>
  ));
  const output = container.querySelector("output")!;
  container.querySelector("input")!.click();
  expect(output.textContent).toBe("true 1");
});

it("renders an element event's callback writes before the event returns", () => {
  const value = signal<string[]>([]);
  const container = mount(() => (
    <>
      <ToggleGroup aria-label="Style" bind:value={value} multiple>
        <Toggle value="bold">B</Toggle>
        <Toggle value="italic">I</Toggle>
      </ToggleGroup>
      <output>{value().join()}</output>
    </>
  ));
  const [bold, italic] = container.querySelectorAll("button");
  bold!.click();
  italic!.click();
  expect(container.querySelector("output")!.textContent).toBe("bold,italic");
});

it("renders a select's change before the event returns", () => {
  const fruit = signal("apple");
  const container = mount(() => (
    <>
      <Select.Root aria-label="Fruit" bind:value={fruit}>
        <Select.Item value="apple">Apple</Select.Item>
        <Select.Item value="pear">Pear</Select.Item>
      </Select.Root>
      <output>{fruit()}</output>
    </>
  ));
  const select = container.querySelector("select")!;
  select.value = "pear";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  expect(container.querySelector("output")!.textContent).toBe("pear");
});
