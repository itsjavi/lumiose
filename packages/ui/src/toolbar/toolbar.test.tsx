// Server HTML of Toolbar (TASK-383): `role="toolbar"` with its orientation, every item a tab stop
// until the script makes them one (a ToggleGroup's toggles included, TASK-437 M12), disabled items
// that stay focusable, Menu and Popover triggers and Toggles that `disabled` reaches (TASK-437 M13),
// groups and a separator across the toolbar.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { Menu } from "../menu/menu.tsx";
import { Popover } from "../popover/popover.tsx";
import { Toggle } from "../toggle/toggle.tsx";
import { ToggleGroup } from "../toggle-group/toggle-group.tsx";
import { Toolbar } from "./toolbar.tsx";

const tabindexes = (html: string) =>
  [...html.matchAll(/<(button|a|input)\b([^>]*)>/g)].map((m) => attrs(`<x${m[2]}>`, "x").tabindex);

describe("Toolbar on the server", () => {
  it("is a toolbar whose items are all tab stops before its script runs, toggles included", async () => {
    const html = await renderToString(() => (
      <Toolbar.Root aria-label="Formatting">
        <ToggleGroup aria-label="Style" multiple>
          <Toggle value="bold">Bold</Toggle>
          <Toggle value="italic">Italic</Toggle>
        </ToggleGroup>
        <Toolbar.Separator />
        <Toolbar.Group aria-label="Actions">
          <Toolbar.Button>Undo</Toolbar.Button>
          <Toolbar.Link href="/help">Help</Toolbar.Link>
        </Toolbar.Group>
        <Toolbar.Input aria-label="Font size" />
      </Toolbar.Root>
    ));
    expect(attrs(html, "lu-toolbar")).toEqual({
      "aria-label": "Formatting",
      role: "toolbar",
      "aria-orientation": "horizontal",
      "data-orientation": "horizontal",
    });
    // Reachable without the script (TASK-437 M12): it makes them one tab stop.
    expect(tabindexes(html)).toEqual([undefined, undefined, undefined, undefined, undefined]);
    expect(attrs(html, "hr")).toMatchObject({
      "aria-orientation": "vertical",
      "data-orientation": "vertical",
    });
    expect(attrs(html, "div", (a) => a.role === "group")).toMatchObject({
      "aria-label": "Actions",
      "data-orientation": "horizontal",
    });
  });

  it("leaves a Menu's and a Popover's trigger and their popups' content tab stops", async () => {
    const html = await renderToString(() => (
      <Toolbar.Root aria-label="Editor">
        <Toolbar.Button>Undo</Toolbar.Button>
        <Popover.Root>
          <Popover.Trigger>Format</Popover.Trigger>
          <Popover.Popup aria-label="Format">
            <Toggle>Bold</Toggle>
          </Popover.Popup>
        </Popover.Root>
        <Menu.Root>
          <Menu.Trigger>More</Menu.Trigger>
          <Menu.Popup>
            <Menu.Item>Print</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
      </Toolbar.Root>
    ));
    const tabindex = (name: string) => {
      const match = [...html.matchAll(/<button\b([^>]*)>([^<]*)</g)].find((m) => m[2] === name)!;
      return attrs(`<x${match[1]}>`, "x").tabindex;
    };
    expect(["Undo", "Format", "More"].map(tabindex)).toEqual([undefined, undefined, undefined]);
    // The popover's toggle is not a toolbar item: no toolbar tab stop of its own.
    expect(tabindex("Bold")).toBeUndefined();
  });

  it("disables its Menu and Popover triggers and Toggles, which stay focusable (TASK-437 M13)", async () => {
    const html = await renderToString(() => (
      <Toolbar.Root aria-label="Editor" disabled>
        <ToggleGroup aria-label="Style">
          <Toggle value="bold">Bold</Toggle>
        </ToggleGroup>
        <Popover.Root>
          <Popover.Trigger openOnHover>Format</Popover.Trigger>
          <Popover.Popup aria-label="Format">Fonts</Popover.Popup>
        </Popover.Root>
        <Popover.Root modal>
          <Popover.Trigger>Share</Popover.Trigger>
          <Popover.Popup aria-label="Share">Link</Popover.Popup>
        </Popover.Root>
        <Menu.Root>
          <Menu.Trigger>More</Menu.Trigger>
          <Menu.Popup>
            <Menu.Item>Print</Menu.Item>
          </Menu.Popup>
        </Menu.Root>
      </Toolbar.Root>
    ));
    const button = (name: string) => {
      const match = [...html.matchAll(/<button\b([^>]*)>([^<]*)</g)].find((m) => m[2] === name)!;
      return attrs(`<x${match[1]}>`, "x");
    };
    for (const name of ["Bold", "Format", "Share", "More"]) {
      const each = button(name);
      expect(each, name).toMatchObject({ "aria-disabled": "true" });
      // Focusable, and nothing opens them without JavaScript either.
      for (const attribute of ["disabled", "popovertarget", "commandfor", "data-open-on-hover"]) {
        expect(each, name).not.toHaveProperty(attribute);
      }
    }
  });

  it("keeps disabled items focusable, and runs vertically without looping", async () => {
    const html = await renderToString(() => (
      <Toolbar.Root aria-label="Tools" orientation="vertical" loopFocus={false}>
        <Toolbar.Button disabled>Cut</Toolbar.Button>
        <Toolbar.Button disabled focusableWhenDisabled={false}>
          Copy
        </Toolbar.Button>
        <Toolbar.Group disabled>
          <Toolbar.Input aria-label="Zoom" />
        </Toolbar.Group>
        <Toolbar.Separator />
      </Toolbar.Root>
    ));
    expect(attrs(html, "lu-toolbar")).toMatchObject({
      "aria-orientation": "vertical",
      "data-loop-focus": "false",
    });
    const [cut, copy] = [attrs(html, "button"), attrs(html, "button", (a) => "disabled" in a)];
    expect(cut).toMatchObject({ "aria-disabled": "true" });
    expect(cut).not.toHaveProperty("tabindex");
    expect(cut).not.toHaveProperty("disabled");
    expect(copy).toMatchObject({ disabled: "" });
    expect(attrs(html, "input")).toMatchObject({ readonly: "", "aria-disabled": "true" });
    expect(attrs(html, "hr")).toMatchObject({ "data-orientation": "horizontal" });
  });
});
