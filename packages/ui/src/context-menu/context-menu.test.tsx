// Server HTML of Context Menu (TASK-378): the trigger area, Menu's element and popup, and the
// zero-size point the popup is anchored to. Opening at the pointer is checked in a browser by
// examples/ui-e2e.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { ContextMenu } from "./context-menu.tsx";

function Files(props: { disabled?: boolean }) {
  return (
    <ContextMenu.Root disabled={props.disabled}>
      <ContextMenu.Trigger class="area" tabindex={0}>
        Files
      </ContextMenu.Trigger>
      <ContextMenu.Popup class="menu" aria-label="File actions">
        <ContextMenu.Item>Rename</ContextMenu.Item>
        <ContextMenu.SubmenuRoot>
          <ContextMenu.SubmenuTrigger>Move to</ContextMenu.SubmenuTrigger>
          <ContextMenu.Popup>
            <ContextMenu.Item>Archive</ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.SubmenuRoot>
      </ContextMenu.Popup>
    </ContextMenu.Root>
  );
}

describe("Context Menu on the server", () => {
  it("renders the area, and Menu's popup anchored to a point at the pointer", async () => {
    const html = await renderToString(() => <Files />);
    expect(attrs(html, "lu-context-menu")).not.toHaveProperty("data-disabled");
    expect(attrs(html, "div", (a) => a.class === "area")).toMatchObject({ tabindex: "0" });
    expect(html).toContain("<lu-menu");
    // The point: hidden, fixed, at the script's coordinates (unquoted and compact in the HTML).
    const point = /<span aria-hidden=true style="([^"]*)">/.exec(html)![1]!;
    const anchor = /anchor-name:(--lu-[\w-]+)/.exec(point)![1];
    expect(point).toContain("position:fixed");
    expect(point).toContain("var(--lu-context-x, 0)");
    const popup = attrs(html, "div", (a) => a.role === "menu" && a.class === "menu");
    expect(popup).toMatchObject({
      popover: "auto",
      "data-side": "bottom",
      "data-align": "start",
      "aria-label": "File actions",
    });
    expect(popup.style!.replaceAll(" ", "")).toContain(`position-anchor:${anchor}`);
    expect(popup.style!.replaceAll(" ", "")).toContain("--lu-side-offset:0px");
    // No trigger button: the popup is labelled by its own aria-label.
    expect(popup).not.toHaveProperty("aria-labelledby");
    // A submenu's popup sits next to its trigger, as in Menu.
    const submenu = attrs(html, "div", (a) => a.role === "menu" && a.class === undefined);
    expect(submenu["data-side"]).toBe("inline-end");
    expect(submenu.style).not.toContain(anchor!);
  });

  it("marks a disabled area, and refuses parts outside the root", async () => {
    expect(attrs(await renderToString(() => <Files disabled />), "lu-context-menu")).toHaveProperty(
      "data-disabled",
    );
    await expect(renderToString(() => <ContextMenu.Trigger />)).rejects.toThrow(
      "ContextMenu parts must be inside <ContextMenu.Root>.",
    );
  });
});
