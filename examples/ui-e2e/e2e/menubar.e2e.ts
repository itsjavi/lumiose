// Menubar (TASK-379): the WAI-ARIA menubar pattern over Menu's popups. One tab stop for the bar,
// the arrow keys between its items (looping, Home, End, typeahead) and between open menus, the
// vertical orientation, hover switching once a menu is open, behaviour without JavaScript, the sync
// with signals in an island, and WCAG 2.2 AA with the default theme (doc-9 sections 1, 5 and 17).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { axe, clipped, lastNavLink, SCHEMES, smallTargets, TEXT_SPACING } from "./a11y.ts";

const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

/** A menubar by name, its items and its menus. */
function bar(page: Page, name: string) {
  const root = page.getByRole("menubar", { name });
  return {
    root,
    item: (label: string) => root.getByRole("menuitem", { name: label, exact: true }).first(),
    menu: (label: string) => page.getByRole("menu", { name: label, exact: true }),
  };
}

/** An item of `menu` by its exact name, whatever its role. */
const menuItem = (menu: Locator, name: string) =>
  menu
    .locator("[role^=menuitem]")
    .filter({ has: menu.page().getByText(name, { exact: true }) })
    .first();

/** Waits until the menubar script has made the bar one tab stop. */
async function ready(page: Page) {
  await expect(bar(page, "Editor").item("Edit")).toHaveAttribute("tabindex", "-1");
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("every trigger is a tab stop that opens its menu", async ({ page }) => {
    await page.goto("/menubar");
    const editor = bar(page, "Editor");
    await expect(editor.root.getByRole("menuitem")).toHaveCount(4);
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    await expect(editor.item("File")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(editor.item("Edit")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(editor.menu("Edit")).toBeVisible();
  });
});

test.describe("keyboard", () => {
  test("the bar is one tab stop, and focus comes back to its last item", async ({ page }) => {
    await page.goto("/menubar");
    await ready(page);
    const editor = bar(page, "Editor");
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    await expect(editor.item("File")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(editor.item("Edit")).toBeFocused();
    // Tab leaves the bar for the next one; Shift+Tab comes back to Edit.
    await page.keyboard.press("Tab");
    await expect(bar(page, "Workspace").item("Projects")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(editor.item("Edit")).toBeFocused();
  });

  test("arrows loop over the items, skipping a disabled one; Home, End and letters", async ({
    page,
  }) => {
    await page.goto("/menubar");
    await ready(page);
    const editor = bar(page, "Editor");
    await editor.item("File").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(editor.item("View")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(editor.item("File")).toBeFocused();
    await page.keyboard.press("End");
    await expect(editor.item("View")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(editor.item("File")).toBeFocused();
    await page.keyboard.press("e");
    await expect(editor.item("Edit")).toBeFocused();
    await expect(editor.menu("Edit")).toBeHidden();
  });

  test("Arrow Down and Up open a menu on its first or last item; Escape returns", async ({
    page,
  }) => {
    await page.goto("/menubar");
    await ready(page);
    const editor = bar(page, "Editor");
    await editor.item("Edit").focus();
    await page.keyboard.press("ArrowDown");
    await expect(menuItem(editor.menu("Edit"), "Undo")).toBeFocused();
    await expect(editor.root).toHaveAttribute("data-has-submenu-open");
    await expect(editor.item("Edit")).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(editor.menu("Edit")).toBeHidden();
    await expect(editor.item("Edit")).toBeFocused();
    await expect(editor.root).not.toHaveAttribute("data-has-submenu-open");
    await page.keyboard.press("ArrowUp");
    await expect(menuItem(editor.menu("Edit"), "Word wrap")).toBeFocused();
  });

  test("Arrow Right and Left in an open menu move to the next menu, opened", async ({ page }) => {
    await page.goto("/menubar");
    await ready(page);
    const editor = bar(page, "Editor");
    await editor.item("File").focus();
    await page.keyboard.press("Enter");
    const file = editor.menu("File");
    await expect(menuItem(file, "New file")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(file).toBeHidden();
    await expect(menuItem(editor.menu("Edit"), "Undo")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(editor.menu("Edit")).toBeHidden();
    await expect(menuItem(file, "New file")).toBeFocused();
    // Left from the first menu wraps to the last enabled one.
    await page.keyboard.press("ArrowLeft");
    await expect(editor.menu("View")).toBeVisible();
    await expect(file).toBeHidden();
  });

  test("a submenu takes Arrow Right first; from inside it, Right moves on", async ({ page }) => {
    await page.goto("/menubar");
    await ready(page);
    const editor = bar(page, "Editor");
    await editor.item("File").focus();
    await page.keyboard.press("ArrowDown");
    const file = editor.menu("File");
    await menuItem(file, "Share").focus();
    await page.keyboard.press("ArrowRight");
    const share = editor.menu("Share");
    await expect(menuItem(share, "Email")).toBeFocused();
    // Left closes the submenu only.
    await page.keyboard.press("ArrowLeft");
    await expect(share).toBeHidden();
    await expect(menuItem(file, "Share")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(menuItem(share, "Email")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(share).toBeHidden();
    await expect(file).toBeHidden();
    await expect(menuItem(editor.menu("Edit"), "Undo")).toBeFocused();
  });

  test("a vertical bar moves with Up and Down and opens with the arrow toward its popup", async ({
    page,
  }) => {
    await page.goto("/menubar");
    await ready(page);
    const workspace = bar(page, "Workspace");
    await expect(workspace.root).toHaveAttribute("aria-orientation", "vertical");
    await workspace.item("Projects").focus();
    await page.keyboard.press("ArrowDown");
    await expect(workspace.item("Settings")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(workspace.item("Projects")).toBeFocused();
    await expect(workspace.menu("Projects")).toBeHidden();
    await page.keyboard.press("ArrowRight");
    const projects = workspace.menu("Projects");
    await expect(menuItem(projects, "Lumiose")).toBeFocused();
    await expect(projects).toHaveAttribute("data-side", "inline-end");
    // The popup is beside the bar, not below it.
    const item = (await workspace.item("Projects").boundingBox())!;
    expect((await projects.boundingBox())!.x).toBeGreaterThanOrEqual(item.x + item.width - 1);
    await page.keyboard.press("ArrowLeft");
    await expect(projects).toBeHidden();
    await expect(workspace.item("Projects")).toBeFocused();
  });
});

test.describe("pointer", () => {
  test("once a menu is open, hovering another item opens its menu instead", async ({ page }) => {
    await page.goto("/menubar");
    await ready(page);
    const editor = bar(page, "Editor");
    // Closed, hovering opens nothing.
    await editor.item("Edit").hover();
    await page.waitForTimeout(200);
    await expect(editor.menu("Edit")).toBeHidden();
    await editor.item("File").click();
    await expect(editor.menu("File")).toBeVisible();
    await editor.item("Edit").hover();
    await expect(editor.menu("Edit")).toBeVisible();
    await expect(editor.menu("File")).toBeHidden();
    // The disabled item opens nothing.
    await editor.item("Help").hover({ force: true });
    await page.waitForTimeout(200);
    await expect(editor.menu("Edit")).toBeVisible();
    // An item runs and closes the menu.
    await menuItem(editor.menu("Edit"), "Undo").click();
    await expect(editor.menu("Edit")).toBeHidden();
    await expect(editor.root).not.toHaveAttribute("data-has-submenu-open");
  });
});

test.describe("in an island", () => {
  test("the File menu's open state, an item and a checkbox item follow signals", async ({
    page,
  }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/menubar/island");
    const doc = bar(page, "Document");
    const status = page.getByTestId("status");
    await expect(async () => {
      await page.getByTestId("open-file").click({ timeout: 250 });
      await expect(doc.menu("File")).toBeVisible({ timeout: 250 });
    }).toPass();
    await expect(status).toContainText("the File menu is open");
    await menuItem(doc.menu("File"), "Save").click();
    await expect(status).toHaveText("Saved; the File menu is closed; word wrap is off");
    // loopFocus={false}: the arrows stop at the ends.
    await doc.item("File").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(doc.item("File")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(doc.item("Edit")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(status).toContainText("word wrap is on");
    expect(warnings).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes closed and open, on the page and the island (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/menubar");
      await ready(page);
      expect(await axe(page)).toEqual([]);
      const editor = bar(page, "Editor");
      await editor.item("File").focus();
      await page.keyboard.press("ArrowDown");
      await menuItem(editor.menu("File"), "Share").focus();
      await page.keyboard.press("ArrowRight");
      await expect(editor.menu("Share")).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.goto("/menubar/island");
      await expect(bar(page, "Document").item("Edit")).toHaveAttribute("tabindex", "-1");
      expect(await axe(page)).toEqual([]);
    });
  }

  test("its items are 24px targets with a focus ring", async ({ page }) => {
    await page.goto("/menubar");
    await ready(page);
    expect(await smallTargets(page.locator("main"))).toEqual([]);
    const file = bar(page, "Editor").item("File");
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    await expect(file).toBeFocused();
    expect(await file.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
  });

  test("the page reflows at 320 CSS pixels with text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/menubar");
    await page.addStyleTag({ content: TEXT_SPACING });
    const main = page.locator("main");
    const box = (await main.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(await clipped(main)).toEqual([]);
  });
});
