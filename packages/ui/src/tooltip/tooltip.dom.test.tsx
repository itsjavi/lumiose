// @vitest-environment happy-dom
// Tooltip in the browser build (TASK-356): `open` and `bind:open` drive the native popover, and
// its `toggle` event drives `onOpenChange`, whatever opened it (hover, focus, the prop).
import { flush, signal } from "lumiose";
import { render } from "lumiose/dom";
import { afterEach, beforeAll, expect, it } from "vitest";
import { installPopovers, toggled } from "../test/popover.ts";
import { Tooltip } from "./tooltip.tsx";

let dispose: (() => void) | undefined;

beforeAll(installPopovers);

afterEach(() => {
  dispose?.();
  document.body.innerHTML = "";
});

it("keeps a signal in sync with bind:open", () => {
  const open = signal(false);
  const container = document.body.appendChild(document.createElement("div"));
  dispose = render(
    () => (
      <Tooltip.Root bind:open={open}>
        <Tooltip.Trigger>Help</Tooltip.Trigger>
        <Tooltip.Popup>Bound</Tooltip.Popup>
      </Tooltip.Root>
    ),
    container,
  );
  flush();
  const tip = container.querySelector("[role=tooltip]")!;
  open.set(true);
  flush();
  expect(tip.matches(":popover-open")).toBe(true);
  // Hover or focus ends, the client script hides it.
  toggled(tip, "closed");
  flush();
  expect(open()).toBe(false);
  toggled(tip, "open");
  flush();
  expect(open()).toBe(true);
  open.set(false);
  flush();
  expect(tip.matches(":popover-open")).toBe(false);
});
