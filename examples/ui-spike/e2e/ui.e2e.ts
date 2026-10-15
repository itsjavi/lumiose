// TASK-332: the same dialog, menu and combobox on (a) @timelessui/components and (b) the port,
// checked for the APG keyboard paths, roles and focus, axe, behaviour before JavaScript, the glue
// with signals in an island, and what the server-rendered pages load.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const options = [
  { name: "a", path: "/a" },
  { name: "b", path: "/b" },
] as const;

const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

const axe = async (page: Page) => {
  const results = await new AxeBuilder({ page }).include("main").analyze();
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`);
};

for (const option of options) {
  test.describe(`option (${option.name})`, () => {
    test.describe("without JavaScript", () => {
      test.use({ javaScriptEnabled: false });

      test("the dialog and the menu open from the server HTML", async ({ page }) => {
        await page.goto(option.path);
        // Invoker commands open the dialog and popovertarget the menu: no script involved.
        await page.getByRole("button", { name: "Delete project…" }).click();
        await expect(page.getByRole("alertdialog", { name: "Delete project?" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("alertdialog")).toBeHidden();
        await page.getByRole("button", { name: "Actions" }).click();
        await expect(page.getByRole("menu", { name: "Actions" })).toBeVisible();
      });
    });

    test("dialog: keyboard, roles and focus", async ({ page }) => {
      await page.goto(option.path);
      const trigger = page.getByRole("button", { name: "Delete project…" });
      await trigger.focus();
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("alertdialog", { name: "Delete project?" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAccessibleDescription(
        "This removes the project and its 12 deployments.",
      );
      await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(dialog.getByRole("button", { name: "Delete" })).toBeFocused();
      expect(await axe(page)).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    });

    test("menu: keyboard, roles and focus", async ({ page }) => {
      await page.goto(option.path);
      const trigger = page.getByRole("button", { name: "Actions" });
      const menu = page.getByRole("menu", { name: "Actions" });
      const item = (name: string) => menu.getByRole("menuitem", { name });
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(menu).toBeVisible();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(item("Rename")).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(item("Duplicate")).toBeFocused();
      await page.keyboard.press("End");
      // Disabled items stay reachable (aria-disabled), as the APG recommends.
      await expect(item("Delete")).toBeFocused();
      await page.keyboard.press("Home");
      await expect(item("Rename")).toBeFocused();
      await page.keyboard.press("s");
      await expect(menu.getByRole("menuitemcheckbox", { name: "Show archived" })).toBeFocused();
      expect(await axe(page)).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      // Arrow Up opens on the last item that can run.
      await page.keyboard.press("ArrowUp");
      await expect(menu.getByRole("menuitemcheckbox", { name: "Show archived" })).toBeFocused();
    });

    test("menu: running an item closes the menu and returns focus", async ({ page }) => {
      // Timeless 0.2.0 leaves the menu open after an item runs; the APG closes it. On a
      // server-rendered page no wrapper code runs to make up for it.
      test.fail(option.name === "a", "upstream: ui-menu-button does not close on item activation");
      await page.goto(option.path);
      const trigger = page.getByRole("button", { name: "Actions" });
      const menu = page.getByRole("menu", { name: "Actions" });
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(menu.getByRole("menuitem", { name: "Rename" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(menu).toBeHidden();
      await expect(trigger).toBeFocused();
    });

    test("combobox: filtering, keyboard and selection", async ({ page }) => {
      await page.goto(option.path);
      const input = page.getByRole("combobox", { name: "City" });
      const listbox = page.getByRole("listbox", { name: "City" });
      await input.focus();
      await page.keyboard.type("l");
      await expect(listbox).toBeVisible();
      await expect(input).toHaveAttribute("aria-expanded", "true");
      await expect(listbox.getByRole("option")).toHaveText([
        "Barcelona",
        "Berlin",
        "Lisbon",
        "London",
      ]);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      const berlin = listbox.getByRole("option", { name: "Berlin" });
      await expect(input).toHaveAttribute(
        "aria-activedescendant",
        (await berlin.getAttribute("id"))!,
      );
      expect(await axe(page)).toEqual([]);
      await page.keyboard.press("Enter");
      await expect(listbox).toBeHidden();
      await expect(input).toHaveAttribute("aria-expanded", "false");
      // The listbox is closed, so its options are out of the accessibility tree.
      await expect(page.locator("[role=option]", { hasText: /^Berlin$/ })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      // (a) Timeless's combobox value is the input text, so the input shows the option's value;
      // (b) shows its label (Base UI's model).
      await expect(input).toHaveValue(option.name === "a" ? "berlin" : "Berlin");
      await expect(input).toBeFocused();
    });

    test("the server-rendered page hydrates nothing", async ({ page }) => {
      const scripts: string[] = [];
      page.on("request", (request) => {
        if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
      });
      await page.goto(option.path);
      // The elements upgraded the server HTML: no island record, no island loader.
      await expect(
        page.locator(option.name === "a" ? "ui-combobox" : "lu-combobox"),
      ).toHaveJSProperty("value", "");
      await expect(page.locator("script[data-l-islands]")).toHaveCount(0);
      expect(scripts.filter((path) => path.includes("loader"))).toEqual([]);
      expect(await axe(page)).toEqual([]);
      // Finding: in a build, the dynamic import() in instrumentation.client.ts needs Vite's preload
      // helper, which sits in the shared runtime chunk, so these pages still download it.
      test.info().annotations.push({ type: "scripts", description: scripts.join(" ") });
    });

    test("in an island, the widgets follow signals both ways", async ({ page }) => {
      const warnings = lumioseWarnings(page);
      await page.goto(`${option.path}/signals`);
      const state = (id: string) => page.getByTestId(id);
      const host = page.locator(option.name === "a" ? "ui-combobox" : "lu-combobox");
      await expect(host).toHaveJSProperty("value", "berlin");

      // Dialog: a signal opens it, the close button reports back.
      await page.getByTestId("open-by-signal").click();
      const dialog = page.getByRole("dialog", { name: "Edit profile" });
      await expect(dialog).toBeVisible();
      await expect(state("dialog-state")).toHaveText("open: true");
      await dialog.getByRole("button", { name: "Done" }).click();
      await expect(state("dialog-state")).toHaveText("open: false");

      // Menu: items run handlers, the checkbox item writes a signal.
      await page.getByRole("button", { name: "Actions" }).click();
      await page.getByRole("menuitem", { name: "Duplicate" }).click();
      await expect(state("menu-state")).toHaveText("last: duplicate, archived: false");
      await page.getByRole("button", { name: "Actions" }).click();
      await page.getByRole("menuitemcheckbox", { name: "Show archived" }).click();
      await expect(state("menu-state")).toHaveText("last: duplicate, archived: true");
      await page.keyboard.press("Escape");

      // Combobox: a signal selects, options added by the island are filtered and selectable.
      const combobox = page.getByRole("combobox", { name: "City" });
      await page.getByTestId("pick-lisbon").click();
      await expect(host).toHaveJSProperty("value", "lisbon");
      await page.getByTestId("add-zurich").click();
      await combobox.fill("zu");
      await expect(page.getByRole("listbox", { name: "City" }).getByRole("option")).toHaveText([
        "Zurich",
      ]);
      await page.getByRole("option", { name: "Zurich" }).click();
      await expect(state("combobox-state")).toHaveText("city: zurich");

      expect(warnings).toEqual([]);
    });
  });
}
