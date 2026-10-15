// Server HTML of Drawer (TASK-382): Dialog's parts, with the popup's swipe direction. The swipe
// is checked in a browser by examples/ui-e2e.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { Drawer } from "./drawer.tsx";

function Filters(props: { direction?: "up" | "down" | "left" | "right" }) {
  return (
    <Drawer.Root swipeDirection={props.direction}>
      <Drawer.Trigger class="trigger">Filters</Drawer.Trigger>
      <Drawer.Popup class="drawer">
        <Drawer.Title>Filters</Drawer.Title>
        <Drawer.Description>Narrow the list.</Drawer.Description>
        <Drawer.Content class="content">…</Drawer.Content>
        <Drawer.Close>Done</Drawer.Close>
      </Drawer.Popup>
    </Drawer.Root>
  );
}

describe("Drawer on the server", () => {
  it("renders a Dialog whose popup is a bottom sheet by default", async () => {
    const html = await renderToString(() => <Filters />);
    const dialog = attrs(html, "dialog");
    expect(dialog).toMatchObject({
      class: "drawer",
      "data-swipe-direction": "down",
      closedby: "any",
    });
    expect(dialog["aria-labelledby"]).toBeTruthy();
    expect(dialog["aria-describedby"]).toBeTruthy();
    expect(attrs(html, "button", (a) => a.class === "trigger")).toMatchObject({
      command: "show-modal",
      commandfor: dialog.id,
    });
    expect(attrs(html, "div", (a) => a.class === "content")).toBeTruthy();
    expect(attrs(html, "button", (a) => a.command === "close").commandfor).toBe(dialog.id);
  });

  it("takes the swipe direction, and refuses a popup outside the root", async () => {
    const html = await renderToString(() => <Filters direction="left" />);
    expect(attrs(html, "dialog")["data-swipe-direction"]).toBe("left");
    await expect(renderToString(() => <Drawer.Popup />)).rejects.toThrow(
      "Drawer parts must be inside <Drawer.Root>.",
    );
  });
});
