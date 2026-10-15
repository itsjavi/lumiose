// @vitest-environment happy-dom
// Tabs in the browser build (TASK-359): `value`, `onValueChange` and `bind:value` keep a signal in
// sync with `<lu-tabs>`, and a selected tab that becomes disabled gives its place away.
import { flush, signal } from "lumiose";
import { render } from "lumiose/dom";
import { afterEach, beforeAll, expect, it } from "vitest";
import { Tabs } from "./tabs.tsx";

let dispose: (() => void) | undefined;

beforeAll(async () => {
  await import("./tabs.script.ts");
});

afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

it("keeps a signal in sync with bind:value, and falls back from a disabled tab", () => {
  const value = signal("a");
  const locked = signal(false);
  const container = document.body.appendChild(document.createElement("div"));
  dispose = render(
    () => (
      <Tabs.Root bind:value={value}>
        <Tabs.List>
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tabs.Tab value="b" disabled={locked()}>
            B
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a">Panel A</Tabs.Panel>
        <Tabs.Panel value="b">Panel B</Tabs.Panel>
      </Tabs.Root>
    ),
    container,
  );
  flush();
  const [a, b] = container.querySelectorAll<HTMLElement>("[role=tab]");
  const [panelA, panelB] = container.querySelectorAll<HTMLElement>("[role=tabpanel]");

  // A click: the element selects and reports, the signal follows.
  b!.click();
  flush();
  expect(value()).toBe("b");
  expect(b!.getAttribute("aria-selected")).toBe("true");
  expect(panelB!.hidden).toBe(false);

  // The signal drives the selection.
  value.set("a");
  flush();
  expect(a!.getAttribute("aria-selected")).toBe("true");
  expect(panelA!.hidden).toBe(false);
  expect(panelB!.hidden).toBe(true);

  value.set("b");
  flush();
  locked.set(true);
  flush();
  expect(b!.getAttribute("aria-disabled")).toBe("true");
  expect(a!.getAttribute("aria-selected")).toBe("true");
  expect(panelA!.hidden).toBe(false);
});
