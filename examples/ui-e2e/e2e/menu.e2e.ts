// Menu (TASK-357): the APG Menu Button keyboard contract, focus on open and its return on close,
// typeahead, checkbox and radio items, submenus (right to left too), pointer behaviour (hover,
// press-drag-release, hover intent, light dismiss), placement, behaviour without JavaScript, the
// sync with signals in an island, and WCAG 2.2 AA with the default theme (doc-9 sections 5 and 17).
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  axe,
  clipped,
  focusRing,
  lastNavLink,
  SCHEMES,
  smallTargets,
  TEXT_SPACING,
} from "./a11y.ts";

const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

/** An item of `menu` by its exact name, whatever its role. */
function menuItem(menu: Locator, name: string): Locator {
  return menu
    .locator("[role^=menuitem]")
    .filter({ has: menu.page().getByText(name, { exact: true }) })
    .first();
}

/** The Actions menu of /menu and its trigger. */
function actions(page: Page) {
  const trigger = page.getByRole("button", { name: "Actions" });
  const menu = page.getByRole("menu", { name: "Actions" });
  return { trigger, menu, item: (name: string) => menuItem(menu, name) };
}

/** The island's state line on /menu/island. */
const state = (page: Page) => page.getByTestId("menu-state");

const center = async (locator: Locator) => {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the menu opens from the server HTML; Tab reaches the items and Escape closes it", async ({
    page,
  }) => {
    await page.goto("/menu");
    const { trigger, menu, item } = actions(page);
    await trigger.click();
    await expect(menu).toBeVisible();
    // The popover's contents follow its trigger in the focus order.
    await page.keyboard.press("Tab");
    await expect(item("Rename")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await item("Help").click();
    await expect(page).toHaveURL(/#help$/);
  });
});

test.describe("keyboard contract (APG Menu Button)", () => {
  test("Enter opens on the first item; arrows loop, Home and End; Escape returns focus", async ({
    page,
  }) => {
    await page.goto("/menu");
    const { trigger, menu, item } = actions(page);
    await expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(item("Rename")).toBeFocused();
    await expect(item("Rename")).toHaveAttribute("data-highlighted");

    await page.keyboard.press("ArrowDown");
    await expect(item("Duplicate")).toBeFocused();
    await expect(item("Rename")).not.toHaveAttribute("data-highlighted");
    await page.keyboard.press("End");
    // Disabled items stay reachable.
    await expect(item("Delete")).toBeFocused();
    await expect(item("Delete")).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("ArrowDown");
    await expect(item("Rename")).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(item("Delete")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(item("Rename")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("Space and Arrow Down open on the first item, Arrow Up on the last that can run", async ({
    page,
  }) => {
    await page.goto("/menu");
    const { trigger, menu, item } = actions(page);
    for (const [key, first] of [
      [" ", "Rename"],
      ["ArrowDown", "Rename"],
      ["ArrowUp", "Share"],
    ] as const) {
      await trigger.focus();
      await page.keyboard.press(key);
      await expect(menu).toBeVisible();
      await expect(item(first)).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
    }
  });

  test("typeahead: a letter cycles, more letters refine, Space while typing is text", async ({
    page,
  }) => {
    await page.goto("/menu");
    const { trigger, menu, item } = actions(page);
    await trigger.focus();
    await page.keyboard.press("Enter");
    for (const name of ["Duplicate", "Date", "Delete", "Duplicate"]) {
      await page.keyboard.press("d");
      await expect(item(name)).toBeFocused();
    }
    await page.waitForTimeout(800);
    await page.keyboard.press("s");
    await expect(item("Size")).toBeFocused();
    await page.keyboard.press("h");
    await expect(item("Share")).toBeFocused();
    // Space during a search does not open the Share submenu.
    await page.keyboard.press(" ");
    await expect(page.getByRole("menu", { name: "Share" })).toBeHidden();
    await expect(menu).toBeVisible();
  });

  test("running an item closes the menu and returns focus; checkbox and radio items stay open", async ({
    page,
  }) => {
    await page.goto("/menu");
    const { trigger, menu, item } = actions(page);
    await trigger.focus();
    await page.keyboard.press("Enter");
    const pinned = item("Pinned");
    await expect(pinned).toHaveAttribute("role", "menuitemcheckbox");
    await expect(pinned).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("p");
    await expect(pinned).toBeFocused();
    // Space right after a letter would be typed text.
    await page.waitForTimeout(800);
    await page.keyboard.press(" ");
    await expect(pinned).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("Enter");
    await expect(pinned).toHaveAttribute("aria-checked", "true");
    await expect(menu).toBeVisible();

    const [name, date] = [item("Name"), item("Date")];
    await expect(name).toHaveAttribute("role", "menuitemradio");
    await expect(date).toHaveAttribute("aria-checked", "true");
    await name.focus();
    await page.keyboard.press(" ");
    await expect(name).toHaveAttribute("aria-checked", "true");
    await expect(date).toHaveAttribute("aria-checked", "false");
    await expect(menu).toBeVisible();
    // The radio group is named by its label.
    await expect(menu.getByRole("group", { name: "Sort by" })).toBeVisible();

    await item("Rename").focus();
    await page.keyboard.press("Enter");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    // A disabled item does not run.
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowDown");
    await expect(item("Delete")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();

    // Enter on a link item follows it and closes the menu.
    await item("Help").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#help$/);
    await expect(menu).toBeHidden();
  });

  test("Tab closes the menu and moves on; Shift+Tab closes it onto the trigger", async ({
    page,
  }) => {
    await page.goto("/menu");
    const { trigger, menu } = actions(page);
    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    await expect(menu).toBeHidden();
    await expect(page.getByRole("button", { name: "After the menu" })).toBeFocused();

    await trigger.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Shift+Tab");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("submenus: Arrow Right and Enter open them, Arrow Left and Escape close one level", async ({
    page,
  }) => {
    await page.goto("/menu");
    const { trigger, menu, item } = actions(page);
    const share = page.getByRole("menu", { name: "Share" });
    const more = page.getByRole("menu", { name: "More" });
    await trigger.focus();
    await page.keyboard.press("ArrowUp");
    await expect(item("Share")).toBeFocused();
    await expect(item("Share")).toHaveAttribute("aria-haspopup", "menu");
    await page.keyboard.press("ArrowRight");
    await expect(share).toBeVisible();
    await expect(item("Share")).toHaveAttribute("aria-expanded", "true");
    await expect(item("Email")).toBeFocused();
    await page.keyboard.press("End");
    await expect(item("More")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(item("Embed")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(more).toBeHidden();
    await expect(share).toBeVisible();
    await expect(item("More")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(share).toBeHidden();
    await expect(menu).toBeVisible();
    await expect(item("Share")).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(item("Email")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    // Running an item closes the whole menu.
    await expect(share).toBeHidden();
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("right to left: Arrow Left opens a submenu on the left, Arrow Right closes it", async ({
    page,
  }) => {
    await page.goto("/menu");
    const trigger = page.getByRole("button", { name: "ملف" });
    const root = page.getByRole("menu", { name: "ملف" });
    const sub = page.getByRole("menu", { name: "تصدير" });
    await trigger.focus();
    await page.keyboard.press("ArrowUp");
    const exportItem = menuItem(root, "تصدير");
    await expect(exportItem).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(sub).toBeHidden();
    await page.keyboard.press("ArrowLeft");
    await expect(sub).toBeVisible();
    await expect(menuItem(sub, "PDF")).toBeFocused();
    const [itemBox, subBox] = [(await exportItem.boundingBox())!, (await sub.boundingBox())!];
    expect(subBox.x + subBox.width).toBeLessThanOrEqual(itemBox.x);
    await page.keyboard.press("ArrowRight");
    await expect(sub).toBeHidden();
    await expect(exportItem).toBeFocused();
  });
});

test.describe("pointer", () => {
  test("a click opens the menu on the popup, hovering highlights, leaving clears it", async ({
    page,
  }) => {
    await page.goto("/menu");
    const { trigger, menu, item } = actions(page);
    await trigger.click();
    await expect(menu).toBeVisible();
    await expect(menu).toBeFocused();
    await expect(menu.locator("[data-highlighted]")).toHaveCount(0);
    await item("Duplicate").hover();
    await expect(item("Duplicate")).toBeFocused();
    await expect(item("Duplicate")).toHaveAttribute("data-highlighted");
    const box = (await menu.boundingBox())!;
    await page.mouse.move(box.x + box.width + 40, box.y + 10, { steps: 4 });
    await expect(menu.locator("[data-highlighted]")).toHaveCount(0);
    await expect(menu).toBeFocused();
    // A second click on the trigger closes it.
    await trigger.click();
    await expect(menu).toBeHidden();
  });

  test("a right-click or a middle click outside does not close the menu", async ({ page }) => {
    // Base UI and Zag ignore secondary buttons (doc-9, section 1); the native light dismiss does
    // not and cannot be canceled, so lu-menu makes the popup a manual popover and dismisses it.
    await page.goto("/menu");
    const { trigger, menu, item } = actions(page);
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(item("Rename")).toBeFocused();
    const heading = page.getByRole("heading", { name: "Placement" });
    // The page still gets the right-click.
    const contextMenu = page.evaluate(
      () =>
        new Promise<string>((resolve) =>
          document.addEventListener(
            "contextmenu",
            (event) => {
              event.preventDefault();
              resolve((event.target as Element).textContent ?? "");
            },
            { once: true },
          ),
        ),
    );
    await heading.click({ button: "right" });
    expect(await contextMenu).toBe("Placement");
    await heading.click({ button: "middle" });
    await expect(menu).toBeVisible();
    await expect(page.getByRole("menu")).toHaveCount(1);
    await heading.click();
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("a click outside closes the menu; focus returns unless it landed on a button", async ({
    page,
  }) => {
    await page.goto("/menu");
    const { trigger, menu } = actions(page);
    await trigger.click();
    await expect(menu).toBeVisible();
    await page.getByRole("heading", { name: "Menu", exact: true }).click();
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    const elsewhere = page.getByRole("button", { name: "Elsewhere" });
    await elsewhere.click();
    await expect(menu).toBeHidden();
    await expect(elsewhere).toBeFocused();
  });

  test("a submenu opens on hover and stays open while the pointer crosses a sibling", async ({
    page,
  }) => {
    await page.goto("/menu");
    const { trigger, menu, item } = actions(page);
    const share = page.getByRole("menu", { name: "Share" });
    await trigger.click();
    await item("Share").hover();
    await expect(share).toBeVisible();
    // Focus stays on the trigger of a submenu opened by hover.
    await expect(item("Share")).toBeFocused();
    // Diagonally down into the submenu, over Delete, the item below Share.
    const from = await center(item("Share"));
    const shareBox = (await item("Share").boundingBox())!;
    const to = await center(item("Copy link"));
    await page.mouse.move(shareBox.x + 12, from.y);
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await expect(share).toBeVisible();
    await expect(item("Copy link")).toBeFocused();

    // Hovering a sibling for good closes it.
    await item("Rename").hover();
    await expect(share).toBeHidden();
    await expect(item("Rename")).toBeFocused();
    await expect(menu).toBeVisible();

    // A click outside closes the whole tree.
    await item("Share").hover();
    await expect(share).toBeVisible();
    await page.getByRole("heading", { name: "Menu", exact: true }).click();
    await expect(share).toBeHidden();
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("a submenu sits at the inline end of its trigger, the menu below its trigger", async ({
    page,
  }) => {
    // Tall enough that the submenu fits below its trigger under the layout's growing nav, so
    // anchor positioning has no reason to shift it.
    await page.goto("/menu");
    const { trigger, menu, item } = actions(page);
    await trigger.click();
    const [t, m] = [(await trigger.boundingBox())!, (await menu.boundingBox())!];
    // The default theme's 4px gap, aligned at the start.
    expect(Math.round(m.y - (t.y + t.height))).toBe(4);
    expect(Math.round(m.x - t.x)).toBe(0);
    await item("Share").hover();
    const share = page.getByRole("menu", { name: "Share" });
    await expect(share).toBeVisible();
    const [s, st] = [(await share.boundingBox())!, (await item("Share").boundingBox())!];
    expect(s.x).toBeGreaterThan(st.x + st.width - 8);
    expect(Math.abs(s.y + 5 - st.y)).toBeLessThanOrEqual(1);

    // side="top" align="end" sideOffset={8}
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    const above = page.getByRole("button", { name: "Above, end-aligned" });
    await above.click();
    const top = page.getByRole("menu", { name: "Above, end-aligned" });
    await expect(top).toBeVisible();
    const [a, p] = [(await above.boundingBox())!, (await top.boundingBox())!];
    expect(Math.round(a.y - (p.y + p.height))).toBe(8);
    expect(Math.round(a.x + a.width - (p.x + p.width))).toBe(0);
  });

  test("a server-rendered page with menus loads only Menu's client script", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await page.goto("/menu");
    await actions(page).trigger.focus();
    await page.keyboard.press("Enter");
    await expect(actions(page).item("Rename")).toBeFocused();
    // Menu's script, the dismissal model it shares with Popover and Combobox, and the placement
    // fallback it shares with Popover and Tooltip; no island runtime.
    expect(scripts.toSorted()).toEqual([
      expect.stringMatching(/\/layer-[\w-]+\.js$/),
      expect.stringMatching(/\/menu\.script-[\w-]+\.js$/),
      expect.stringMatching(/\/place-[\w-]+\.js$/),
    ]);
    await expect(page.locator("script[data-l-islands]")).toHaveCount(0);
  });
});

test.describe("with dialogs (doc-9 section 1)", () => {
  test("inside a modal dialog, Escape closes the menu first, then the dialog", async ({ page }) => {
    await page.goto("/menu/dialog");
    await page.getByRole("button", { name: "Edit document" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit document" });
    const trigger = dialog.getByRole("button", { name: "Insert" });
    const menu = page.getByRole("menu", { name: "Insert" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(menuItem(menu, "Image")).toBeFocused();
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(trigger).toBeFocused();
    // A click inside the dialog but outside the menu closes the menu only.
    await trigger.click();
    await expect(menu).toBeVisible();
    await dialog.getByRole("heading", { name: "Edit document" }).click();
    await expect(menu).toBeHidden();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("an item that opens a dialog closes the menu, and focus returns to its trigger", async ({
    page,
  }) => {
    await page.goto("/menu/dialog");
    const trigger = page.getByRole("button", { name: "File" });
    const menu = page.getByRole("menu", { name: "File" });
    await trigger.focus();
    await page.keyboard.press("ArrowUp");
    await expect(menuItem(menu, "Rename…")).toBeFocused();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Rename file" });
    await expect(dialog).toBeVisible();
    await expect(menu).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("in an island", () => {
  test("open and onOpenChange keep a signal in sync both ways", async ({ page }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/menu/island");
    const trigger = page.getByRole("button", { name: "View" });
    const menu = page.getByRole("menu", { name: "View" });
    await expect(state(page)).toHaveText("open: false, wrap: true, view: list, ran: none");

    await page.getByTestId("open-by-signal").click();
    await expect(menu).toBeVisible();
    await expect(state(page)).toContainText("open: true");
    await expect(menuItem(menu, "Refresh")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(state(page)).toContainText("open: false");
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(state(page)).toContainText("open: true");
    await menuItem(menu, "Refresh").click();
    await expect(menu).toBeHidden();
    await expect(state(page)).toHaveText("open: false, wrap: true, view: list, ran: refresh");
    expect(warnings).toEqual([]);
  });

  test("bind:checked and bind:value keep signals in sync both ways", async ({ page }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/menu/island");
    const menu = page.getByRole("menu", { name: "View" });
    await page.getByRole("button", { name: "View" }).click();
    const wrap = menuItem(menu, "Wrap lines");
    await expect(wrap).toHaveAttribute("aria-checked", "true");
    await wrap.click();
    await expect(state(page)).toContainText("wrap: false");
    await expect(wrap).toHaveAttribute("aria-checked", "false");
    await menuItem(menu, "Grid").click();
    await expect(state(page)).toContainText("view: grid");
    await expect(menuItem(menu, "Grid")).toHaveAttribute("aria-checked", "true");
    await expect(menuItem(menu, "List")).toHaveAttribute("aria-checked", "false");
    await expect(menu).toBeVisible();

    // The signal drives the item too.
    await page.keyboard.press("Escape");
    await page.getByTestId("toggle-wrap").click();
    await expect(state(page)).toContainText("wrap: true");
    await page.getByRole("button", { name: "View" }).click();
    await expect(wrap).toHaveAttribute("aria-checked", "true");
    expect(warnings).toEqual([]);
  });

  test("a press on the trigger, a drag and a release on an item runs it", async ({ page }) => {
    await page.goto("/menu/island");
    const trigger = page.getByRole("button", { name: "View" });
    const menu = page.getByRole("menu", { name: "View" });
    const from = await center(trigger);
    // Hydrated: the island's state line answers.
    await page.getByTestId("toggle-wrap").click();
    await expect(state(page)).toContainText("wrap: false");

    // A release right after the press opened the menu does not run the item under it.
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await expect(menu).toBeVisible();
    const to = await center(menuItem(menu, "Refresh"));
    await page.mouse.move(to.x, to.y);
    await page.mouse.up();
    await expect(menu).toBeVisible();
    await expect(state(page)).toContainText("ran: none");
    await page.keyboard.press("Escape");

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await expect(menu).toBeVisible();
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.waitForTimeout(250);
    await page.mouse.up();
    await expect(menu).toBeHidden();
    await expect(state(page)).toContainText("ran: refresh");
    await expect(trigger).toBeFocused();
  });
});

/** Whether `locator`'s box lies inside the viewport. */
async function inView(page: Page, locator: Locator) {
  const box = (await locator.boundingBox())!;
  const { height, width } = page.viewportSize()!;
  return (
    box.y >= -1 && box.x >= -1 && box.y + box.height <= height + 1 && box.x + box.width <= width + 1
  );
}

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  test("at 200% zoom the menu fits beside its trigger and scrolls to the focused item (1.4.10, 2.4.7, TASK-428)", async ({
    page,
  }) => {
    // 1280 by 800 at 200%.
    await page.setViewportSize({ width: 640, height: 400 });
    await page.goto("/menu");
    const { trigger, item } = actions(page);
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(item("Rename")).toBeFocused();
    await page.keyboard.press("End");
    await expect(item("Delete")).toBeFocused();
    await expect.poll(() => inView(page, page.getByRole("menu").first())).toBe(true);
    await expect.poll(() => inView(page, item("Delete"))).toBe(true);
  });

  for (const scheme of SCHEMES) {
    test(`axe passes closed and open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/menu");
      expect(await axe(page)).toEqual([]);
      const { trigger, item } = actions(page);
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(item("Rename")).toBeFocused();
      expect(await axe(page)).toEqual([]);
      await page.keyboard.press("End");
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("End");
      await page.keyboard.press("ArrowRight");
      await expect(item("Embed")).toBeFocused();
      expect(await axe(page)).toEqual([]);
      await page.keyboard.press("Tab");

      await page.getByRole("button", { name: "ملف" }).click();
      await expect(page.getByRole("menu", { name: "ملف" })).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.keyboard.press("Escape");

      await page.goto("/menu/island");
      expect(await axe(page)).toEqual([]);
      await page.getByTestId("open-by-signal").click();
      await expect(page.getByRole("menu", { name: "View" })).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus is visible on the trigger and on the items (2.4.7)", async ({ page }) => {
    await page.goto("/menu");
    const { trigger, item } = actions(page);
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    await expect(trigger).toBeFocused();
    expect(await focusRing(page)).toBe("2px solid");
    await page.keyboard.press("Enter");
    await expect(item("Rename")).toBeFocused();
    expect(await focusRing(page)).toBe("2px solid");
  });

  test("items are at least 24 by 24 CSS pixels (2.5.8)", async ({ page }) => {
    await page.goto("/menu");
    const { trigger, menu } = actions(page);
    await trigger.click();
    expect(await smallTargets(menu)).toEqual([]);
  });

  test("the menu reflows at 320 CSS pixels and survives text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/menu");
    await page.addStyleTag({ content: TEXT_SPACING });
    const { trigger, menu } = actions(page);
    await trigger.click();
    await expect(menu).toBeVisible();
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(await clipped(menu)).toEqual([]);
  });
});

test.describe("right to left, in the production CSS too (TASK-385)", () => {
  test("a submenu item's arrow points left", async ({ page }) => {
    await page.goto("/menu");
    await page.evaluate(() => (document.documentElement.dir = "rtl"));
    const { trigger, item } = actions(page);
    await trigger.click();
    const arrow = await item("Share").evaluate((el) => getComputedStyle(el, "::after").content);
    expect(arrow).toContain("‹");
  });
});
