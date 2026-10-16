// Avatar (TASK-374): `<lu-avatar>` stacks the image over the fallback and follows the image's
// loading status (`data-loading`, `data-error`, `data-loaded`); the fallback shows until the image
// has loaded, after its delay, with no layout shift; without JavaScript the image covers it. In an
// island the status follows a signal. WCAG 2.2 AA with the default theme (doc-9 sections 1, 17).
import { expect, test, type Page } from "@playwright/test";
import { axe, clipped, SCHEMES, TEXT_SPACING } from "./a11y.ts";

/** Lumiose's console warnings (LUM codes), such as a hydration that fell back to rendering. */
const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#fde68a"/></svg>`;

/** Serves `/avatars/slow.svg` after `ms`, so a test can see the avatar while it loads. */
async function slowImage(page: Page, ms: number) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/avatars/slow.svg", async (route) => {
    await Promise.race([released, new Promise((resolve) => setTimeout(resolve, ms))]);
    await route.fulfill({ contentType: "image/svg+xml", body: SVG });
  });
  return release;
}

const avatar = (page: Page, id: string) => page.getByTestId(id);

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the image is in the server HTML and covers the fallback once it loads", async ({
    page,
  }) => {
    await page.goto("/avatar");
    const root = avatar(page, "loaded");
    const image = root.locator("img");
    await expect(image).toBeVisible();
    await expect(image).toHaveJSProperty("complete", true);
    // The image is on top: the root's centre is the image.
    const top = await root.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.tagName;
    });
    expect(top).toBe("IMG");
    // A root without an image shows its fallback.
    await expect(avatar(page, "none").getByText("KJ")).toBeVisible();
  });
});

test.describe("with JavaScript", () => {
  test("a loaded image hides the fallback; a failed one hides itself", async ({ page }) => {
    await page.route("**/avatars/slow.svg", (route) => route.abort());
    await page.goto("/avatar");
    const loaded = avatar(page, "loaded");
    await expect(loaded).toHaveAttribute("data-loaded");
    await expect(loaded.locator("img")).toBeVisible();
    await expect(loaded.getByRole("img", { name: "Ada Lovelace" })).toHaveCount(1);
    await expect(loaded.getByText("AL")).toBeHidden();
    const missing = avatar(page, "missing");
    await expect(missing.locator("img")).toHaveAttribute("data-error");
    await expect(missing.locator("img")).toBeHidden();
    await expect(missing).not.toHaveAttribute("data-loaded");
    await expect(missing.getByRole("img", { name: "Grace Hopper" })).toBeVisible();
    await expect(avatar(page, "none").getByText("KJ")).toBeVisible();
  });

  test("while the image loads, the fallback waits for its delay, and nothing moves", async ({
    page,
  }) => {
    const release = await slowImage(page, 10_000);
    // Not until `load`, which waits for the images.
    await page.goto("/avatar", { waitUntil: "domcontentloaded" });
    const slow = avatar(page, "slow");
    const fallback = slow.getByText("AT");
    const image = slow.locator("img");
    const before = await slow.boundingBox();
    await expect(image).toHaveAttribute("data-loading");
    await expect(image).toBeHidden();
    // The fallback's delay is 600ms: hidden at first, shown after.
    await expect(fallback).toBeHidden();
    await expect(fallback).toBeVisible({ timeout: 2000 });
    release();
    await expect(slow).toHaveAttribute("data-loaded");
    await expect(image).toBeVisible();
    await expect(fallback).toBeHidden();
    expect(await slow.boundingBox()).toEqual(before);
  });

  test("an image that loads before the delay never shows the fallback", async ({ page }) => {
    await slowImage(page, 150);
    // Records whether the fallback was ever visible, from the page's first parse on.
    await page.addInitScript(() => {
      const state = window as unknown as { shown: boolean };
      state.shown = false;
      const timer = setInterval(() => {
        const fallback = document.querySelector("[data-testid=slow] [data-fallback]");
        if (fallback === null) return;
        if (getComputedStyle(fallback).visibility === "visible") state.shown = true;
        if (fallback.closest("lu-avatar")!.hasAttribute("data-loaded")) clearInterval(timer);
      }, 10);
    });
    await page.goto("/avatar", { waitUntil: "domcontentloaded" });
    await expect(avatar(page, "slow")).toHaveAttribute("data-loaded");
    expect(await page.evaluate(() => (window as unknown as { shown: boolean }).shown)).toBe(false);
  });

  test("avatars take no focus", async ({ page }) => {
    await page.goto("/avatar");
    const focusable = await page
      .locator("lu-avatar, lu-avatar *")
      .evaluateAll((elements) => elements.filter((el) => (el as HTMLElement).tabIndex >= 0).length);
    expect(focusable).toBe(0);
  });
});

test.describe("in an island", () => {
  test("the loading status follows the image into a signal", async ({ page }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/avatar/island");
    const status = page.getByTestId("status");
    // Hydration reports the status the image already had.
    await expect(status).toHaveText("Picture: loaded");
    const root = page.locator("lu-avatar");
    await page.getByTestId("break").click();
    await expect(status).toHaveText("Picture: error");
    await expect(root.locator("img")).toBeHidden();
    await expect(root.getByText("AL")).toBeVisible();
    await page.getByTestId("fix").click();
    await expect(status).toHaveText("Picture: loaded");
    await expect(root.getByText("AL")).toBeHidden();
    expect(warnings).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes on the page and the island (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.route("**/avatars/slow.svg", (route) =>
        route.fulfill({ contentType: "image/svg+xml", body: SVG }),
      );
      await page.goto("/avatar");
      await expect(avatar(page, "slow")).toHaveAttribute("data-loaded");
      expect(await axe(page)).toEqual([]);
      await page.goto("/avatar/island");
      await expect(page.getByTestId("status")).toHaveText("Picture: loaded");
      expect(await axe(page)).toEqual([]);
      await page.getByTestId("break").click();
      await expect(page.getByTestId("status")).toHaveText("Picture: error");
      expect(await axe(page)).toEqual([]);
    });
  }

  test("the page reflows at 320 CSS pixels with text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/avatar");
    await page.addStyleTag({ content: TEXT_SPACING });
    const main = page.locator("main");
    const box = (await main.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(await clipped(main)).toEqual([]);
  });
});
