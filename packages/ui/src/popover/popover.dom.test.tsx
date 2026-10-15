// @vitest-environment happy-dom
// Popover in the browser build (TASK-356): the `open` prop drives the native popover and its
// `toggle` event drives `onOpenChange`, so a signal stays in sync both ways.
import { flush, signal } from "lumiose";
import { render } from "lumiose/dom";
import { afterEach, beforeAll, expect, it } from "vitest";
import { installPopovers, sources, toggled } from "../test/popover.ts";
import { Popover } from "./popover.tsx";

let dispose: (() => void) | undefined;

function mount(ui: () => JSX.Element): HTMLElement {
  const container = document.body.appendChild(document.createElement("div"));
  dispose = render(ui, container);
  return container;
}

beforeAll(installPopovers);

afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

it("keeps a signal in sync with bind:open, and shows the popup from its trigger", () => {
  const open = signal(false);
  const container = mount(() => (
    <Popover.Root bind:open={open}>
      <Popover.Trigger>Filters</Popover.Trigger>
      <Popover.Popup>
        <Popover.Title>Filters</Popover.Title>
      </Popover.Popup>
    </Popover.Root>
  ));
  flush();
  const popup = container.querySelector<HTMLElement>("[popover]")!;
  const trigger = container.querySelector("button")!;
  expect(popup.matches(":popover-open")).toBe(false);

  open.set(true);
  flush();
  expect(popup.matches(":popover-open")).toBe(true);
  // `source`: the trigger is the invoker, for focus order, nesting and the anchor.
  expect(sources.get(popup)).toBe(trigger);

  // Escape, a close button or a click outside: the browser closes it and fires toggle.
  toggled(popup, "closed");
  flush();
  expect(open()).toBe(false);
  toggled(popup, "open");
  flush();
  expect(open()).toBe(true);
  open.set(false);
  flush();
  expect(popup.matches(":popover-open")).toBe(false);
});

it("reports every open and close through onOpenChange", () => {
  const changes: boolean[] = [];
  const container = mount(() => (
    <Popover.Root onOpenChange={(next) => changes.push(next)}>
      <Popover.Popup aria-label="Plain" />
    </Popover.Root>
  ));
  flush();
  const popup = container.querySelector("[popover]")!;
  toggled(popup, "open");
  toggled(popup, "closed");
  expect(changes).toEqual([true, false]);
});

it("references the Description only while it is rendered", () => {
  const described = signal(false);
  const container = mount(() => (
    <Popover.Root>
      <Popover.Popup>
        <Popover.Title>Filters</Popover.Title>
        {described() ? <Popover.Description>Narrow the list.</Popover.Description> : null}
      </Popover.Popup>
    </Popover.Root>
  ));
  flush();
  const popup = container.querySelector("[popover]")!;
  expect(popup.getAttribute("aria-labelledby")).toBe(container.querySelector("h2")!.id);
  expect(popup.hasAttribute("aria-describedby")).toBe(false);
  described.set(true);
  flush();
  expect(popup.getAttribute("aria-describedby")).toBe(container.querySelector("p")!.id);
});
