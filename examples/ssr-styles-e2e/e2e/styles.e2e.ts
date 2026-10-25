// TASK-336: the styling approaches of concepts/styles.md, under `lumiose dev` and in a production
// build. Each check reads a computed style in Chromium. The checks without JavaScript prove the
// rules ship with the server-rendered HTML (linked or inlined), not added by a script.
import { expect, test, type Page } from "@playwright/test";

/** The computed value of `property` on the first element matching `selector`. */
const computed = (page: Page, selector: string, property: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the root layout's global CSS, Tailwind and a CSS module style the server HTML", async ({
    page,
  }) => {
    await page.goto("/");
    expect(await computed(page, ".from-app-css", "color")).toBe("rgb(0, 128, 0)");
    // Tailwind utilities written as a string, in an island's array and record.
    expect(await computed(page, ".tw-string", "padding-top")).toBe("16px");
    expect(await computed(page, ".tw-string", "font-size")).toBe("14px");
    expect(await computed(page, ".toggle", "border-top-left-radius")).toBe("8px");
    expect(await computed(page, ".toggle", "background-color")).toBe("rgb(229, 231, 235)");
    // A CSS module: hashed class names, the same rules.
    const badge = page.locator(".badge");
    expect(await badge.getAttribute("class")).not.toMatch(/(^|\s)pill(\s|$)/);
    expect(await computed(page, ".badge", "border-top-color")).toBe("rgb(255, 215, 0)");
    expect(await computed(page, ".badge", "letter-spacing")).toBe("1px");
    expect(await computed(page, ".toggle", "border-top-color")).toBe("rgb(255, 215, 0)");
  });

  test("the cascade: imported CSS, then style blocks, both above Tailwind's layers", async ({
    page,
  }) => {
    await page.goto("/");
    // app.css's `.order[data-order]` and the layout's `.order[data-lum-…]` have the same specificity:
    // the style block comes after the stylesheet the file imports.
    expect(await computed(page, ".order", "color")).toBe("rgb(0, 0, 255)");
    // Utilities are in `@layer utilities`: unlayered CSS wins unless the utility is important.
    expect(await computed(page, "[data-probe=block-wins]", "padding-top")).toBe("2px");
    expect(await computed(page, "[data-probe=unlayered]", "padding-top")).toBe("3px");
    expect(await computed(page, "[data-probe=important]", "padding-top")).toBe("32px");
  });

  test("a route's own stylesheet is linked on that route only", async ({ page }) => {
    await page.goto("/about");
    expect(await computed(page, ":root", "--about-css")).toBe("loaded");
    expect(await computed(page, ".from-about-css", "color")).toBe("rgb(0, 0, 128)");
    // The root layout's stylesheet is linked on every page.
    expect(await computed(page, ".order", "color")).toBe("rgb(0, 0, 255)");
    await page.goto("/");
    expect(await computed(page, ":root", "--about-css")).toBe("");
  });

  test("@apply, theme() and --spacing() work in a style block with @reference", async ({
    page,
  }) => {
    await page.goto("/about");
    expect(await computed(page, ".applied", "padding-top")).toBe("24px");
    expect(await computed(page, ".applied", "font-weight")).toBe("700");
    expect(await computed(page, ".applied", "margin-top")).toBe("16px");
    expect(await computed(page, ".applied", "border-top-style")).toBe("solid");
  });
});

test("the island hydrates the server HTML and its classes change", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") warnings.push(message.text());
  });
  page.on("pageerror", (error) => warnings.push(error.message));
  // Hold the island's module until the server nodes are tagged.
  const held: (() => Promise<void>)[] = [];
  let released = false;
  await page.route(
    (url) => /Toggle/.test(url.pathname) && !/css/.test(url.pathname + url.search),
    (route) => (released ? route.continue() : void held.push(() => route.continue())),
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect.poll(() => held.length).toBeGreaterThan(0);
  const serverClass = await page.locator(".toggle").evaluate((button) => {
    (button as Element & { $server?: boolean }).$server = true;
    return button.className;
  });
  released = true;
  await Promise.all(held.splice(0).map((release) => release()));

  const toggle = page.locator(".toggle");
  // The page also modulepreloads the island, so the held request can come before the loader has
  // run, and a click then lands before anything catches it (TASK-593): click once the island has
  // hydrated (its delegated handler is set).
  await expect.poll(() => toggle.evaluate((el) => "$$click" in el)).toBe(true);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  // The classes of the record, the array's other branch and the CSS module's `active`.
  expect(await computed(page, ".toggle", "font-weight")).toBe("700");
  expect(await computed(page, ".toggle", "text-decoration-line")).toBe("underline");
  expect(await computed(page, ".toggle", "background-color")).toBe("rgb(16, 185, 129)");
  expect(await computed(page, ".toggle", "outline-width")).toBe("3px");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  // Hydrated, not rendered again: the same node, with the class the server rendered.
  expect(
    await toggle.evaluate((button) => (button as Element & { $server?: boolean }).$server),
  ).toBe(true);
  expect(await toggle.getAttribute("class")).toBe(serverClass);
  expect(warnings).toEqual([]);
});
