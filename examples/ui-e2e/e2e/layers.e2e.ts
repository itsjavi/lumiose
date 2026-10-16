// Layers inside layers (doc-9 section 1): the dismissal model Popover, Preview Card, Menu and
// Combobox share (layer.ts) and Dialog's script. One Escape closes one layer (TASK-427).
//
// Layers that open on hover give the page no user activation, so their close watchers join one
// group. Playwright's own calls can grant activation in Chromium (an `evaluate`, a locator), which
// would hide that: the tests find the controls first, reload, and then drive the page with the
// mouse and the keyboard only, checking nothing until the Escape.
import { expect, test, type Page } from "@playwright/test";

type Point = { x: number; y: number };

async function centre(page: Page, name: string): Promise<Point> {
  const box = (await page.getByRole("button", { name, exact: true }).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Rests the mouse on `point`, long enough for a hover popover to open. */
async function rest(page: Page, point: Point) {
  await page.mouse.move(point.x, point.y, { steps: 4 });
  await page.waitForTimeout(400);
}

const dialog = (page: Page, name: string) => page.getByRole("dialog", { name, exact: true });

test.describe("one Escape closes one layer (TASK-427)", () => {
  test("a hover popover in a hover popover: the inner one, then the outer one", async ({
    page,
  }) => {
    await page.goto("/layers");
    const account = await centre(page, "Account");
    await rest(page, account);
    await expect(dialog(page, "Account")).toBeVisible();
    const plan = await centre(page, "Plan details");
    // Off the trigger first: a pointer resting on it through the reload would hover it before the
    // script runs, and never again.
    await page.mouse.move(0, 0);
    await page.reload();
    await page.waitForTimeout(500);

    await rest(page, account);
    await rest(page, plan);
    await page.keyboard.press("Escape");
    await expect(dialog(page, "Plan details")).toBeHidden();
    await expect(dialog(page, "Account")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page, "Account")).toBeHidden();
  });

  test("a hover popover and a preview card in a dialog: each Escape closes one", async ({
    page,
  }) => {
    await page.goto("/layers");
    const settings = await centre(page, "Settings…");
    await page.mouse.click(settings.x, settings.y);
    await expect(dialog(page, "Settings")).toBeVisible();
    const help = await centre(page, "What is this?");
    const link = dialog(page, "Settings").getByRole("link", { name: "Lumiose" });
    const box = (await link.boundingBox())!;
    const lumiose = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.reload();
    await page.waitForTimeout(500);

    await page.mouse.click(settings.x, settings.y);
    await page.waitForTimeout(300);
    await rest(page, help);
    await page.keyboard.press("Escape");
    // A second layer, opened after the first closed: its watcher would join the dialog's group.
    await page.mouse.move(5, 5);
    await rest(page, lumiose);
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    await expect(page.getByText("Settings for this page only.")).toBeHidden();
    await expect(page.getByText("A web framework.")).toBeHidden();
    await expect(dialog(page, "Settings")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page, "Settings")).toBeHidden();
  });
});

test.describe("closing a layer closes the layers inside it (TASK-436 M1)", () => {
  test("a popover closed by script closes the modal dialog opened from it", async ({ page }) => {
    await page.goto("/layers");
    await page.getByRole("button", { name: "Outer", exact: true }).click();
    const outer = dialog(page, "Outer");
    await expect(outer).toBeVisible();
    await outer.getByRole("button", { name: "Open dialog" }).click();
    const inner = dialog(page, "Inner dialog");
    await expect(inner).toBeVisible();
    // Any close by script, a bound `open` set to false say.
    await page
      .locator("[popover]", { has: page.getByText("Open dialog") })
      .evaluate((el) => (el as HTMLElement).hidePopover());
    await expect(outer).toBeHidden();
    await expect(inner).toBeHidden();
    expect(await page.evaluate(() => document.querySelector("dialog[open]"))).toBeNull();
    // The page takes presses again.
    await page.getByRole("button", { name: "Elsewhere" }).click();
    await expect(page.getByRole("button", { name: "Elsewhere" })).toBeFocused();
  });

  test("a dialog closed by script closes the menu open in it", async ({ page }) => {
    await page.goto("/layers");
    await page.waitForFunction(() => customElements.get("lu-menu"));
    // The keyboard only, the pointer out of the way: a pointer resting where the dialog opens
    // could open its hover popover, a layer that would close the menu.
    await page.mouse.move(0, 0);
    await page.getByRole("button", { name: "Settings…" }).focus();
    await page.keyboard.press("Enter");
    const settings = dialog(page, "Settings");
    await expect(settings).toBeVisible();
    await settings.getByRole("button", { name: "Options" }).focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(page.getByRole("menuitem", { name: "Reset" })).toBeFocused();
    await settings.evaluate((el) => (el as HTMLDialogElement).close());
    await expect(settings).toBeHidden();
    await expect(menu).toBeHidden();
    await expect
      .poll(() => page.evaluate(() => document.querySelectorAll(":popover-open").length))
      .toBe(0);
  });
});
