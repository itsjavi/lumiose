// Popover: open on hover and the modal variant (TASK-394). Hover: a mouse resting on the trigger
// opens it after its delay without moving focus; it stays open while the pointer is on the trigger
// or the popup and closes after its close delay (WCAG 1.4.13: hoverable, persistent, dismissible
// with Escape); a click keeps it open; touch and the keyboard open it with a click, as without
// hover. Modal: a modal <dialog> anchored to its trigger, opened by an invoker command (without
// JavaScript too); the page behind is inert and does not scroll, a press outside or Escape closes
// it and focus returns. The sync with signals in an island, and WCAG 2.2 AA with the default theme
// (doc-9 sections 1, 3 and 17).
import { expect, test, type Page } from "@playwright/test";
import { axe, focusRing, lastNavLink, SCHEMES, smallTargets } from "./a11y.ts";

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

const trigger = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const card = (page: Page, name: string) => page.getByRole("dialog", { name, exact: true });

/** Rests the mouse on the middle of `name`'s trigger. */
async function hover(page: Page, name: string) {
  const box = (await trigger(page, name).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

/** /popover/hover-modal with Popover's script running. */
async function ready(page: Page) {
  await page.goto("/popover/hover-modal");
  // The script makes a trigger's popup manual on its first click; until then it has no state of
  // its own to wait for, so wait for the module to have run.
  await page.waitForFunction(() =>
    performance.getEntriesByType("resource").some((entry) => /popover\.script/.test(entry.name)),
  );
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the modal popover opens and closes with invoker commands; hover does nothing", async ({
    page,
  }) => {
    await page.goto("/popover/hover-modal");
    await hover(page, "Ada Lovelace");
    await page.waitForTimeout(500);
    await expect(card(page, "Ada Lovelace")).toBeHidden();
    await trigger(page, "Ada Lovelace").click();
    await expect(card(page, "Ada Lovelace")).toBeVisible();
    await page.keyboard.press("Escape");
    await trigger(page, "Rename").click();
    const rename = card(page, "Rename the file");
    await expect(rename).toBeVisible();
    expect(await rename.evaluate((el) => el.matches(":modal"))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(rename).toBeHidden();
  });
});

test.describe("open on hover", () => {
  test("opens after its delay without taking focus, stays while hovered, closes when left", async ({
    page,
  }) => {
    await ready(page);
    const ada = card(page, "Ada Lovelace");
    await hover(page, "Ada Lovelace");
    await expect(ada).toBeVisible();
    await expect(trigger(page, "Ada Lovelace")).toHaveAttribute("aria-expanded", "true");
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    // Across the gap and onto the popup: it stays (hoverable).
    const box = (await ada.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await page.waitForTimeout(300);
    await expect(ada).toBeVisible();
    // Away from both: it closes.
    await page.mouse.move(box.x + box.width + 200, box.y + box.height + 200);
    await expect(ada).toBeHidden();
  });

  test("a pointer that leaves before the delay opens nothing; Escape dismisses it (1.4.13)", async ({
    page,
  }) => {
    await ready(page);
    const ada = card(page, "Ada Lovelace");
    await hover(page, "Ada Lovelace");
    await page.mouse.move(5, 5);
    await page.waitForTimeout(400);
    await expect(ada).toBeHidden();
    await hover(page, "Ada Lovelace");
    await expect(ada).toBeVisible();
    // Dismissible without moving the pointer.
    await page.keyboard.press("Escape");
    await expect(ada).toBeHidden();
  });

  test("closeDelay keeps it open a while after the pointer leaves", async ({ page }) => {
    await ready(page);
    const grace = card(page, "Grace Hopper");
    await hover(page, "Grace Hopper");
    await expect(grace).toBeVisible();
    await page.mouse.move(5, 5);
    await page.waitForTimeout(150);
    await expect(grace).toBeVisible();
    await expect(grace).toBeHidden();
  });

  test("a click on the trigger keeps it open until it is dismissed", async ({ page }) => {
    await ready(page);
    const ada = card(page, "Ada Lovelace");
    await hover(page, "Ada Lovelace");
    await expect(ada).toBeVisible();
    await trigger(page, "Ada Lovelace").click();
    await page.mouse.move(5, 400);
    await page.waitForTimeout(300);
    await expect(ada).toBeVisible();
    await page.mouse.click(5, 400);
    await expect(ada).toBeHidden();
  });

  test("the keyboard opens it with Enter, on its first focusable element", async ({ page }) => {
    await ready(page);
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    await expect(trigger(page, "Ada Lovelace")).toBeFocused();
    await page.waitForTimeout(400);
    await expect(card(page, "Ada Lovelace")).toBeHidden();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: "Profile" })).toBeFocused();
  });
});

test.describe("the safe triangle and trap-focus (TASK-410)", () => {
  test("a slow path toward the popup keeps it open; one away from it lets it close", async ({
    page,
  }) => {
    await ready(page);
    const turing = card(page, "Alan Turing");
    await hover(page, "Alan Turing");
    await expect(turing).toBeVisible();
    const from = (await trigger(page, "Alan Turing").boundingBox())!;
    const to = (await turing.boundingBox())!;
    const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const end = { x: to.x + to.width * 0.8, y: to.y + to.height / 2 };
    // Ten small moves, 40 ms apart: far longer than the 100 ms grace in all.
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(
        start.x + ((end.x - start.x) * i) / 10,
        start.y + ((end.y - start.y) * i) / 10,
      );
      await page.waitForTimeout(40);
      await expect(turing).toBeVisible();
    }
    await page.waitForTimeout(300);
    await expect(turing).toBeVisible();
    // Back on the trigger, then off the other way: the triangle does not hold it.
    await page.mouse.move(start.x, start.y, { steps: 4 });
    await page.mouse.move(start.x, start.y - 120, { steps: 6 });
    await expect(turing).toBeHidden();
  });

  test('modal="trap-focus" keeps Tab in the popup, and the page usable', async ({ page }) => {
    await ready(page);
    const filters = card(page, "Filters");
    await trigger(page, "Filters").click();
    await expect(filters).toBeVisible();
    const from = filters.getByRole("textbox", { name: "From" });
    const done = filters.getByRole("button", { name: "Done" });
    await expect(from).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(done).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(from).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(done).toBeFocused();
    // Not modal otherwise: the page scrolls, and a press outside lands (and closes it).
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
    await page.getByRole("button", { name: "Behind" }).click();
    await expect(filters).toBeHidden();
    await expect(page.getByRole("button", { name: "Behind" })).toBeFocused();
  });
});

test.describe("open on hover, by touch", () => {
  test.use({ hasTouch: true });

  test("a tap opens it, as a click does", async ({ page }) => {
    await ready(page);
    await trigger(page, "Ada Lovelace").tap();
    await expect(card(page, "Ada Lovelace")).toBeVisible();
  });
});

test.describe("modal", () => {
  test("focus moves in and stays in, the page is inert and locked, Escape closes", async ({
    page,
  }) => {
    await ready(page);
    const rename = card(page, "Rename the file");
    await trigger(page, "Rename").click();
    await expect(rename).toBeVisible();
    await expect(trigger(page, "Rename")).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("textbox", { name: "Name" })).toBeFocused();
    // Anchored below its trigger, aligned to its start.
    const [anchor, box] = [await trigger(page, "Rename").boundingBox(), await rename.boundingBox()];
    expect(box!.y).toBeGreaterThan(anchor!.y + anchor!.height);
    expect(Math.abs(box!.x - anchor!.x)).toBeLessThan(2);
    // Tab stays inside: the page behind is inert.
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      await expect(trigger(page, "Behind")).not.toBeFocused();
    }
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
      "hidden",
    );
    await page.keyboard.press("Escape");
    await expect(rename).toBeHidden();
    await expect(trigger(page, "Rename")).toBeFocused();
    await expect(trigger(page, "Rename")).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
      "visible",
    );
  });

  test("a press outside closes it without reaching what is under it; Close buttons close it", async ({
    page,
  }) => {
    await ready(page);
    const rename = card(page, "Rename the file");
    await trigger(page, "Rename").click();
    await expect(rename).toBeVisible();
    // A click on another trigger, behind the (invisible) backdrop: it closes the popover only.
    const ada = (await trigger(page, "Ada Lovelace").boundingBox())!;
    await page.mouse.click(ada.x + ada.width / 2, ada.y + ada.height / 2);
    await expect(rename).toBeHidden();
    await expect(card(page, "Ada Lovelace")).toBeHidden();
    await expect(trigger(page, "Ada Lovelace")).not.toBeFocused();
    await trigger(page, "Rename").click();
    await rename.getByRole("button", { name: "Cancel" }).click();
    await expect(rename).toBeHidden();
  });
});

test.describe("in an island", () => {
  test("bind:open follows a modal popover and a hover-opened one", async ({ page }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/popover/hover-modal/island");
    const state = page.getByTestId("popover-state");
    const settings = card(page, "Settings");
    await expect(async () => {
      await page.getByTestId("open-modal").click({ timeout: 250 });
      await expect(settings).toBeVisible({ timeout: 250 });
    }).toPass();
    await expect(state).toHaveText("modal: open, card: closed");
    await settings.getByRole("button", { name: "Done" }).click();
    await expect(state).toHaveText("modal: closed, card: closed");
    await hover(page, "Profile card");
    await expect(state).toHaveText("modal: closed, card: open");
    await page.mouse.move(5, 5);
    await expect(state).toHaveText("modal: closed, card: closed");
    expect(warnings).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes closed and open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await ready(page);
      expect(await axe(page)).toEqual([]);
      await hover(page, "Ada Lovelace");
      await expect(card(page, "Ada Lovelace")).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.mouse.move(5, 5);
      await trigger(page, "Rename").click();
      await expect(card(page, "Rename the file")).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus is visible (2.4.7) and the targets are 24px (2.5.8)", async ({ page }) => {
    await ready(page);
    await trigger(page, "Rename").focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    expect(await focusRing(page)).toBe("2px solid");
    await page.keyboard.press("Enter");
    await expect(card(page, "Rename the file")).toBeVisible();
    expect(await smallTargets(card(page, "Rename the file"))).toEqual([]);
  });

  test("a server-rendered page loads Popover's and Dialog's scripts only", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await ready(page);
    await page.waitForLoadState("networkidle");
    // With the modules the scripts share with others (the layer model, the fallback placement).
    expect(scripts.toSorted()).toEqual([
      expect.stringMatching(/\/dialog\.script-[\w-]+\.js$/),
      expect.stringMatching(/\/hover-[\w-]+\.js$/),
      expect.stringMatching(/\/layer-[\w-]+\.js$/),
      expect.stringMatching(/\/place-[\w-]+\.js$/),
      expect.stringMatching(/\/popover\.script-[\w-]+\.js$/),
    ]);
  });
});

test.describe("right to left (TASK-385)", () => {
  test("a modal popover aligned to the start lines up with its trigger's right edge", async ({
    page,
  }) => {
    await ready(page);
    await rtl(page);
    await trigger(page, "Rename").click();
    const rename = card(page, "Rename the file");
    await expect(rename).toBeVisible();
    const [a, b] = [await trigger(page, "Rename").boundingBox(), await rename.boundingBox()];
    expect(Math.abs(a!.x + a!.width - (b!.x + b!.width))).toBeLessThan(2);
  });
});
