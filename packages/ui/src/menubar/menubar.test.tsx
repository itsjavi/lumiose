// Server HTML of Menubar (TASK-379): `<lu-menubar role="menubar">` with its orientation; inside it,
// each top-level menu's `<lu-menu>` is `role="none"` and its trigger a `role="menuitem"`, as in the
// APG example; submenus and Menus outside a menubar keep Menu's markup.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { Menu } from "../menu/menu.tsx";
import { attrs } from "../test/html.ts";
import { Menubar } from "./menubar.tsx";

const file = () => (
  <Menu.Root>
    <Menu.Trigger>File</Menu.Trigger>
    <Menu.Popup>
      <Menu.Item>New</Menu.Item>
      <Menu.SubmenuRoot>
        <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
        <Menu.Popup>
          <Menu.Item>Email</Menu.Item>
        </Menu.Popup>
      </Menu.SubmenuRoot>
    </Menu.Popup>
  </Menu.Root>
);

describe("Menubar on the server", () => {
  it("renders a horizontal menubar whose items are its menus' triggers", async () => {
    const html = await renderToString(() => (
      <Menubar aria-label="Editor" class="bar">
        {file()}
      </Menubar>
    ));
    expect(attrs(html, "lu-menubar")).toEqual({
      "aria-label": "Editor",
      class: "bar",
      role: "menubar",
      "aria-orientation": "horizontal",
      "data-orientation": "horizontal",
    });
    const [top, submenu] = [...html.matchAll(/<lu-menu(?=[\s>])([^>]*)>/g)].map(
      (match) => match[1],
    );
    expect(top).toBe(' role="none"');
    expect(submenu).toBe("");
    expect(attrs(html, "button")).toMatchObject({ role: "menuitem", "aria-haspopup": "menu" });
    expect(attrs(html, "div", (a) => a.role === "menu")).toMatchObject({ "data-side": "bottom" });
    // Both triggers are menu items: the bar's, and the submenu's.
    const triggers = [...html.matchAll(/<button [^>]*aria-haspopup="menu"[^>]*>/g)];
    expect(triggers.map((match) => /role="(\w+)"/.exec(match[0])?.[1])).toEqual([
      "menuitem",
      "menuitem",
    ]);
    expect(
      [...html.matchAll(/role="menu" popover="auto" data-side="([\w-]+)"/g)].map((m) => m[1]),
    ).toEqual(["bottom", "inline-end"]);
  });

  it("places a vertical menubar's popups at the inline end, and can stop at the ends", async () => {
    const html = await renderToString(() => (
      <Menubar orientation="vertical" loopFocus={false}>
        {file()}
      </Menubar>
    ));
    expect(attrs(html, "lu-menubar")).toMatchObject({
      "aria-orientation": "vertical",
      "data-loop-focus": "false",
    });
    expect(attrs(html, "div", (a) => a.role === "menu")).toMatchObject({
      "data-side": "inline-end",
    });
  });

  it("leaves a Menu outside a menubar as it was", async () => {
    const html = await renderToString(file);
    expect(html).toMatch(/^<lu-menu><button type="button" id="[^"]+-trigger" popovertarget=/);
  });
});
