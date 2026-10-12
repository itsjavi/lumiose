// `lumiose dev` hot updates. Editing an island's module re-renders its instances in place (TASK-147);
// editing server-only code patches the page with its fresh HTML (TASK-148). Either way the page,
// its scroll position and the islands keep their state. An edit that changes an island's record
// still reloads the page.
import { readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const ACCOUNT_MENU = new URL("../src/islands/AccountMenu.stsx", import.meta.url);
const HEADER = new URL("../src/components/Header.stsx", import.meta.url);
const ABOUT = new URL("../src/routes/(static)/about/page.stsx", import.meta.url);

/** Marks the document: the mark is gone after a full reload. */
const mark = (page: Page) => page.evaluate(() => ((window as { mark?: number }).mark = 1));
const marked = (page: Page) => page.evaluate(() => (window as { mark?: number }).mark === 1);

test("island and server-only edits update the page in place", async ({ page }) => {
  const menu = readFileSync(ACCOUNT_MENU, "utf8");
  const header = readFileSync(HEADER, "utf8");
  const about = readFileSync(ABOUT, "utf8");
  const patched: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("page updated in place")) patched.push(message.text());
  });
  try {
    // Short enough to scroll.
    await page.setViewportSize({ width: 800, height: 300 });
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

    // Server-only markup: patched in place.
    await page.evaluate(() => window.scrollTo(0, 120));
    const scrolled = await page.evaluate(() => window.scrollY);
    expect(scrolled).toBeGreaterThan(0);
    writeFileSync(HEADER, header.replace(">\n        Bookshelf\n", ">\n        Bookshelf!\n"));
    await expect(page.locator(".brand")).toHaveText("Bookshelf!");
    expect(await marked(page)).toBe(true);
    await expect(search).toHaveValue("remember");
    await expect(page.locator(".account-menu")).toHaveAttribute("data-hot", "2");
    expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);
    await expect.poll(() => patched.length).toBe(1);

    // A head change.
    writeFileSync(ABOUT, about.replace("<Title>About · Bookshelf", "<Title>About! · Bookshelf"));
    await expect(page).toHaveTitle("About! · Bookshelf");
    await expect(page.locator("h1")).toHaveText("About this sample");
    expect(await marked(page)).toBe(true);
    await expect(search).toHaveValue("remember");
    await expect.poll(() => patched.length).toBe(2);

    // A changed island record (its hydration strategy) reloads.
    writeFileSync(
      HEADER,
      header
        .replace(">\n        Bookshelf\n", ">\n        Bookshelf!\n")
        .replace("<AccountMenu client:idle />", "<AccountMenu client:load />"),
    );
    await expect.poll(() => marked(page).catch(() => true)).toBe(false);
    await expect(page.locator(".brand")).toHaveText("Bookshelf!");
  } finally {
    writeFileSync(ACCOUNT_MENU, menu);
    writeFileSync(HEADER, header);
    writeFileSync(ABOUT, about);
  }
});
