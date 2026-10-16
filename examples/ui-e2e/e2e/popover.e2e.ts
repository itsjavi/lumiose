// Popover (TASK-356): behaviour without JavaScript, focus on open and its return on close, the
// non-modal Tab order of Zag's popover suite, layers and nesting, placement with and without CSS
// anchor positioning, the sync with signals in an island, and WCAG 2.2 AA with the default theme.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { axe, clipped, focusRing, SCHEMES, smallTargets, TEXT_SPACING } from "./a11y.ts";

const popup = (page: Page, name: string) => page.getByRole("dialog", { name, exact: true });

/** Whether the popover is open (`:popover-open`). */
const isOpen = (locator: Locator) => locator.evaluate((el) => el.matches(":popover-open"));

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the trigger, Escape, a close button and a click outside open and close it", async ({
    page,
  }) => {
    await page.goto("/popover");
    const trigger = page.getByRole("button", { name: "Notifications" });
    const notifications = popup(page, "Notifications");
    await trigger.click();
    await expect(notifications).toBeVisible();
    await expect(notifications).toHaveAccessibleDescription("You are all caught up.");
    await page.keyboard.press("Escape");
    await expect(notifications).toBeHidden();

    await trigger.click();
    await notifications.getByRole("button", { name: "Close" }).click();
    await expect(notifications).toBeHidden();

    await trigger.click();
    await expect(notifications).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(notifications).toBeHidden();
  });

  test("CSS anchor positioning places it below its trigger", async ({ page }) => {
    await page.goto("/popover");
    const trigger = page.getByRole("button", { name: "Notifications" });
    await trigger.click();
    const box = (await popup(page, "Notifications").boundingBox())!;
    const anchor = (await trigger.boundingBox())!;
    // `align="start"` and the theme's 4px gap.
    expect(Math.round(box.y - (anchor.y + anchor.height))).toBe(4);
    expect(Math.round(box.x)).toBe(Math.round(anchor.x));
  });
});

test.describe("keyboard and focus", () => {
  test("Enter opens it on its first focusable element; Escape closes it and focus returns", async ({
    page,
  }) => {
    await page.goto("/popover");
    const trigger = page.getByRole("button", { name: "Notifications" });
    await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await trigger.focus();
    await page.keyboard.press("Enter");
    const notifications = popup(page, "Notifications");
    await expect(notifications).toBeVisible();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(notifications.getByRole("link", { name: "Settings" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(notifications).toBeHidden();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  });

  test("Tab out of the popup moves to the element after the trigger", async ({ page }) => {
    await page.goto("/popover");
    const trigger = page.getByRole("button", { name: "Notifications" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const notifications = popup(page, "Notifications");
    await expect(notifications.getByRole("link", { name: "Settings" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(notifications.getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Next step" })).toBeFocused();
  });

  test("Shift+Tab from the start of the popup returns to the trigger", async ({ page }) => {
    await page.goto("/popover");
    const trigger = page.getByRole("button", { name: "Notifications" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(popup(page, "Notifications").getByRole("link")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(trigger).toBeFocused();
    expect(await isOpen(popup(page, "Notifications"))).toBe(true);
  });

  test("when the trigger is the last tabbable element, Tab does not loop back in", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "firefox",
      "Tab past the page's last element leaves the page; headless Firefox has no browser UI to take focus, so it stays",
    );
    await page.goto("/popover");
    const trigger = page.getByRole("button", { name: "Help" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const help = page.getByRole("dialog").filter({ hasText: "Press Tab to leave." });
    const link = help.getByRole("link", { name: "Read more" });
    await expect(link).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(link).not.toBeFocused();
    expect(await help.evaluate((el) => el.contains(document.activeElement))).toBe(false);
  });

  test("a popup with nothing to focus takes focus itself", async ({ page }) => {
    await page.goto("/popover");
    await page.getByRole("button", { name: "Shipping" }).click();
    const shipping = page.getByRole("dialog").filter({ hasText: "Free shipping" });
    await expect(shipping).toBeFocused();
    await expect(shipping).toHaveAccessibleDescription("Free shipping on orders over 50 euros.");
  });

  test("a click outside returns focus to the trigger, unless it lands on a control", async ({
    page,
  }) => {
    // Room below the trigger under the fixture's long nav, so the popup does not flip over the
    // controls the test presses (Firefox's and WebKit's fonts on Linux make the page taller).
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/popover");
    const trigger = page.getByRole("button", { name: "Notifications" });
    const notifications = popup(page, "Notifications");
    await trigger.click();
    await expect(notifications).toBeVisible();
    await page.mouse.click(5, 300);
    await expect(notifications).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(notifications).toBeVisible();
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(notifications).toBeHidden();
    await expect(page.getByRole("button", { name: "Next step" })).toBeFocused();
  });

  test("a right-click outside does not close it", async ({ page }) => {
    // Base UI and Zag ignore secondary buttons (doc-9, section 1); Chromium's light dismiss does
    // not, and cannot be cancelled, so the script makes the popup manual and dismisses it with the
    // shared layer model.
    await page.goto("/popover");
    await page.getByRole("button", { name: "Filters" }).click();
    await page.getByRole("button", { name: "Date range…" }).click();
    await expect(popup(page, "Date range")).toBeVisible();
    await page.mouse.click(5, 300, { button: "right" });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await expect(popup(page, "Date range")).toBeVisible();
    await expect(popup(page, "Filters")).toBeVisible();
    await page.mouse.click(5, 300);
    await expect(popup(page, "Filters")).toBeHidden();
  });

  test("a click on the trigger toggles it; a close button returns focus", async ({ page }) => {
    await page.goto("/popover");
    const trigger = page.getByRole("button", { name: "Notifications" });
    const notifications = popup(page, "Notifications");
    await trigger.click();
    await expect(notifications).toBeVisible();
    await trigger.click();
    await expect(notifications).toBeHidden();
    await trigger.click();
    await notifications.getByRole("button", { name: "Close" }).click();
    await expect(notifications).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});

test.describe("opened by touch", () => {
  test.use({ hasTouch: true });

  test("the popup focuses itself, not its first control", async ({ page }) => {
    await page.goto("/popover");
    await page.getByRole("button", { name: "Notifications" }).tap();
    const notifications = popup(page, "Notifications");
    await expect(notifications).toBeVisible();
    await expect(notifications).toBeFocused();
  });
});

test.describe("layers", () => {
  test("a nested popover keeps its parent open; Escape closes one at a time", async ({ page }) => {
    await page.goto("/popover");
    await page.getByRole("button", { name: "Filters" }).click();
    const filters = popup(page, "Filters");
    const dateTrigger = filters.getByRole("button", { name: "Date range…" });
    await dateTrigger.click();
    const range = popup(page, "Date range");
    await expect(range).toBeVisible();
    // A press inside the child keeps both open.
    await range.getByText("Pick the days to show.").click();
    await expect(range).toBeVisible();
    await expect(filters).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(range).toBeHidden();
    await expect(filters).toBeVisible();
    await expect(dateTrigger).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(filters).toBeHidden();
  });

  test("in a dialog, Escape and a click outside close the popover, not the dialog", async ({
    page,
  }) => {
    await page.goto("/popover");
    await page.getByRole("button", { name: "Share…" }).click();
    const dialog = page.getByRole("dialog", { name: "Share" });
    const trigger = dialog.getByRole("button", { name: "Link options" });
    await trigger.click();
    const options = page.locator("[popover]").filter({ hasText: "Anyone with the link" });
    await expect(options).toBeVisible();
    await expect(options.getByRole("button", { name: "Got it" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(options).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(options).toBeVisible();
    await dialog.getByRole("heading", { name: "Share" }).click();
    await expect(options).toBeHidden();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("opening another popover closes the first", async ({ page }) => {
    await page.goto("/popover");
    await page.getByRole("button", { name: "Notifications" }).click();
    await page.getByRole("button", { name: "Shipping" }).click();
    await expect(popup(page, "Notifications")).toBeHidden();
    await expect(page.getByRole("dialog").filter({ hasText: "Free shipping" })).toBeVisible();
  });
});

/** The popup's box relative to its trigger's, for each side of the placement demo. */
async function placements(page: Page) {
  const out: Record<string, { dx: number; dy: number }> = {};
  for (const side of ["top", "right", "bottom", "left", "inline-start", "inline-end"]) {
    const trigger = page.getByRole("button", { name: side, exact: true });
    await trigger.click();
    const tip = page.getByRole("dialog").filter({ hasText: `On the ${side} side` });
    await expect(tip).toBeVisible();
    // The client script places it in the frame it first paints in.
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const a = (await trigger.boundingBox())!;
    const b = (await tip.boundingBox())!;
    out[side] = { dx: Math.round(b.x - a.x), dy: Math.round(b.y - a.y) };
    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();
  }
  return out;
}

test.describe("placement", () => {
  test("each side, aligned to the end, with and without CSS anchor positioning", async ({
    page,
  }) => {
    // Room on every side of the triggers below the fixture's long nav, so none flips.
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/popover");
    const anchored = await placements(page);
    // The popup is beside the trigger on the requested side, its end edge 4px inside the trigger's.
    for (const [side, { dx, dy }] of Object.entries(anchored)) {
      if (side === "top") expect(dy).toBeLessThan(0);
      if (side === "bottom") expect(dy).toBeGreaterThan(0);
      if (side === "left" || side === "inline-start") expect(dx).toBeLessThan(0);
      if (side === "right" || side === "inline-end") expect(dx).toBeGreaterThan(0);
    }

    // Without anchor positioning (older Firefox and Safari) the client script places it, the same.
    await page.addInitScript(() => {
      const supports = CSS.supports.bind(CSS);
      CSS.supports = ((...args: [string, string?]) =>
        /anchor/.test(args[0]) ? false : supports(...(args as [string]))) as typeof CSS.supports;
    });
    await page.goto("/popover");
    await page.addStyleTag({
      content: `[popover][data-side] { position-anchor: none !important;
        position-try-fallbacks: none !important; justify-self: auto !important;
        align-self: auto !important; translate: none !important; }`,
    });
    const scripted = await placements(page);
    for (const side of Object.keys(anchored)) {
      expect(Math.abs(scripted[side]!.dx - anchored[side]!.dx), side).toBeLessThanOrEqual(1);
      expect(Math.abs(scripted[side]!.dy - anchored[side]!.dy), side).toBeLessThanOrEqual(1);
    }
  });

  test("it flips to the other side when there is no room", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.goto("/popover");
    const trigger = page.getByRole("button", { name: "bottom", exact: true });
    await trigger.scrollIntoViewIfNeeded();
    // Put the trigger at the bottom of the viewport: the popup goes above it.
    await trigger.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().bottom - 490));
    await trigger.click();
    const tip = page.getByRole("dialog").filter({ hasText: "On the bottom side" });
    const a = (await trigger.boundingBox())!;
    const b = (await tip.boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(a.y + 1);
  });

  test("right-to-left: inline sides and alignment follow the direction", async ({ page }) => {
    await page.goto("/popover");
    await page.evaluate(() => (document.documentElement.dir = "rtl"));
    const trigger = page.getByRole("button", { name: "inline-end", exact: true });
    await trigger.click();
    const tip = page.getByRole("dialog").filter({ hasText: "On the inline-end side" });
    const a = (await trigger.boundingBox())!;
    const b = (await tip.boundingBox())!;
    // inline-end is on the left in RTL.
    expect(b.x + b.width).toBeLessThanOrEqual(a.x + 1);
  });
});

test.describe("in an island", () => {
  test("bind:open keeps a signal in sync both ways", async ({ page }) => {
    await page.goto("/popover/island");
    const state = page.getByTestId("popover-state");
    const filters = popup(page, "Filters");
    const trigger = page.getByRole("button", { name: "Filters" });
    await expect(state).toHaveText("open: false");
    await page.getByTestId("popover-open").click();
    await expect(filters).toBeVisible();
    await expect(state).toHaveText("open: true");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    // Anchored to its trigger even when a signal opened it.
    const a = (await trigger.boundingBox())!;
    const b = (await filters.boundingBox())!;
    expect(Math.round(b.y - (a.y + a.height))).toBe(4);
    await page.keyboard.press("Escape");
    await expect(filters).toBeHidden();
    await expect(state).toHaveText("open: false");

    await trigger.click();
    await expect(state).toHaveText("open: true");
    await filters.getByRole("button", { name: "Done" }).click();
    await expect(state).toHaveText("open: false");
    await expect(trigger).toBeFocused();
  });
});

test("a server-rendered page with popovers loads only Popover's client script", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
  });
  await page.goto("/popover");
  await page.getByRole("button", { name: "Notifications" }).click();
  await expect(popup(page, "Notifications")).toBeVisible();
  // Popover's script, the placement fallback it shares with Tooltip's, the dismissal model it
  // shares with Menu and Combobox, and Dialog's (the page has a dialog); no island runtime.
  expect(scripts.toSorted()).toEqual([
    expect.stringMatching(/\/dialog\.script-[\w-]+\.js$/),
    expect.stringMatching(/\/hover-[\w-]+\.js$/),
    expect.stringMatching(/\/layer-[\w-]+\.js$/),
    expect.stringMatching(/\/place-[\w-]+\.js$/),
    expect.stringMatching(/\/popover\.script-[\w-]+\.js$/),
  ]);
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes closed and open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/popover");
      expect(await axe(page)).toEqual([]);
      await page.getByRole("button", { name: "Notifications" }).click();
      await expect(popup(page, "Notifications")).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.getByRole("button", { name: "Shipping" }).click();
      expect(await axe(page)).toEqual([]);
      await page.getByRole("button", { name: "Filters" }).click();
      await page.getByRole("button", { name: "Date range…" }).click();
      await expect(popup(page, "Date range")).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus is visible, targets are large enough (2.4.7, 2.5.8)", async ({ page }) => {
    await page.goto("/popover");
    await page.getByRole("button", { name: "Notifications" }).focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    expect(await focusRing(page)).toBe("2px solid");
    await page.keyboard.press("Enter");
    const notifications = popup(page, "Notifications");
    // The link has the browser's own ring; the theme's buttons have theirs.
    await expect(notifications.getByRole("link")).toBeFocused();
    expect(await focusRing(page)).not.toBe("none");
    await page.keyboard.press("Tab");
    await expect(notifications.getByRole("button", { name: "Close" })).toBeFocused();
    expect(await focusRing(page)).toBe("2px solid");
    expect(await smallTargets(popup(page, "Notifications"))).toEqual([]);
  });

  test("popups reflow at 320 CSS pixels and survive text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/popover");
    await page.addStyleTag({ content: TEXT_SPACING });
    for (const name of ["Notifications", "Shipping", "Filters"]) {
      const trigger = page.getByRole("button", { name, exact: true });
      await trigger.click();
      const open = page.locator(":popover-open");
      await expect(open).toBeVisible();
      const box = (await open.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      expect(await clipped(open)).toEqual([]);
      await page.keyboard.press("Escape");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
  });
});
