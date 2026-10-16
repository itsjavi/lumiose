// Preview Card (TASK-381): a link whose hover or keyboard focus opens a card after a delay, with
// Popover's hover timing and placement. WCAG 1.4.13: the card is hoverable (the pointer can move
// onto it), persistent (it stays until the pointer or focus leaves) and dismissible (Escape,
// without moving the pointer). Touch and clicks follow the link. The sync with a signal in an
// island, and WCAG 2.2 AA with the default theme (doc-9 sections 1, 3, 4 and 17).
import { expect, test, type Page } from "@playwright/test";
import { axe, lastNavLink, SCHEMES } from "./a11y.ts";

/** Puts the whole page right to left. */
const rtl = (page: Page) => page.evaluate(() => (document.documentElement.dir = "rtl"));

/** Lumiose's console warnings (LUM codes), such as a hydration that fell back to rendering. */
const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

const link = (page: Page, name: string) => page.getByRole("link", { name, exact: true });
const card = (page: Page, text: string) =>
  page.locator("[data-preview-card-popup]").filter({ hasText: text });

/** Rests the mouse on the middle of `name`'s link. */
async function hover(page: Page, name: string) {
  const box = (await link(page, name).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

/** /preview-card with its script running. */
async function ready(page: Page) {
  await page.goto("/preview-card");
  await page.waitForFunction(() =>
    performance.getEntriesByType("resource").some((e) => /preview-card\.script/.test(e.name)),
  );
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the links are plain links; the cards stay closed", async ({ page }) => {
    await page.goto("/preview-card");
    await hover(page, "islands");
    await page.waitForTimeout(400);
    await expect(card(page, "Interactive components")).toBeHidden();
    await link(page, "islands").click();
    await expect(page).toHaveURL(/#islands$/);
  });
});

test.describe("Preview Card", () => {
  test("hover opens it after the delay without taking focus; it is hoverable; leaving closes it", async ({
    page,
  }) => {
    await ready(page);
    const islands = card(page, "Interactive components");
    await hover(page, "islands");
    await page.waitForTimeout(100);
    await expect(islands).toBeHidden();
    await expect(islands).toBeVisible();
    await expect(link(page, "islands")).toHaveAttribute("data-popup-open", "");
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    // Below the link, and the pointer can move onto it (hoverable).
    const [a, b] = [await link(page, "islands").boundingBox(), await islands.boundingBox()];
    expect(b!.y).toBeGreaterThan(a!.y + a!.height);
    await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2, { steps: 4 });
    await page.waitForTimeout(400);
    await expect(islands).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(islands).toBeHidden();
    await expect(link(page, "islands")).not.toHaveAttribute("data-popup-open");
  });

  test("Escape dismisses it without moving the pointer (1.4.13)", async ({ page }) => {
    await ready(page);
    await hover(page, "islands");
    await expect(card(page, "Interactive components")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card(page, "Interactive components")).toBeHidden();
  });

  test("keyboard focus opens it; Tab goes through it; leaving the link and the card closes it", async ({
    page,
  }) => {
    await ready(page);
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    await expect(link(page, "islands")).toBeFocused();
    await expect(card(page, "Interactive components")).toBeVisible();
    await expect(link(page, "islands")).toBeFocused();
    // The open card follows its link in the focus order (the link is its invoker).
    await page.keyboard.press("Tab");
    await expect(link(page, "Read about islands")).toBeFocused();
    await expect(card(page, "Interactive components")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(link(page, "guide")).toBeFocused();
    await expect(card(page, "Interactive components")).toBeHidden();
    await page.keyboard.press("Shift+Tab");
    await expect(card(page, "Interactive components")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card(page, "Interactive components")).toBeHidden();
    await expect(link(page, "islands")).toBeFocused();
  });

  test("a click follows the link", async ({ page }) => {
    await ready(page);
    await link(page, "signals").click();
    await expect(page).toHaveURL(/#signals$/);
  });
});

test.describe("by touch", () => {
  test.use({ hasTouch: true });

  test("a tap follows the link and opens no card", async ({ page }) => {
    await ready(page);
    await link(page, "signals").tap();
    await expect(page).toHaveURL(/#signals$/);
    await page.waitForTimeout(400);
    await expect(card(page, "Values that update")).toBeHidden();
  });
});

test.describe("in an island", () => {
  test("bind:open follows the card both ways", async ({ page }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/preview-card/island");
    const state = page.getByTestId("card-state");
    const changelog = card(page, "Every release");
    await expect(async () => {
      await page.getByTestId("open-card").click({ timeout: 250 });
      await expect(changelog).toBeVisible({ timeout: 250 });
    }).toPass();
    await expect(state).toHaveText("card: open");
    await page.keyboard.press("Escape");
    await expect(changelog).toBeHidden();
    await expect(state).toHaveText("card: closed");
    await hover(page, "changelog");
    await expect(state).toHaveText("card: open");
    expect(warnings).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes closed and open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await ready(page);
      expect(await axe(page)).toEqual([]);
      await hover(page, "islands");
      await expect(card(page, "Interactive components")).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });
  }

  test("a server-rendered page loads Preview Card's script and its shared modules only", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await ready(page);
    await page.waitForLoadState("networkidle");
    expect(scripts).toContainEqual(expect.stringMatching(/\/preview-card\.script-[\w-]+\.js$/));
    for (const script of scripts) {
      expect(script).toMatch(/\/(preview-card\.script|layer|place|hover)-[\w-]+\.js$/);
    }
  });
});

test.describe("right to left (TASK-385)", () => {
  test("hover and focus open the card below its link, as left to right", async ({ page }) => {
    await ready(page);
    await rtl(page);
    await hover(page, "islands");
    const islands = card(page, "Interactive components");
    await expect(islands).toBeVisible();
    const [a, b] = [await link(page, "islands").boundingBox(), await islands.boundingBox()];
    expect(b!.y).toBeGreaterThan(a!.y + a!.height);
  });
});
