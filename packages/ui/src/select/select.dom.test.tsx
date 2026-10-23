// @vitest-environment happy-dom
// Select.Item in the browser build: the label script loads once an item has a label, also when
// the label appears after the first render (TASK-552). A conditional `?client` call loads its
// script on the call (TASK-551), so the module's import is what the test observes.
import { flush, signal } from "lumiose";
import { render } from "lumiose/dom";
import { afterEach, expect, it, vi } from "vitest";

const loaded = vi.hoisted(() => vi.fn());
vi.mock("./select.script.ts", () => {
  loaded();
  return {};
});

const { Select } = await import("./select.tsx");

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

const settled = () => new Promise((resolve) => setTimeout(resolve, 20));

it("loads the label script when an item's label appears after the first render", async () => {
  const label = signal<string | undefined>(undefined);
  const container = document.body.appendChild(document.createElement("div"));
  dispose = render(
    () => (
      <Select.Root aria-label="Fruit">
        <Select.Item value="a" label={label()}>
          <b>★</b>Apple
        </Select.Item>
      </Select.Root>
    ),
    container,
  );
  flush();
  await settled();
  expect(loaded).not.toHaveBeenCalled();
  label.set("Apple");
  flush();
  await settled();
  expect(loaded).toHaveBeenCalledOnce();
  expect(container.querySelector("option")!.getAttribute("label")).toBe("Apple");
});
