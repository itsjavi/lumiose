// Context Menu (TASK-378): Menu opened at the pointer by a right-click in its trigger area, a long
// press on a touch screen, or Shift+F10 and the ContextMenu key (WCAG 2.5.1); Menu's keys, items
// and submenus inside it; dismissal and focus return; the disabled area; the sync with signals in
// an island; and WCAG 2.2 AA with the default theme.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { axe, focusRing, SCHEMES, smallTargets } from "./a11y.ts";

/** Puts the whole page right to left. */
const rtl = (page: Page) => page.evaluate(() => (document.documentElement.dir = "rtl"));

const area = (page: Page, id = "area") => page.getByTestId(id);
const menu = (page: Page, name = "File actions") => page.getByRole("menu", { name });
const item = (page: Page, name: string) => page.getByRole("menuitem", { name, exact: true });
const isOpen = (popup: Locator) => popup.evaluate((el) => el.matches(":popover-open"));

/** Right-clicks `target` at `x`, `y` (relative to its box) and returns the viewport point. */
async function rightClick(target: Locator, x = 40, y = 30) {
  const box = (await target.boundingBox())!;
  await target.click({ button: "right", position: { x, y } });
  return { x: box.x + x, y: box.y + y };
}

/** A touch press of `ms` at `x`, `y` of `target`, as pointer events, moving by `move` px. */
async function touchPress(target: Locator, ms: number, move = 0) {
  const box = (await target.boundingBox())!;
  const x = box.x + 50;
  const y = box.y + 30;
  const init = { pointerType: "touch", isPrimary: true, pointerId: 7, clientX: x, clientY: y };
  await target.dispatchEvent("pointerdown", init);
  if (move) await target.dispatchEvent("pointermove", { ...init, clientX: x + move });
  await target.page().waitForTimeout(ms);
  await target.dispatchEvent("pointerup", init);
  return { x, y };
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the area renders and the browser keeps its own menu", async ({ page }) => {
    await page.goto("/context-menu");
    await expect(area(page)).toBeVisible();
    await area(page).click({ button: "right" });
    await expect(page.getByRole("menu")).toHaveCount(0);
  });
});

test.describe("opening", () => {
  test("a right-click opens the menu at the pointer, focused; another moves it", async ({
    page,
  }) => {
    await page.goto("/context-menu");
    const point = await rightClick(area(page));
    const popup = menu(page);
    await expect(popup).toBeVisible();
    const box = (await popup.boundingBox())!;
    // At the pointer, within the theme's border and the align offset.
    expect(Math.abs(box.x - point.x)).toBeLessThanOrEqual(3);
    expect(Math.abs(box.y - point.y)).toBeLessThanOrEqual(3);
    await expect(popup).toBeFocused();
    const moved = await rightClick(area(page), 200, 60);
    await expect
      .poll(async () => Math.abs((await popup.boundingBox())!.x - moved.x) <= 3)
      .toBe(true);
    expect(await isOpen(popup)).toBe(true);
  });

  test("Shift+F10 and the ContextMenu key open it from the area, on the first item", async ({
    page,
  }) => {
    await page.goto("/context-menu");
    await area(page).focus();
    await page.keyboard.press("Shift+F10");
    await expect(item(page, "Rename")).toBeFocused();
    // Menu's keys: arrows skip nothing here, the disabled item can be highlighted.
    await page.keyboard.press("ArrowDown");
    await expect(item(page, "Duplicate")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu(page)).toBeHidden();
    await expect(area(page)).toBeFocused();
    await page.keyboard.press("ContextMenu");
    await expect(item(page, "Rename")).toBeFocused();
  });

  test("a long press on a touch screen opens it; a move or a short tap does not", async ({
    page,
  }) => {
    await page.goto("/context-menu");
    await touchPress(area(page), 200);
    await expect(menu(page)).toBeHidden();
    await touchPress(area(page), 650, 20);
    await expect(menu(page)).toBeHidden();
    const point = await touchPress(area(page), 650);
    const popup = menu(page);
    await expect(popup).toBeVisible();
    const box = (await popup.boundingBox())!;
    expect(Math.abs(box.x - point.x)).toBeLessThanOrEqual(3);
  });

  test("a disabled area keeps the browser's menu", async ({ page }) => {
    await page.goto("/context-menu");
    const prevented = await area(page, "disabled").evaluate((el) => {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      el.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(false);
    await area(page, "disabled").click({ button: "right" });
    await expect(menu(page, "Unused")).toBeHidden();
  });
});

test.describe("items, dismissal and focus", () => {
  test("running an item closes the menu and returns focus to the area", async ({ page }) => {
    await page.goto("/context-menu");
    await area(page).focus();
    await page.keyboard.press("Shift+F10");
    await page.keyboard.press("Enter");
    await expect(menu(page)).toBeHidden();
    await expect(area(page)).toBeFocused();
  });

  test("a submenu opens with Arrow Right and closes with Arrow Left", async ({ page }) => {
    await page.goto("/context-menu");
    await area(page).focus();
    await page.keyboard.press("Shift+F10");
    await page.keyboard.press("End");
    await expect(item(page, "Move to")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(item(page, "Archive")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(item(page, "Move to")).toBeFocused();
  });

  test("nested, the innermost opens, by right-click and by Shift+F10 (TASK-437 M15)", async ({
    page,
  }) => {
    await page.goto("/context-menu");
    const [board, card] = [menu(page, "Board actions"), menu(page, "Card actions")];
    await rightClick(area(page, "card"));
    await expect(card).toBeVisible();
    await expect(board).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
    await area(page, "card").focus();
    await page.keyboard.press("Shift+F10");
    await expect(item(page, "Edit card")).toBeFocused();
    await expect(board).toBeHidden();
    await page.keyboard.press("Escape");
    // Outside the card, the board's own.
    await rightClick(area(page, "board"), 20, 10);
    await expect(board).toBeVisible();
    await expect(card).toBeHidden();
  });

  test("a click outside closes it; a right-click inside shows no other menu", async ({ page }) => {
    await page.goto("/context-menu");
    await rightClick(area(page));
    const popup = menu(page);
    await expect(popup).toBeVisible();
    const prevented = await item(page, "Rename").evaluate((el) => {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      el.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(true);
    expect(await isOpen(popup)).toBe(true);
    await page.mouse.click(5, 5);
    await expect(popup).toBeHidden();
  });
});

test.describe("in an island", () => {
  test("bind:open, bind:checked and bind:value keep signals in sync", async ({ page }) => {
    await page.goto("/context-menu/island");
    const state = page.getByTestId("state");
    await expect(state).toHaveText("open: false, grid: true, sort: name");
    // Clicks until the island answers, and no further: a click before hydration is replayed after
    // it, and the menu it opens under the pointer would take the next click (TASK-514).
    await expect(async () => {
      if (!(await state.textContent())?.includes("open: true")) {
        await area(page).click({ button: "right", position: { x: 40, y: 30 }, timeout: 250 });
      }
      await expect(state).toHaveText(/open: true/, { timeout: 250 });
    }).toPass();
    await page.getByRole("menuitemcheckbox", { name: "Show the grid" }).click();
    await page.getByRole("menuitemradio", { name: "Date" }).click();
    await expect(state).toHaveText("open: true, grid: false, sort: date");
    await page.getByTestId("close").click();
    await expect(state).toHaveText("open: false, grid: false, sort: date");
  });
});

test("a server-rendered page loads Menu's and Context Menu's scripts, no island runtime", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
  });
  await page.goto("/context-menu");
  await rightClick(area(page));
  await expect(menu(page)).toBeVisible();
  expect(scripts.some((script) => /\/context-menu\.script-[\w-]+\.js$/.test(script))).toBe(true);
  for (const script of scripts) {
    expect(script).toMatch(/\/(context-menu\.script|menu\.script|layer|place)-/);
  }
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes closed and open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/context-menu");
      expect(await axe(page)).toEqual([]);
      await area(page).focus();
      await page.keyboard.press("Shift+F10");
      await expect(item(page, "Rename")).toBeFocused();
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus is visible and the items are large enough targets (2.4.7, 2.5.8)", async ({
    page,
  }) => {
    await page.goto("/context-menu");
    await area(page).focus();
    await page.keyboard.press("Shift+F10");
    await expect(item(page, "Rename")).toBeFocused();
    expect(await focusRing(page)).not.toBe("none");
    expect(await smallTargets(menu(page))).toEqual([]);
  });
});

test.describe("right to left (TASK-385)", () => {
  test("a submenu opens with Arrow Left and closes with Arrow Right", async ({ page }) => {
    await page.goto("/context-menu");
    await rtl(page);
    await area(page).focus();
    await page.keyboard.press("Shift+F10");
    await page.keyboard.press("End");
    await expect(item(page, "Move to")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(item(page, "Archive")).toBeFocused();
    const [parent, sub] = [
      await item(page, "Move to").boundingBox(),
      await item(page, "Archive").boundingBox(),
    ];
    // The submenu opens toward the inline end: the left.
    expect(sub!.x + sub!.width).toBeLessThanOrEqual(parent!.x + 2);
    await page.keyboard.press("ArrowRight");
    await expect(item(page, "Move to")).toBeFocused();
  });
});
