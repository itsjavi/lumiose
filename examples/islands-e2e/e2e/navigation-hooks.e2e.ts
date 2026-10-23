// TASK-549 in Chromium: on an MPA page (no router), the Draft island's beforeNavigate sees a click
// on a same-origin link as "link", and a cancel keeps the page without the browser's prompt, so
// the island shows its own dialog. Modified clicks are the browser's; closing the tab is "leave",
// where the browser asks. The hooks log each call in sessionStorage, which /elsewhere can read.
import { expect, test, type Page } from "@playwright/test";

/** The dialogs the browser shows, dismissed. */
function dialogs(page: Page): string[] {
  const types: string[] = [];
  page.on("dialog", (dialog) => {
    types.push(dialog.type());
    void dialog.dismiss();
  });
  return types;
}

async function open(page: Page): Promise<void> {
  await page.goto("/draft");
  await expect(page.locator(".draft[data-hydrated]")).toBeAttached();
}

const hooks = (page: Page): Promise<string[]> =>
  page.evaluate(() => JSON.parse(sessionStorage.getItem("hooks") ?? "[]") as string[]);

test("a cancelled link click keeps the page for the island's own dialog", async ({
  page,
  context,
}) => {
  const shown = dialogs(page);
  await open(page);
  await page.locator("#draft").fill("unsaved");
  await page.locator("#away").click();
  await expect(page.getByRole("alert")).toContainText("Unsaved changes before /elsewhere.");
  await expect(page).toHaveURL(/\/draft$/);

  // A modified click opens a tab: the browser's, not a navigation of this page.
  const tab = context.waitForEvent("page");
  await page.locator("#away").click({ modifiers: ["ControlOrMeta"] });
  await (await tab).close();

  // Closing the tab is "leave": the browser asks.
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => shown).toEqual(["beforeunload"]);
  expect(page.isClosed()).toBe(false);

  // The island's dialog follows the link once the changes are discarded.
  await page.locator("#discard").click();
  await expect(page).toHaveURL(/\/elsewhere$/);
  expect(shown).toEqual(["beforeunload"]);
  expect(await hooks(page)).toEqual(["link", "leave", "leave"]);
});

test("a link click the hooks let through loads the page, with no leave call", async ({ page }) => {
  const shown = dialogs(page);
  await open(page);
  await page.locator("#away").click();
  await expect(page).toHaveURL(/\/elsewhere$/);
  expect(await hooks(page)).toEqual(["link"]);
  expect(shown).toEqual([]);
});
