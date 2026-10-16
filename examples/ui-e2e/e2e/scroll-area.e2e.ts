// Scroll Area (TASK-384): native scrolling in a focusable viewport, with custom scrollbars over it.
// Without JavaScript the native scrollbars show; with its script they are hidden and the custom
// ones follow the scroll position, show on hover and scroll, take a thumb drag and a track press;
// the keyboard scrolls the viewport and Tab moves on (no trap); right to left, the horizontal
// thumb runs from the right; content that grows shows the scrollbar. WCAG 2.2 AA with the default
// theme (doc-9 sections 1 and 17).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { axe, clipped, focusRing, lastNavLink, SCHEMES, TEXT_SPACING } from "./a11y.ts";

/** Lumiose's console warnings (LUM codes), such as a hydration that fell back to rendering. */
const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

const region = (page: Page, name: string) => page.getByRole("region", { name });
const area = (page: Page, name: string) =>
  page.locator("lu-scroll-area").filter({ has: region(page, name) });
const scrollbar = (page: Page, name: string, orientation = "vertical") =>
  area(page, name).locator(`[data-scrollbar][data-orientation="${orientation}"]`);
const scrollTop = (viewport: Locator) => viewport.evaluate((el) => el.scrollTop);
/** The thumb's offset along its scrollbar, from its `transform`. */
const offset = (page: Page, name: string, orientation = "vertical") =>
  scrollbar(page, name, orientation)
    .locator("[data-thumb]")
    .evaluate((thumb, vertical) => {
      const matrix = new DOMMatrix(getComputedStyle(thumb).transform);
      return vertical ? matrix.m42 : matrix.m41;
    }, orientation === "vertical");

/** /scroll-area with its script running: the native scrollbars are hidden. */
async function ready(page: Page) {
  await page.goto("/scroll-area");
  await expect(area(page, "Releases")).toHaveAttribute("data-has-overflow-y", "");
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the viewport scrolls natively, with its native scrollbar, from the keyboard too", async ({
    page,
  }) => {
    await page.goto("/scroll-area");
    const releases = region(page, "Releases");
    // The page's own scrollbar: Playwright's Firefox hides every scrollbar (computed
    // `scrollbar-width: none` on any element), so compare with the root's (TASK-420).
    expect(
      await releases.evaluate(
        (el) =>
          getComputedStyle(el).scrollbarWidth ===
          getComputedStyle(document.documentElement).scrollbarWidth,
      ),
    ).toBe(true);
    await expect(scrollbar(page, "Releases")).toBeHidden();
    await releases.focus();
    await page.keyboard.press("PageDown");
    await expect.poll(() => scrollTop(releases)).toBeGreaterThan(0);
  });
});

test.describe("Scroll Area", () => {
  test("the keyboard scrolls the focused viewport, the thumb follows, and Tab moves on", async ({
    page,
  }) => {
    await ready(page);
    const releases = region(page, "Releases");
    expect(await releases.evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe("none");
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    await expect(releases).toBeFocused();
    expect(await focusRing(page)).toBe("2px solid");
    await expect(scrollbar(page, "Releases")).toHaveCSS("opacity", "1");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("PageDown");
    await expect.poll(() => scrollTop(releases)).toBeGreaterThan(40);
    await expect.poll(() => offset(page, "Releases")).toBeGreaterThan(0);
    await expect(area(page, "Releases")).toHaveAttribute("data-overflow-y-start", "");
    await page.keyboard.press("End");
    await expect(area(page, "Releases")).not.toHaveAttribute("data-overflow-y-end");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "After the list" })).toBeFocused();
  });

  test("hover shows the scrollbars; the wheel scrolls and marks it scrolling", async ({ page }) => {
    await ready(page);
    const bar = scrollbar(page, "Releases");
    await expect(bar).toHaveCSS("opacity", "0");
    const box = (await region(page, "Releases").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(bar).toHaveAttribute("data-hovering", "");
    await expect(bar).toHaveCSS("opacity", "1");
    await page.mouse.wheel(0, 120);
    await expect(area(page, "Releases")).toHaveAttribute("data-scrolling", "");
    await expect.poll(() => scrollTop(region(page, "Releases"))).toBeGreaterThan(0);
    await expect(area(page, "Releases")).not.toHaveAttribute("data-scrolling");
  });

  test("the wheel over a scrollbar scrolls the area, and the page at its end (TASK-437 M18)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 400 });
    await ready(page);
    const releases = region(page, "Releases");
    const box = (await releases.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 10);
    const track = (await scrollbar(page, "Releases").boundingBox())!;
    await page.mouse.move(track.x + track.width / 2, track.y + track.height / 2);
    await page.mouse.wheel(0, 120);
    await expect.poll(() => scrollTop(releases)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    // At the end of the list the page takes the wheel.
    await releases.evaluate((viewport) => (viewport.scrollTop = viewport.scrollHeight));
    await page.mouse.wheel(0, 120);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });

  test("each thumb takes presses over 24 by 24 px (2.5.8, TASK-444 L7)", async ({ page }) => {
    await ready(page);
    const releases = region(page, "Releases");
    const box = (await releases.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 10);
    const thumbAt = (x: number, y: number) =>
      page.evaluate(
        ([px, py]) => document.elementFromPoint(px!, py!)?.hasAttribute("data-thumb"),
        [x, y],
      );
    const vertical = (await scrollbar(page, "Releases").locator("[data-thumb]").boundingBox())!;
    // 14px inward from the vertical thumb, and 3px past its end: still the thumb.
    expect(await thumbAt(vertical.x - 14, vertical.y + vertical.height / 2)).toBe(true);
    expect(await thumbAt(vertical.x + vertical.width / 2, vertical.y + vertical.height + 3)).toBe(
      true,
    );
    // A drag from beside it scrolls.
    await page.mouse.move(vertical.x - 12, vertical.y + vertical.height / 2);
    await page.mouse.down();
    await page.mouse.move(vertical.x - 12, vertical.y + vertical.height / 2 + 40, { steps: 4 });
    await page.mouse.up();
    expect(await scrollTop(releases)).toBeGreaterThan(40);
    // The horizontal thumb, 14px above it.
    const cells = region(page, "Table cells");
    const cellsBox = (await cells.boundingBox())!;
    await page.mouse.move(cellsBox.x + 10, cellsBox.y + 10);
    const horizontal = (await scrollbar(page, "Table cells", "horizontal")
      .locator("[data-thumb]")
      .boundingBox())!;
    expect(await thumbAt(horizontal.x + horizontal.width / 2, horizontal.y - 14)).toBe(true);
  });

  test("dragging the thumb scrolls with it; a press on the track scrolls there", async ({
    page,
  }) => {
    await ready(page);
    const releases = region(page, "Releases");
    const box = (await releases.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 10);
    const thumb = (await scrollbar(page, "Releases").locator("[data-thumb]").boundingBox())!;
    await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
    await page.mouse.down();
    await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2 + 40, {
      steps: 4,
    });
    await page.mouse.up();
    const dragged = await scrollTop(releases);
    expect(dragged).toBeGreaterThan(80);
    const track = (await scrollbar(page, "Releases").boundingBox())!;
    await page.mouse.click(track.x + track.width / 2, track.y + track.height - 2);
    await expect
      .poll(() => releases.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop))
      .toBeLessThan(2);
  });

  test("both ways: two scrollbars, the corner, horizontal scrolling, and right to left", async ({
    page,
  }) => {
    await ready(page);
    const table = region(page, "Table cells");
    await expect(scrollbar(page, "Table cells", "horizontal")).not.toHaveAttribute("hidden");
    await expect(area(page, "Table cells").locator("[data-corner]")).not.toHaveAttribute("hidden");
    await table.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => offset(page, "Table cells", "horizontal")).toBeGreaterThan(0);
    // Right to left: scrolled from the right, the thumb moves left.
    await table.evaluate((el) => {
      el.closest("section")!.dir = "rtl";
      el.scrollLeft = -80;
    });
    await expect.poll(() => offset(page, "Table cells", "horizontal")).toBeLessThan(0);
  });

  test("an area with nothing to scroll is no tab stop and shows no scrollbar", async ({ page }) => {
    await ready(page);
    const short = page.locator("lu-scroll-area").filter({ hasText: "Two lines of text fit." });
    await expect(short.locator("[data-viewport]")).toHaveAttribute("tabindex", "-1");
    await expect(short.locator("[data-scrollbar]")).toBeHidden();
  });
});

test.describe("in an island", () => {
  test("content that grows gets a scrollbar and a tab stop", async ({ page }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/scroll-area/island");
    const messages = region(page, "Messages");
    await expect(async () => {
      await page.getByTestId("add-items").click({ timeout: 250 });
      await expect(messages).toHaveAttribute("tabindex", "0", { timeout: 250 });
    }).toPass();
    await expect(scrollbar(page, "Messages")).not.toHaveAttribute("hidden");
    expect(warnings).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes on the page and the island (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await ready(page);
      expect(await axe(page)).toEqual([]);
      await page.goto("/scroll-area/island");
      expect(await axe(page)).toEqual([]);
    });
  }

  test("the areas reflow at 320 CSS pixels with text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await ready(page);
    await page.addStyleTag({ content: TEXT_SPACING });
    for (const each of await page.locator("lu-scroll-area").all()) {
      const box = (await each.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      expect(await clipped(each)).toEqual([]);
    }
  });

  test("a server-rendered page loads Scroll Area's script only", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await ready(page);
    await page.waitForLoadState("networkidle");
    expect(scripts).toEqual([expect.stringMatching(/\/scroll-area\.script-[\w-]+\.js$/)]);
  });
});
