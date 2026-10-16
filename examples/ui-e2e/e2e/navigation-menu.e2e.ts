// Navigation Menu (TASK-380): a `<nav>` landmark whose triggers open panels of links through
// `popovertarget` (links and panels work without JavaScript), hover intent with its delays, click
// to keep a panel open, the disclosure navigation keys, closing when focus leaves, the vertical
// orientation, the activation direction, the sync with a signal in an island, and WCAG 2.2 AA with
// the default theme (doc-9 sections 1, 3 and 17).
import { expect, test, type Page } from "@playwright/test";
import { axe, clipped, lastNavLink, SCHEMES, smallTargets, TEXT_SPACING } from "./a11y.ts";

/** Puts the whole page right to left. */
const rtl = (page: Page) => page.evaluate(() => (document.documentElement.dir = "rtl"));

const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

/** A trigger by its exact name. */
const trigger = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/** The panel a trigger opens. */
async function panelOf(page: Page, name: string) {
  const id = await page.getByRole("button", { name, exact: true }).getAttribute("popovertarget");
  return page.locator(`[id="${id}"]`);
}

/** Waits until the element runs: it answers a click on Products. */
async function ready(page: Page) {
  await expect(page.locator("lu-navigation-menu").first()).toHaveJSProperty("value", null);
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("it is a navigation landmark whose links and panels work", async ({ page }) => {
    await page.goto("/navigation-menu");
    const main = page.getByRole("navigation", { name: "Main" });
    await expect(main.getByRole("link", { name: "Pricing" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const products = main.getByRole("button", { name: "Products" });
    await products.click();
    const panel = await panelOf(page, "Products");
    await expect(panel).toBeVisible();
    await panel.getByRole("link", { name: "Analytics" }).click();
    await expect(page).toHaveURL(/#analytics$/);
    // One panel at a time.
    await main.getByRole("button", { name: "Learn" }).click();
    await expect(await panelOf(page, "Learn")).toBeVisible();
    await expect(panel).toBeHidden();
  });
});

test.describe("pointer", () => {
  test("resting on a trigger opens its panel; another trigger switches; leaving closes", async ({
    page,
  }) => {
    await page.goto("/navigation-menu");
    await ready(page);
    const products = trigger(page, "Products");
    const productsPanel = await panelOf(page, "Products");
    const learnPanel = await panelOf(page, "Learn");
    await products.hover();
    await expect(productsPanel).toBeVisible();
    await expect(products).toHaveAttribute("aria-expanded", "true");
    await page.getByRole("button", { name: "Learn", exact: true }).hover();
    await expect(learnPanel).toBeVisible();
    await expect(productsPanel).toBeHidden();
    // Learn is to the right of Products: its panel comes in from the right.
    await expect(learnPanel).toHaveAttribute("data-activation-direction", "right");
    // The pointer can travel into the panel.
    await learnPanel.getByRole("link", { name: "Guides" }).hover();
    await page.waitForTimeout(400);
    await expect(learnPanel).toBeVisible();
    await page.mouse.move(700, 600);
    await expect(learnPanel).toBeHidden();
    await expect(page.getByRole("button", { name: "Learn", exact: true })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  test("a click keeps a panel open when the pointer leaves; another click closes it", async ({
    page,
  }) => {
    await page.goto("/navigation-menu");
    await ready(page);
    const products = trigger(page, "Products");
    const panel = await panelOf(page, "Products");
    await products.hover();
    await expect(panel).toBeVisible();
    await products.click();
    await page.mouse.move(700, 600);
    await page.waitForTimeout(400);
    await expect(panel).toBeVisible();
    await products.click();
    await expect(panel).toBeHidden();
    // A click outside closes a panel too.
    await products.click();
    await expect(panel).toBeVisible();
    await page.mouse.click(700, 600);
    await expect(panel).toBeHidden();
  });

  test("a right-click outside leaves a panel open (TASK-451 L24)", async ({ page }) => {
    await page.goto("/navigation-menu");
    await ready(page);
    const panel = await panelOf(page, "Products");
    await trigger(page, "Products").click();
    await expect(panel).toBeVisible();
    await page.mouse.click(700, 600, { button: "right" });
    await page.waitForTimeout(200);
    await expect(panel).toBeVisible();
    await page.mouse.click(700, 600);
    await expect(panel).toBeHidden();
  });

  test("on the way to a panel, crossing the next trigger keeps it (TASK-451 L25)", async ({
    page,
  }) => {
    await page.goto("/navigation-menu");
    await ready(page);
    const products = trigger(page, "Products");
    const panel = await panelOf(page, "Products");
    const learnPanel = await panelOf(page, "Learn");
    // A wide panel, reaching under Learn.
    const id = await panel.getAttribute("id");
    await page.addStyleTag({ content: `[id="${id}"] { inline-size: 40rem; }` });
    await products.hover();
    await expect(panel).toBeVisible();
    const from = (await products.boundingBox())!;
    const learn = (await trigger(page, "Learn").boundingBox())!;
    const box = (await panel.boundingBox())!;
    // A straight line from Products' centre through Learn's lower left corner, into the panel.
    const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const via = { x: learn.x + 4, y: learn.y + learn.height - 4 };
    const y = box.y + 6;
    const end = { x: start.x + ((via.x - start.x) * (y - start.y)) / (via.y - start.y), y };
    expect(end.x).toBeLessThan(box.x + box.width);
    await page.mouse.move(start.x, start.y);
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.waitForTimeout(400);
    await expect(panel).toBeVisible();
    await expect(learnPanel).toBeHidden();
  });

  test("a link marked closeOnClick closes its panel", async ({ page }) => {
    await page.goto("/navigation-menu");
    await ready(page);
    await trigger(page, "Learn").click();
    const panel = await panelOf(page, "Learn");
    await panel.getByRole("link", { name: "Blog" }).click();
    await expect(panel).toBeHidden();
    await expect(page).toHaveURL(/#blog$/);
  });
});

test.describe("keyboard", () => {
  test("every trigger and link is a tab stop; Enter opens a panel and Tab goes into it", async ({
    page,
  }) => {
    await page.goto("/navigation-menu");
    await ready(page);
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    const products = trigger(page, "Products");
    await expect(products).toBeFocused();
    await page.keyboard.press("Enter");
    const panel = await panelOf(page, "Products");
    await expect(panel).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(panel.getByRole("link", { name: "Analytics" })).toBeFocused();
    // Escape closes it and returns to the trigger.
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(products).toBeFocused();
  });

  test("the arrows move between triggers and links, and into and within a panel", async ({
    page,
  }) => {
    await page.goto("/navigation-menu");
    await ready(page);
    const products = trigger(page, "Products");
    const learn = trigger(page, "Learn");
    const pricing = page.getByRole("link", { name: "Pricing" });
    await products.focus();
    await page.keyboard.press("ArrowRight");
    await expect(learn).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(pricing).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(products).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(pricing).toBeFocused();
    await page.keyboard.press("Home");
    await expect(products).toBeFocused();
    await page.keyboard.press("End");
    await expect(pricing).toBeFocused();
    await products.focus();
    await page.keyboard.press("ArrowDown");
    const panel = await panelOf(page, "Products");
    await expect(panel.getByRole("link", { name: "Analytics" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(panel.getByRole("link", { name: "Automation" })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await expect(panel.getByRole("link", { name: "Reports" })).toBeFocused();
  });

  test("focus leaving an open item closes its panel", async ({ page }) => {
    await page.goto("/navigation-menu");
    await ready(page);
    const products = trigger(page, "Products");
    await products.focus();
    await page.keyboard.press("Enter");
    const panel = await panelOf(page, "Products");
    await expect(panel).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(trigger(page, "Learn")).toBeFocused();
    await expect(panel).toBeHidden();
  });

  test("a vertical menu moves with Up and Down and opens toward its panel", async ({ page }) => {
    await page.goto("/navigation-menu");
    await ready(page);
    const account = trigger(page, "Account");
    await account.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("link", { name: "Help" })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(account).toBeFocused();
    await page.keyboard.press("ArrowRight");
    const panel = await panelOf(page, "Account");
    await expect(panel.getByRole("link", { name: "Profile" })).toBeFocused();
    await expect(panel).toHaveAttribute("data-side", "inline-end");
  });
});

test.describe("a nested menu (TASK-433)", () => {
  test("Tab into it keeps the parent open", async ({ page }) => {
    await page.goto("/navigation-menu");
    await ready(page);
    await trigger(page, "Learn").focus();
    await page.keyboard.press("Enter");
    const learn = await panelOf(page, "Learn");
    await expect(learn).toBeVisible();
    await learn.getByRole("link", { name: "Blog" }).focus();
    await page.keyboard.press("Tab");
    await expect(trigger(page, "More")).toBeFocused();
    await expect(learn).toBeVisible();
    await page.keyboard.press("Enter");
    const more = await panelOf(page, "More");
    await expect(more).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(more.getByRole("link", { name: "Courses" })).toBeFocused();
    await expect(learn).toBeVisible();
  });

  test("a click on its trigger opens it inside the open parent", async ({ page }) => {
    await page.goto("/navigation-menu");
    await ready(page);
    await trigger(page, "Learn").click();
    const learn = await panelOf(page, "Learn");
    await expect(learn).toBeVisible();
    await trigger(page, "More").click();
    await expect(await panelOf(page, "More")).toBeVisible();
    await expect(learn).toBeVisible();
  });

  test("hover onto it keeps the parent open; a closeOnClick link closes every level", async ({
    page,
  }) => {
    await page.goto("/navigation-menu");
    await ready(page);
    await trigger(page, "Learn").hover();
    const learn = await panelOf(page, "Learn");
    await expect(learn).toBeVisible();
    await trigger(page, "More").hover();
    const more = await panelOf(page, "More");
    await expect(more).toBeVisible();
    await page.waitForTimeout(400);
    await expect(learn).toBeVisible();
    await more.getByRole("link", { name: "API" }).click();
    await expect(more).toBeHidden();
    await expect(learn).toBeHidden();
    await expect(page).toHaveURL(/#api$/);
  });
});

test.describe("in an island", () => {
  test("the open item follows a signal both ways", async ({ page }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/navigation-menu/island");
    const value = page.getByTestId("value");
    const docs = await panelOf(page, "Docs");
    await expect(async () => {
      await page.getByTestId("open-docs").click({ timeout: 250 });
      await expect(docs).toBeVisible({ timeout: 250 });
    }).toPass();
    await expect(value).toHaveText("Open: docs");
    await page.getByRole("button", { name: "Community", exact: true }).click();
    await expect(value).toHaveText("Open: community");
    await expect(docs).toBeHidden();
    await page.getByTestId("close").click();
    await expect(value).toHaveText("Open: none");
    await expect(await panelOf(page, "Community")).toBeHidden();
    expect(warnings).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes closed and open, on the page and the island (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/navigation-menu");
      await ready(page);
      expect(await axe(page)).toEqual([]);
      await trigger(page, "Products").click();
      await expect(await panelOf(page, "Products")).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.goto("/navigation-menu/island");
      await expect(async () => {
        await page.getByTestId("open-docs").click({ timeout: 250 });
        await expect(await panelOf(page, "Docs")).toBeVisible({ timeout: 250 });
      }).toPass();
      expect(await axe(page)).toEqual([]);
    });
  }

  test("triggers and links are 24px targets with a focus ring", async ({ page }) => {
    await page.goto("/navigation-menu");
    await ready(page);
    await trigger(page, "Products").click();
    expect(await smallTargets(page.locator("main"))).toEqual([]);
    const learn = trigger(page, "Learn");
    await learn.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    expect(await learn.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
  });

  test("the page reflows at 320 CSS pixels with text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/navigation-menu");
    await page.addStyleTag({ content: TEXT_SPACING });
    const main = page.locator("main");
    const box = (await main.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(await clipped(main)).toEqual([]);
  });
});

test.describe("right to left (TASK-385)", () => {
  test("Arrow Left moves to the next trigger and Arrow Right back, looping", async ({ page }) => {
    await page.goto("/navigation-menu");
    await ready(page);
    await rtl(page);
    await trigger(page, "Products").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(trigger(page, "Learn")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(trigger(page, "Products")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("link", { name: "Pricing" })).toBeFocused();
  });
});
