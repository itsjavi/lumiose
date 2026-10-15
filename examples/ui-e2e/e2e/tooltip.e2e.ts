// Tooltip (TASK-356): the APG tooltip pattern (description of the trigger, Escape), Base UI's and
// Zag's opening rules (hover delay, keyboard focus, never touch, one at a time, the group window),
// what closes it, the hoverable popup of WCAG 1.4.13, layers, the sync with signals in an island,
// and WCAG 2.2 AA with the default theme.
import { expect, test, type Page } from "@playwright/test";
import { axe, clipped, SCHEMES } from "./a11y.ts";

const tip = (page: Page, text: string) => page.getByRole("tooltip").filter({ hasText: text });

/** Rests the mouse on the middle of a button. */
async function hover(page: Page, name: string) {
  const trigger = page.getByRole("button", { name, exact: true });
  // On a small viewport the trigger may sit below the fold, out of the mouse's reach.
  await trigger.scrollIntoViewIfNeeded();
  const box = (await trigger.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the tip describes its trigger in the server HTML", async ({ page }) => {
    await page.goto("/tooltip");
    const bold = page.getByRole("button", { name: "Bold" });
    await expect(bold).toHaveAccessibleDescription("Bold (Ctrl+B)");
    await expect(tip(page, "Bold (Ctrl+B)")).toBeHidden();
  });
});

test.describe("opening", () => {
  test("hover opens it after the delay, above its trigger; leaving closes it", async ({ page }) => {
    await page.goto("/tooltip");
    const bold = tip(page, "Bold (Ctrl+B)");
    await hover(page, "Bold");
    await page.waitForTimeout(300);
    await expect(bold).toBeHidden();
    await expect(bold).toBeVisible();
    // `side="top"` by default and the theme's 6px gap.
    const a = (await page.getByRole("button", { name: "Bold" }).boundingBox())!;
    const b = (await bold.boundingBox())!;
    expect(Math.round(a.y - (b.y + b.height))).toBe(6);
    await page.mouse.move(5, 400);
    await expect(bold).toBeHidden();
  });

  test("keyboard focus opens it at once; blur closes it", async ({ page }) => {
    await page.goto("/tooltip");
    await page.getByRole("button", { name: "Italic" }).focus();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Bold" })).toBeFocused();
    await expect(tip(page, "Bold (Ctrl+B)")).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(tip(page, "Bold (Ctrl+B)")).toBeHidden();
    await expect(tip(page, "Italic (Ctrl+I)")).toBeVisible();
  });

  test("a mouse click focuses the trigger without opening it", async ({ page }) => {
    await page.goto("/tooltip");
    await page.getByRole("button", { name: "Save" }).click({ delay: 0 });
    await page.mouse.move(5, 400);
    await page.waitForTimeout(700);
    await expect(tip(page, "Saves a draft")).toBeHidden();
  });

  test("a press before the delay cancels opening", async ({ page }) => {
    await page.goto("/tooltip");
    await hover(page, "Bold");
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(800);
    await expect(tip(page, "Bold (Ctrl+B)")).toBeHidden();
  });

  test("within the group window the next tooltip opens without delay", async ({ page }) => {
    await page.goto("/tooltip");
    await hover(page, "Bold");
    await expect(tip(page, "Bold (Ctrl+B)")).toBeVisible();
    await hover(page, "Italic");
    // Only one is open at a time; no new delay.
    await expect(tip(page, "Bold (Ctrl+B)")).toBeHidden();
    await expect(tip(page, "Italic (Ctrl+I)")).toBeVisible({ timeout: 300 });
  });

  test("a disabled tooltip does not open on hover or focus", async ({ page }) => {
    await page.goto("/tooltip");
    await hover(page, "Disabled tip");
    await page.waitForTimeout(800);
    await expect(tip(page, "Never opens on hover")).toBeHidden();
    await page.getByRole("button", { name: "Not hoverable" }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Disabled tip" })).toBeFocused();
    await expect(tip(page, "Never opens on hover")).toBeHidden();
  });
});

test.describe("opened by touch", () => {
  test.use({ hasTouch: true });

  test("a tap never opens it", async ({ page }) => {
    await page.goto("/tooltip");
    await page.getByRole("button", { name: "Bold" }).tap();
    await page.waitForTimeout(800);
    await expect(tip(page, "Bold (Ctrl+B)")).toBeHidden();
  });
});

test.describe("closing", () => {
  test("Escape closes it without moving the pointer (1.4.13)", async ({ page }) => {
    await page.goto("/tooltip");
    await hover(page, "Bold");
    await expect(tip(page, "Bold (Ctrl+B)")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tip(page, "Bold (Ctrl+B)")).toBeHidden();
  });

  test("a click on the trigger closes it, unless closeOnClick is false", async ({ page }) => {
    await page.goto("/tooltip");
    await hover(page, "Bold");
    await expect(tip(page, "Bold (Ctrl+B)")).toBeVisible();
    await page.mouse.down();
    await page.mouse.up();
    await expect(tip(page, "Bold (Ctrl+B)")).toBeHidden();
    // It stays closed while the pointer rests on the trigger.
    await page.waitForTimeout(800);
    await expect(tip(page, "Bold (Ctrl+B)")).toBeHidden();

    await hover(page, "Pin");
    await expect(tip(page, "Stays open when clicked")).toBeVisible();
    await page.mouse.down();
    await page.mouse.up();
    await expect(tip(page, "Stays open when clicked")).toBeVisible();
  });

  test("Enter on a focused trigger closes it", async ({ page }) => {
    await page.goto("/tooltip");
    await page.getByRole("button", { name: "Italic" }).focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(tip(page, "Italic (Ctrl+I)")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(tip(page, "Italic (Ctrl+I)")).toBeHidden();
  });

  test("scrolling an ancestor of the trigger closes it", async ({ page }) => {
    await page.goto("/tooltip");
    await page.getByRole("button", { name: "Scrolled" }).scrollIntoViewIfNeeded();
    await hover(page, "Scrolled");
    await expect(tip(page, "Closes when the list scrolls")).toBeVisible();
    await page.getByTestId("scroller").evaluate((el) => el.scrollBy(0, 20));
    await expect(tip(page, "Closes when the list scrolls")).toBeHidden();
  });
});

test.describe("hoverable popup (WCAG 1.4.13)", () => {
  test("the pointer can move onto the tip, which stays open", async ({ page }) => {
    await page.goto("/tooltip");
    await hover(page, "Pin");
    const pin = tip(page, "Stays open when clicked");
    await expect(pin).toBeVisible();
    const box = (await pin.boundingBox())!;
    // Down across the 6px gap and onto the tip (side="bottom").
    await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 4 });
    await page.waitForTimeout(300);
    await expect(pin).toBeVisible();
    await page.mouse.move(5, 400);
    await expect(pin).toBeHidden();
  });

  test("disableHoverablePopup closes it when the pointer leaves the trigger", async ({ page }) => {
    await page.goto("/tooltip");
    await hover(page, "Not hoverable");
    const notHoverable = tip(page, "Closes when the pointer leaves the trigger");
    await expect(notHoverable).toBeVisible();
    const box = (await notHoverable.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 4 });
    await expect(notHoverable).toBeHidden();
  });
});

test.describe("layers", () => {
  test("in a dialog, Escape closes the tooltip and leaves the dialog open", async ({ page }) => {
    await page.goto("/tooltip");
    await page.getByRole("button", { name: "Edit link" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit link" });
    await expect(dialog).toBeVisible();
    // Focus is on Copy, the first button, by mouse: no tooltip yet.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(tip(page, "Copies the link")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tip(page, "Copies the link")).toBeHidden();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("in a popover, the tooltip opens without closing it", async ({ page }) => {
    await page.goto("/tooltip");
    await page.getByRole("button", { name: "Account" }).click();
    const account = page.getByRole("dialog", { name: "Account" });
    await expect(account).toBeVisible();
    await hover(page, "Sign out");
    await expect(tip(page, "Signs out on every device")).toBeVisible();
    await expect(account).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tip(page, "Signs out on every device")).toBeHidden();
    await expect(account).toBeVisible();
  });
});

test.describe("in an island", () => {
  test("bind:open opens and closes it, and follows hover", async ({ page }) => {
    await page.goto("/popover/island");
    const state = page.getByTestId("tooltip-state");
    const help = tip(page, "Bound to a signal");
    await expect(state).toHaveText("tip: false");
    await page.getByTestId("tooltip-toggle").click();
    await expect(help).toBeVisible();
    await expect(state).toHaveText("tip: true");
    await page.getByTestId("tooltip-toggle").click();
    await expect(help).toBeHidden();
    await expect(state).toHaveText("tip: false");
    await hover(page, "Help");
    await expect(help).toBeVisible();
    await expect(state).toHaveText("tip: true");
  });
});

test("a server-rendered page with tooltips loads only the client scripts", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
  });
  await page.goto("/tooltip");
  await hover(page, "Bold");
  await expect(tip(page, "Bold (Ctrl+B)")).toBeVisible();
  // The page also has a dialog and a popover; no island runtime.
  expect(scripts.toSorted()).toEqual([
    expect.stringMatching(/\/dialog\.script-[\w-]+\.js$/),
    expect.stringMatching(/\/layer-[\w-]+\.js$/),
    expect.stringMatching(/\/place-[\w-]+\.js$/),
    expect.stringMatching(/\/popover\.script-[\w-]+\.js$/),
    expect.stringMatching(/\/tooltip\.script-[\w-]+\.js$/),
  ]);
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes closed and open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/tooltip");
      expect(await axe(page)).toEqual([]);
      await hover(page, "Bold");
      await expect(tip(page, "Bold (Ctrl+B)")).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await hover(page, "Pin");
      await expect(tip(page, "Stays open when clicked")).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });
  }

  test("tips stay inside the viewport at 320 CSS pixels (1.4.10)", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/tooltip");
    for (const [name, text] of [
      ["Bold", "Bold (Ctrl+B)"],
      ["Not hoverable", "Closes when the pointer leaves the trigger"],
    ]) {
      await hover(page, name!);
      const open = tip(page, text!);
      await expect(open).toBeVisible();
      const box = (await open.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      expect(await clipped(open)).toEqual([]);
      await page.keyboard.press("Escape");
    }
  });
});
