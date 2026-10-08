import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const ASSETS = resolve(import.meta.dirname, "../../../../backlog/assets");

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

/** The background color of `<body>`, as the browser computed it. */
const bodyBackground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("renders every component without errors", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  for (const name of ["Tokens", "Button and LinkButton", "Callout", "Card", "CodeBlock", "Tabs"]) {
    await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("note")).toHaveCount(5);
  await expect(page.getByRole("contentinfo")).toBeVisible();
  // SVG children of a conditional branch are created in the SVG namespace (they render).
  const namespaces = await page
    .locator(".callout svg path")
    .evaluateAll((paths) => paths.map((path) => path.namespaceURI));
  expect(new Set(namespaces)).toEqual(new Set(["http://www.w3.org/2000/svg"]));
  const box = await page.locator(".callout svg path").first().boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("the active link is marked as the current page", async ({ page }) => {
  await page.goto("/");
  const docs = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Docs" });
  await expect(docs).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Playground" }),
  ).not.toHaveAttribute("aria-current");
});

test("the theme toggle switches, persists and follows the system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  const toggle = page.getByRole("banner").getByRole("button", { name: "Dark theme" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(html).not.toHaveAttribute("data-theme");
  const light = await bodyBackground(page);

  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await bodyBackground(page)).not.toBe(light);
  expect(await page.evaluate(() => localStorage.getItem("lumen-theme"))).toBe("dark");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", "light");
  expect(await bodyBackground(page)).toBe(light);

  // Without a stored choice, the system preference applies.
  await page.evaluate(() => localStorage.removeItem("lumen-theme"));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(html).not.toHaveAttribute("data-theme");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await bodyBackground(page)).not.toBe(light);
});

test("a data-theme subtree has its own theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const background = (theme: string) =>
    page
      .locator(`[data-theme="${theme}"] .card`)
      .first()
      .evaluate((card) => getComputedStyle(card).backgroundColor);
  expect(await background("light")).toBe("rgb(255, 255, 255)");
  expect(await background("dark")).toBe("rgb(17, 17, 27)");
});

test("tabs follow the WAI-ARIA keyboard pattern", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("tablist", { name: "Package manager" }).getByRole("tab");
  const panels = page.locator(
    "#install-panel-0, #install-panel-1, #install-panel-2, #install-panel-3",
  );
  await expect(tabs).toHaveText(["pnpm", "npm", "yarn", "bun"]);
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(panels.nth(0)).toBeVisible();
  await expect(panels.nth(1)).toBeHidden();
  await expect(page.getByRole("tabpanel", { name: "pnpm" })).toBeVisible();

  await tabs.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(1)).toHaveAttribute("tabindex", "0");
  await expect(tabs.nth(0)).toHaveAttribute("tabindex", "-1");
  await expect(page.getByRole("tabpanel", { name: "npm" })).toBeVisible();
  await expect(panels.nth(0)).toBeHidden();

  await page.keyboard.press("End");
  await expect(tabs.nth(3)).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "bun" })).toContainText("bunx lumen dev");
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(0)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(tabs.nth(3)).toBeFocused();
  await page.keyboard.press("Home");
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");

  await tabs.nth(2).click();
  await expect(page.getByRole("tabpanel", { name: "yarn" })).toBeVisible();
});

test("the copy button copies the code", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  const block = page.locator("figure").filter({ hasText: "Counter.stsx" });
  await block.getByRole("button", { name: "Copy code" }).click();
  await expect(block.getByRole("status")).toHaveText("Copied to the clipboard");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('import { signal } from "lumen";');
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the menu opens, closes with Escape and returns focus", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    const menu = nav.getByRole("button", { name: "Menu" });
    const docs = nav.getByRole("link", { name: "Docs" });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(docs).toBeHidden();

    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(docs).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(docs).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(docs).toBeHidden();
    await expect(menu).toBeFocused();

    // A click outside the panel closes it.
    await menu.click();
    await expect(docs).toBeVisible();
    await page.mouse.click(195, 800);
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  });
});

// `pnpm --filter @lumen/site-kit screenshots`: the evidence of TASK-59 (production build).
test.describe("screenshots", () => {
  test.beforeEach(() => {
    test.skip(!process.env.SCREENSHOTS || test.info().project.name !== "preview");
  });

  for (const theme of ["light", "dark"] as const) {
    test(`full page, ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/");
      await page.screenshot({ path: `${ASSETS}/task-59-showcase-${theme}.png`, fullPage: true });
    });

    test(`phone with the menu open, ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      await page.getByRole("button", { name: "Menu" }).click();
      // The bars turn into a cross through a transition.
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
      await page.screenshot({ path: `${ASSETS}/task-59-phone-${theme}.png` });
    });
  }
});
