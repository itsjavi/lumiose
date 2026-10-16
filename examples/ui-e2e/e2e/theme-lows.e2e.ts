// Theme finding of the 0.1.0 release review (TASK-455, L34): a focused disabled menu item keeps a
// full-contrast focus ring; its text is dimmed instead of the whole item.
import { expect, test } from "@playwright/test";

test("L34: a focused disabled menu item is dimmed by its text, not its ring", async ({ page }) => {
  await page.goto("/menu");
  await page.getByRole("button", { name: "Actions" }).click();
  const item = page.getByRole("menuitem", { name: "Delete" });
  await expect(item).toBeVisible();
  await page.keyboard.press("End");
  await expect(item).toBeFocused();
  await expect(item).toHaveAttribute("aria-disabled", "true");
  expect(await item.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  // Dimmer text than an enabled item's.
  const colours = await item.evaluate((el) => {
    const enabled = el.parentElement!.querySelector('[role="menuitem"]:not([aria-disabled])')!;
    return [getComputedStyle(el).color, getComputedStyle(enabled).color];
  });
  expect(colours[0]).not.toBe(colours[1]);
});
