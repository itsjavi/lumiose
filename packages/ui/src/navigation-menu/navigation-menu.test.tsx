// Server HTML of Navigation Menu (TASK-380): a `<nav>` landmark inside `<lu-navigation-menu>`, a
// list of items whose triggers open their contents through `popovertarget`, each content a
// `popover="auto"` anchored to its trigger, links marked as the current page, a vertical
// orientation, and a nested menu rendering a `<div>`.
import { renderToString } from "lumiose";
import { describe, expect, it } from "vitest";
import { attrs } from "../test/html.ts";
import { NavigationMenu } from "./navigation-menu.tsx";

describe("NavigationMenu on the server", () => {
  it("renders a nav whose triggers open their contents, and links", async () => {
    const html = await renderToString(() => (
      <NavigationMenu.Root aria-label="Main" class="nav" delay={100} closeDelay={200}>
        <NavigationMenu.List>
          <NavigationMenu.Item value="products">
            <NavigationMenu.Trigger>
              Products <NavigationMenu.Icon>▾</NavigationMenu.Icon>
            </NavigationMenu.Trigger>
            <NavigationMenu.Content class="panel">
              <NavigationMenu.Link href="/analytics">Analytics</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
          <NavigationMenu.Item>
            <NavigationMenu.Link href="/pricing" active>
              Pricing
            </NavigationMenu.Link>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
    ));
    expect(attrs(html, "lu-navigation-menu")).toEqual({
      "data-delay": "100",
      "data-close-delay": "200",
      "data-orientation": "horizontal",
    });
    expect(attrs(html, "nav")).toEqual({
      "aria-label": "Main",
      class: "nav",
      "data-orientation": "horizontal",
    });
    const trigger = attrs(html, "button");
    expect(attrs(html, "li")).toEqual({ "data-value": "products" });
    expect(trigger).toMatchObject({
      type: "button",
      popovertarget: trigger.id!.replace("trigger", "content"),
    });
    expect(trigger.style).toMatch(/^anchor-name:\s*--lu-/);
    expect(attrs(html, "span")).toEqual({ "aria-hidden": "true" });
    expect(attrs(html, "div")).toMatchObject({
      class: "panel",
      id: trigger.popovertarget,
      popover: "auto",
      "data-side": "bottom",
      "data-align": "center",
    });
    expect(attrs(html, "a", (a) => a.href === "/pricing")).toEqual({
      href: "/pricing",
      "aria-current": "page",
      "data-active": "",
    });
    expect(attrs(html, "a")).toEqual({ href: "/analytics" });
  });

  it("places a vertical menu's contents at the inline end, and nests a menu as a div", async () => {
    const html = await renderToString(() => (
      <NavigationMenu.Root aria-label="Sidebar" orientation="vertical">
        <NavigationMenu.List>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>Account</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Root>
                <NavigationMenu.List>
                  <NavigationMenu.Item>
                    <NavigationMenu.Link href="/profile">Profile</NavigationMenu.Link>
                  </NavigationMenu.Item>
                </NavigationMenu.List>
              </NavigationMenu.Root>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
    ));
    // The nested menu is a div, inside the outer landmark.
    expect(html.match(/<nav\b/g)).toHaveLength(1);
    expect(attrs(html, "div", (a) => a.popover === undefined)).toEqual({
      "data-orientation": "horizontal",
    });
    expect(attrs(html, "div", (a) => a.popover === "auto")).toMatchObject({
      "data-side": "inline-end",
      "data-align": "start",
    });
  });
});
