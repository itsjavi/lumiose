// Drawer (TASK-382): a Dialog against an edge of the window that a swipe toward that edge closes.
// The native dialog without JavaScript; the edge; the swipe (threshold, spring back, flick, not on
// controls, not while the content can scroll, touch); the button and key alternatives and focus
// return; the sync with a signal in an island; and WCAG 2.2 AA with the default theme.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dragPath } from "./browsers.ts";
import { axe, clipped, focusRing, SCHEMES, smallTargets, TEXT_SPACING } from "./a11y.ts";

const drawer = (page: Page, name: string) => page.getByRole("dialog", { name });
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/** Drags with the mouse from `from` (relative to `target`'s box) by `dx`, `dy`, in `steps`. */
async function drag(page: Page, target: Locator, toX: number, toY: number, steps = 10) {
  const box = (await target.boundingBox())!;
  const at = { x: 0.5, y: Math.min(0.5, 20 / box.height) };
  const { x, y, dx, dy } = dragPath(page, box, toX, toY, at);
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

/** A touch swipe down by `dy` from the top of `target`, as the drawer's touch listeners see it. */
async function touchSwipe(target: Locator, dy: number) {
  const box = (await target.boundingBox())!;
  const point = (y: number) => [{ clientX: box.x + 20, clientY: y, identifier: 1 }];
  const start = box.y + 10;
  await target.dispatchEvent("touchstart", { touches: point(start), changedTouches: point(start) });
  for (let i = 1; i <= 8; i++) {
    const y = start + (dy * i) / 8;
    await target.dispatchEvent("touchmove", { touches: point(y), changedTouches: point(y) });
  }
  await target.dispatchEvent("touchend", { touches: [], changedTouches: point(start + dy) });
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the trigger opens a modal drawer against its edge; Escape closes it", async ({ page }) => {
    await page.goto("/drawer");
    await button(page, "Filters").click();
    const filters = drawer(page, "Filters");
    await expect(filters).toBeVisible();
    const box = (await filters.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(Math.round(box.y + box.height)).toBe(viewport.height);
    // As wide as the page: the scroll lock (dialog.css) keeps a stable scrollbar gutter, 15px of
    // the viewport with Linux's classic scrollbars and none with macOS's overlay ones (TASK-507).
    const width = await page.evaluate(() => document.documentElement.getBoundingClientRect().width);
    expect(Math.round(box.width)).toBe(Math.round(width));
    await page.keyboard.press("Escape");
    await expect(filters).toBeHidden();
  });
});

test.describe("swipe", () => {
  test("past 40% of its height a swipe closes it; short of it, it springs back", async ({
    page,
  }) => {
    await page.goto("/drawer");
    await button(page, "Filters").click();
    const filters = drawer(page, "Filters");
    const title = filters.getByRole("heading", { name: "Filters" });
    await expect(filters).toBeVisible();
    const height = (await filters.boundingBox())!.height;
    await drag(page, title, 0, height * 0.2, 20);
    await expect(filters).toBeVisible();
    await expect(filters).not.toHaveAttribute("data-swiping");
    expect(
      await filters.evaluate((el) => el.style.getPropertyValue("--lu-drawer-swipe-movement-y")),
    ).toBe("");
    // Up is not its direction; a drag on a button is not a swipe.
    await drag(page, title, 0, -height * 0.6);
    await expect(filters).toBeVisible();
    await drag(page, filters.getByRole("button", { name: "Done" }), 0, height * 0.6);
    await expect(filters).toBeVisible();
    await drag(page, title, 0, height * 0.6);
    await expect(filters).toBeHidden();
    // Focus returns to the trigger, as after any close.
    await expect(button(page, "Filters")).toBeFocused();
  });

  test("while it runs, it moves with the pointer and reports its progress", async ({ page }) => {
    await page.goto("/drawer");
    await button(page, "Filters").click();
    const filters = drawer(page, "Filters");
    await expect(filters).toBeVisible();
    const box = (await filters.getByRole("heading", { name: "Filters" }).boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + 40, { steps: 5 });
    await expect(filters).toHaveAttribute("data-swiping");
    const style = await filters.evaluate((el) => [
      el.style.getPropertyValue("--lu-drawer-swipe-movement-y"),
      Number(el.style.getPropertyValue("--lu-drawer-swipe-progress")),
    ]);
    expect(style[0]).toBe("30px");
    expect(style[1]).toBeGreaterThan(0);
    await page.mouse.up();
  });

  test("content that can still scroll scrolls instead; at its top a touch swipes", async ({
    browser,
  }) => {
    const context = await browser.newContext({ hasTouch: true });
    const page = await context.newPage();
    await page.goto("/drawer");
    await button(page, "Filters").click();
    const filters = drawer(page, "Filters");
    const content = page.getByTestId("content");
    await expect(filters).toBeVisible();
    await content.evaluate((el) => (el.scrollTop = 100));
    await touchSwipe(content, 300);
    await expect(filters).toBeVisible();
    await content.evaluate((el) => (el.scrollTop = 0));
    await touchSwipe(content, 300);
    await expect(filters).toBeHidden();
    await context.close();
  });

  test("a mouse drag in the content selects text and never swipes (TASK-436 M6)", async ({
    page,
  }) => {
    await page.goto("/drawer");
    await button(page, "Filters").click();
    const filters = drawer(page, "Filters");
    const content = page.getByTestId("content");
    await expect(filters).toBeVisible();
    await content.evaluate((el) => (el.scrollTop = 0));
    await drag(page, content, 0, 300);
    await expect(filters).toBeVisible();
    await expect(filters).not.toHaveAttribute("data-swiping");
  });

  test("a drag that starts on the backdrop never swipes (TASK-436 M5)", async ({ page }) => {
    await page.goto("/drawer");
    await button(page, "Menu").click();
    const menu = drawer(page, "Menu");
    await expect(menu).toBeVisible();
    const box = (await menu.boundingBox())!;
    // On the backdrop, left of the drawer, toward its edge (closedby="closerequest").
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x - 150, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(box.x - 150 + i * 25, y);
      await page.waitForTimeout(16);
    }
    await page.mouse.up();
    await expect(menu).toBeVisible();
  });

  test("a side drawer swipes toward its side", async ({ page }) => {
    await page.goto("/drawer");
    await button(page, "Menu").click();
    const menu = drawer(page, "Menu");
    await expect(menu).toBeVisible();
    const box = (await menu.boundingBox())!;
    expect(Math.round(box.x + box.width)).toBe(page.viewportSize()!.width);
    await drag(page, menu.getByRole("heading", { name: "Menu" }), -200, 0);
    await expect(menu).toBeVisible();
    await drag(page, menu.getByRole("heading", { name: "Menu" }), 250, 0);
    await expect(menu).toBeHidden();
  });

  test("a touch swipe closes it too", async ({ browser }) => {
    const context = await browser.newContext({ hasTouch: true });
    const page = await context.newPage();
    await page.goto("/drawer");
    await button(page, "Filters").click();
    const filters = drawer(page, "Filters");
    await expect(filters).toBeVisible();
    const box = (await filters.getByRole("heading", { name: "Filters" }).boundingBox())!;
    const point = (y: number) => [{ clientX: box.x + 20, clientY: y, identifier: 1 }];
    const title = filters.getByRole("heading", { name: "Filters" });
    await title.dispatchEvent("touchstart", {
      touches: point(box.y),
      changedTouches: point(box.y),
    });
    for (let i = 1; i <= 8; i++) {
      const y = box.y + i * 40;
      await title.dispatchEvent("touchmove", { touches: point(y), changedTouches: point(y) });
    }
    await title.dispatchEvent("touchend", { touches: [], changedTouches: point(box.y + 320) });
    await expect(filters).toBeHidden();
    await context.close();
  });
});

test.describe("in an island", () => {
  test("bind:open keeps a signal in sync, a swipe included", async ({ page }) => {
    await page.goto("/drawer/island");
    const state = page.getByTestId("state");
    await expect(async () => {
      await page.getByTestId("open").click();
      await expect(state).toHaveText("open: true", { timeout: 250 });
    }).toPass();
    const navigation = drawer(page, "Navigation");
    await expect(navigation).toBeVisible();
    await drag(page, navigation.getByRole("heading", { name: "Navigation" }), -250, 0);
    await expect(navigation).toBeHidden();
    await expect(state).toHaveText("open: false");
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes closed and open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/drawer");
      expect(await axe(page)).toEqual([]);
      await button(page, "Filters").click();
      await expect(drawer(page, "Filters")).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.keyboard.press("Escape");
      // The side drawer too, with its navigation (TASK-462).
      await button(page, "Menu").click();
      await expect(drawer(page, "Menu")).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus is visible, targets are large enough, it reflows (2.4.7, 2.5.8, 1.4.10)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/drawer");
    await page.addStyleTag({ content: TEXT_SPACING });
    await button(page, "Menu").click();
    const menu = drawer(page, "Menu");
    await expect(menu.getByRole("link", { name: "Home" })).toBeFocused();
    await page.keyboard.press("Tab");
    expect(await focusRing(page)).toBe("2px solid");
    expect(await smallTargets(menu)).toEqual([]);
    expect(await clipped(menu)).toEqual([]);
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
  });
});
