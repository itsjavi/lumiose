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
