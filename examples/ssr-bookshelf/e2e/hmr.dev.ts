// `lumen dev` hot swap (TASK-147): editing an island's module re-renders its instances in place,
// while the page, scroll position and the other islands keep their state; editing server-only
// code still reloads the page.
import { readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const ACCOUNT_MENU = new URL("../src/islands/AccountMenu.stsx", import.meta.url);
const HEADER = new URL("../src/components/Header.stsx", import.meta.url);

/** Marks the document: the mark is gone after a full reload. */
const mark = (page: Page) => page.evaluate(() => ((window as { mark?: number }).mark = 1));
const marked = (page: Page) => page.evaluate(() => (window as { mark?: number }).mark === 1);

test("an island edit re-renders its instances; a server-only edit reloads", async ({ page }) => {
  const menu = readFileSync(ACCOUNT_MENU, "utf8");
  const header = readFileSync(HEADER, "utf8");
  try {
    // The menu (client:idle) asks /api/me once hydrated.
    const hydrated = page.waitForResponse((response) => response.url().includes("/api/me"));
    await page.goto("/about");
    await hydrated;
    const search = page.getByRole("combobox", { name: "Search books" });
    // Both islands hydrated: the search box takes input; the menu asked /api/me.
    await expect(page.locator(".account-menu")).toBeVisible();
    await search.fill("remember");
    await mark(page);

    writeFileSync(
      ACCOUNT_MENU,
      menu.replace('<div class="account-menu">', '<div class="account-menu" data-hot="2">'),
    );
    await expect(page.locator(".account-menu")).toHaveAttribute("data-hot", "2");
    expect(await marked(page)).toBe(true);
    // The other island kept its state.
    await expect(search).toHaveValue("remember");

    writeFileSync(HEADER, header.replace(">\n        Bookshelf\n", ">\n        Bookshelf!\n"));
    await expect(page.locator(".brand")).toHaveText("Bookshelf!");
    expect(await marked(page)).toBe(false);
  } finally {
    writeFileSync(ACCOUNT_MENU, menu);
    writeFileSync(HEADER, header);
  }
});
