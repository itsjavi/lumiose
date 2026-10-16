// Server HTML of Toolbar (TASK-383): `role="toolbar"` with its orientation, one tab stop on the
// first item (a ToggleGroup's toggles included), disabled items that stay focusable, groups and a
// separator across the toolbar.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { Toggle } from "../toggle/toggle.tsx";
import { ToggleGroup } from "../toggle-group/toggle-group.tsx";
import { Toolbar } from "./toolbar.tsx";

const tabindexes = (html: string) =>
  [...html.matchAll(/<(button|a|input)\b([^>]*)>/g)].map((m) => attrs(`<x${m[2]}>`, "x").tabindex);

describe("Toolbar on the server", () => {
  it("is a toolbar with one tab stop, on its first item, toggles included", async () => {
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
    expect(tabindexes(html)).toEqual(["0", "-1", "-1", "-1", "-1"]);
    expect(attrs(html, "hr")).toMatchObject({
      "aria-orientation": "vertical",
      "data-orientation": "vertical",
    });
    expect(attrs(html, "div", (a) => a.role === "group")).toMatchObject({
      "aria-label": "Actions",
      "data-orientation": "horizontal",
    });
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
    expect(cut).toMatchObject({ tabindex: "0", "aria-disabled": "true" });
    expect(cut).not.toHaveProperty("disabled");
    expect(copy).toMatchObject({ disabled: "" });
    expect(attrs(html, "input")).toMatchObject({ readonly: "", "aria-disabled": "true" });
    expect(attrs(html, "hr")).toMatchObject({ "data-orientation": "horizontal" });
  });
});
