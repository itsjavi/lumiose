// Server HTML of Menu (TASK-357): the markup alone must open the menu (`popovertarget`), anchor it
// to its trigger and carry the roles and states, since a server-rendered page runs only the
// client script. Behaviour in a browser (keyboard, focus, axe, no JavaScript) is checked by
// examples/ui-e2e.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { Menu } from "./menu.tsx";

/** The attributes of every `<tag …>` in `html`. */
function all(html: string, tag: string): Record<string, string>[] {
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "g"))].map((match) => {
    const out: Record<string, string> = {};
    for (const [, name, value] of match[1]!.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) {
      out[name!] = value ?? "";
    }
    return out;
  });
}

const attrs = (html: string, tag: string) => all(html, tag)[0]!;
const byRole = (html: string, role: string) =>
  [...all(html, "button"), ...all(html, "div"), ...all(html, "a")].filter((a) => a.role === role);

function Actions() {
  return (
    <Menu.Root>
      <Menu.Trigger class="trigger">Actions</Menu.Trigger>
      <Menu.Popup class="popup">
        <Menu.Item>Rename</Menu.Item>
        <Menu.Item disabled label="Remove">
          Delete…
        </Menu.Item>
        <Menu.LinkItem href="/help">Help</Menu.LinkItem>
        <Menu.Separator />
        <Menu.CheckboxItem defaultChecked>Pinned</Menu.CheckboxItem>
        <Menu.Group>
          <Menu.GroupLabel>Sort by</Menu.GroupLabel>
          <Menu.RadioGroup defaultValue="date">
            <Menu.RadioItem value="name">Name</Menu.RadioItem>
            <Menu.RadioItem value="date">Date</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Group>
      </Menu.Popup>
    </Menu.Root>
  );
}

describe("Menu on the server", () => {
  it("wires the trigger to the popup, anchors it and labels it by the trigger", async () => {
    const html = await renderToString(() => <Actions />);
    const trigger = attrs(html, "button");
    const [popup] = byRole(html, "menu");

    expect(html).toMatch(/^<lu-menu>/);
    expect(popup!.id).toBeTruthy();
    expect(trigger).toMatchObject({
      class: "trigger",
      type: "button",
      popovertarget: popup!.id,
      "aria-haspopup": "menu",
    });
    // aria-expanded comes from `popovertarget` until the client script runs: a static "false"
    // would be wrong once the menu opens without JavaScript.
    expect(trigger).not.toHaveProperty("aria-expanded");
    expect(popup).toMatchObject({
      class: "popup",
      popover: "auto",
      tabindex: "-1",
      "aria-labelledby": trigger.id,
      "data-side": "bottom",
      "data-align": "start",
    });
    const anchor = /anchor-name: ?(--[\w-]+)/.exec(trigger.style!)![1];
    expect(popup!.style).toContain(`position-anchor:${anchor}`);
    // Closed: a popover only opens from its trigger or script.
    expect(popup).not.toHaveProperty("open");
  });

  it("renders the items with their roles and states", async () => {
    const html = await renderToString(() => <Actions />);
    const items = byRole(html, "menuitem");
    expect(items.map((item) => item.type ?? "link")).toEqual(["button", "button", "link"]);
    expect(items[0]).not.toHaveProperty("aria-disabled");
    expect(items[0]).not.toHaveProperty("tabindex");
    expect(items[1]).toMatchObject({ "aria-disabled": "true", "data-label": "Remove" });
    expect(items[1]).not.toHaveProperty("disabled");
    expect(items[2]).toMatchObject({ href: "/help" });

    expect(byRole(html, "menuitemcheckbox")[0]).toMatchObject({ "aria-checked": "true" });
    const radios = byRole(html, "menuitemradio");
    expect(radios.map((radio) => [radio.value, radio["aria-checked"]])).toEqual([
      ["name", "false"],
      ["date", "true"],
    ]);
    expect(byRole(html, "separator")).toHaveLength(1);
  });

  it("labels a group by its GroupLabel, rendered after the group's attributes", async () => {
    const html = await renderToString(() => <Actions />);
    const [group, radioGroup] = byRole(html, "group");
    const label = byRole(html, "presentation")[0]!;
    expect(group!["aria-labelledby"]).toBe(label.id);
    expect(radioGroup).not.toHaveProperty("aria-labelledby");
  });

  it("places a submenu at the inline end of its trigger, an item of the parent menu", async () => {
    const html = await renderToString(() => (
      <Menu.Root>
        <Menu.Trigger>Edit</Menu.Trigger>
        <Menu.Popup side="top" align="end" sideOffset={4} alignOffset={-2}>
          <Menu.SubmenuRoot>
            <Menu.SubmenuTrigger disabled>Share</Menu.SubmenuTrigger>
            <Menu.Popup>
              <Menu.Item>Email</Menu.Item>
            </Menu.Popup>
          </Menu.SubmenuRoot>
        </Menu.Popup>
      </Menu.Root>
    ));
    expect(all(html, "lu-menu")).toHaveLength(2);
    const [popup, submenu] = byRole(html, "menu");
    expect(popup).toMatchObject({ "data-side": "top", "data-align": "end" });
    expect(popup!.style).toContain("--lu-side-offset:4px");
    expect(popup!.style).toContain("--lu-align-offset:-2px");
    expect(submenu).toMatchObject({ "data-side": "inline-end", "data-align": "start" });
    const subTrigger = byRole(html, "menuitem")[0]!;
    expect(subTrigger).toMatchObject({
      popovertarget: submenu!.id,
      "aria-haspopup": "menu",
      "aria-disabled": "true",
    });
    expect(submenu!["aria-labelledby"]).toBe(subTrigger.id);
  });

  it("passes props through, and keeps the wiring when they collide", async () => {
    const html = await renderToString(() => (
      <Menu.Root>
        <Menu.Trigger id="mine" popovertarget="elsewhere" style="color: red" data-x="1">
          Open
        </Menu.Trigger>
        <Menu.Popup id="other" role="listbox" aria-label="Commands" style={{ color: "blue" }}>
          <Menu.Item role="option" data-y="2" closeOnClick={false}>
            One
          </Menu.Item>
        </Menu.Popup>
      </Menu.Root>
    ));
    const trigger = attrs(html, "button");
    const popup = attrs(html, "div");
    expect(trigger["data-x"]).toBe("1");
    expect(trigger.id).not.toBe("mine");
    expect(trigger.popovertarget).toBe(popup.id);
    expect(trigger.style).toMatch(/anchor-name: --[\w-]+; color: red/);
    expect(popup).toMatchObject({ role: "menu", "aria-label": "Commands" });
    expect(popup.id).not.toBe("other");
    expect(popup.style).toContain("color:blue");
    expect(byRole(html, "menuitem")[0]).toMatchObject({
      "data-y": "2",
      "data-close-on-click": "false",
    });
  });

  it("gives each menu its own ids and anchor", async () => {
    const html = await renderToString(() => (
      <>
        <Actions />
        <Actions />
      </>
    ));
    const ids = byRole(html, "menu").map((popup) => popup.id);
    expect(new Set(ids).size).toBe(2);
    const anchors = [...html.matchAll(/anchor-name: ?(--[\w-]+)/g)].map((m) => m[1]);
    expect(new Set(anchors).size).toBe(2);
  });

  it("throws when a part is outside its root or group", async () => {
    await expect(renderToString(() => <Menu.Item>Lost</Menu.Item>)).rejects.toThrow(
      "Menu parts must be inside <Menu.Root>.",
    );
    await expect(
      renderToString(() => (
        <Menu.Root>
          <Menu.Popup>
            <Menu.RadioItem value="a">A</Menu.RadioItem>
          </Menu.Popup>
        </Menu.Root>
      )),
    ).rejects.toThrow("Menu.RadioItem must be inside <Menu.RadioGroup>.");
  });
});
