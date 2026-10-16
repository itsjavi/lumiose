// Toast (TASK-371): server-rendered toasts (a form action's result) with and without JavaScript,
// and toasts from an island's manager: live regions and the VoiceOver mutation, timers that pause
// on hover and focus, the limit, closing by button, Escape and swipe, focus when a toast goes, F6,
// promise toasts, the top layer over a modal dialog, toasts that do not dismiss an open popover,
// and WCAG 2.2 AA with the default theme.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dragPath } from "./browsers.ts";
import { axe, clipped, SCHEMES, smallTargets, TEXT_SPACING } from "./a11y.ts";

const viewport = (page: Page) => page.getByRole("region", { name: "Notifications (F6)" });
/** A toast by its title (a text match: role queries skip the hidden ones past the limit). */
const toast = (page: Page, title: string) =>
  viewport(page).locator(":scope > *", { has: page.locator("h2", { hasText: title }) });
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/** Drags from the middle of `target` by `dx`, `dy` with the mouse. */
async function drag(page: Page, target: Locator, toX: number, toY: number) {
  const box = (await target.boundingBox())!;
  const { x, y, dx, dy } = dragPath(page, box, toX, toY, { x: 1 / 3, y: 0.5 });
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("server-rendered toasts show in a named region, as live regions", async ({ page }) => {
    await page.goto("/toast");
    await expect(viewport(page)).toBeVisible();
    const saved = toast(page, "Project saved");
    await expect(saved).toBeVisible();
    await expect(saved).toHaveAttribute("role", "status");
    await expect(saved).toHaveAttribute("aria-atomic", "true");
    await expect(saved.getByText("Your changes are live.")).toBeVisible();
    await expect(toast(page, "Link copied")).toBeVisible();
  });
});

test.describe("server-rendered toasts", () => {
  test("they time out, stay with timeout 0, close by button, and enter the top layer", async ({
    page,
  }) => {
    await page.goto("/toast");
    await expect(viewport(page)).toHaveJSProperty("popover", "manual");
    expect(await viewport(page).evaluate((el) => el.matches(":popover-open"))).toBe(true);
    await expect(toast(page, "Link copied")).toHaveCount(0, { timeout: 4000 });
    const saved = toast(page, "Project saved");
    await expect(saved).toBeVisible();
    // VoiceOver's mutation: an invisible word joiner in its title, 250ms after the toast appears.
    const title = saved.locator("h2");
    await expect
      .poll(() => title.evaluate((el) => el.textContent!.endsWith(String.fromCodePoint(0x2060))))
      .toBe(true);
    await saved.getByRole("button", { name: "Close" }).click();
    await expect(saved).toHaveCount(0);
  });
});

test.describe("toasts from an island's manager", () => {
  test("add, limit, time out; the hidden ones wait their turn", async ({ page }) => {
    await page.goto("/toast/island");
    // Four at once: one click at a time, the first could time out before the fourth.
    await button(page, "Add a toast").evaluate((add: HTMLButtonElement) => {
      for (let i = 0; i < 4; i++) add.click();
    });
    await expect(page.getByTestId("count")).toHaveText("toasts: 4");
    const toasts = viewport(page).locator(":scope > *");
    await expect(toasts).toHaveCount(4);
    // Limit 3: the oldest waits, hidden.
    await expect(toast(page, "Saved 1")).toBeHidden();
    await expect(toast(page, "Saved 1")).toHaveAttribute("data-limited");
    await expect(toast(page, "Saved 4")).toBeVisible();
    await page.mouse.move(0, 0);
    await expect(toast(page, "Saved 4")).toHaveCount(0, { timeout: 4000 });
    await expect(toast(page, "Saved 1")).toBeVisible();
    await expect(page.getByTestId("count")).toHaveText("toasts: 0", { timeout: 4000 });
  });

  test("timers pause while the pointer is over the toasts and while focus is in them", async ({
    page,
  }) => {
    await page.goto("/toast/island");
    await button(page, "Add a toast").click();
    const saved = toast(page, "Saved 1");
    await saved.hover();
    await page.waitForTimeout(2200);
    await expect(saved).toBeVisible();
    await saved.getByRole("button", { name: "Close" }).focus();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(2200);
    await expect(saved).toBeVisible();
    await button(page, "Add a toast").focus();
    await expect(saved).toHaveCount(0, { timeout: 4000 });
  });

  test("F6 focuses the region; Escape and Shift+Tab return focus", async ({ page }) => {
    await page.goto("/toast/island");
    await button(page, "Add an error").click();
    await expect(button(page, "Add an error")).toBeFocused();
    await page.keyboard.press("F6");
    await expect(viewport(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(button(page, "Add an error")).toBeFocused();
    await page.keyboard.press("F6");
    await page.keyboard.press("Shift+Tab");
    await expect(button(page, "Add an error")).toBeFocused();
  });

  test("Escape closes the focused toast; focus moves to the next, then back", async ({ page }) => {
    await page.goto("/toast/island");
    await button(page, "Add an error").click();
    await button(page, "Upload").click();
    await expect(toast(page, "Uploaded")).toBeVisible();
    await page.keyboard.press("F6");
    await page.keyboard.press("Tab");
    await expect(toast(page, "Uploaded").getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(toast(page, "Uploaded")).toHaveCount(0);
    await expect(
      toast(page, "Payment failed").getByRole("button", { name: "Retry" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(toast(page, "Payment failed")).toHaveCount(0);
    await expect(button(page, "Upload")).toBeFocused();
  });

  test("a high-priority toast is an alert; a promise toast turns from loading to success", async ({
    page,
  }) => {
    await page.goto("/toast/island");
    await button(page, "Add an error").click();
    const error = toast(page, "Payment failed");
    await expect(error).toHaveAttribute("role", "alert");
    await expect(error).toHaveAttribute("data-type", "error");
    await expect(error.getByRole("button", { name: "Retry" })).toBeVisible();
    await button(page, "Upload").click();
    await expect(toast(page, "Uploading…")).toHaveAttribute("data-type", "loading");
    await expect(toast(page, "Uploaded")).toHaveAttribute("data-type", "success");
  });

  test("a swipe past 40px closes a toast; a short one or another axis springs back", async ({
    page,
  }) => {
    await page.goto("/toast/island");
    await button(page, "Add an error").click();
    const error = toast(page, "Payment failed");
    await drag(page, error.getByText("Check your card."), 20, 0);
    await expect(error).toBeVisible();
    await expect(error).not.toHaveAttribute("data-swiping");
    expect(
      await error.evaluate((el) => el.style.getPropertyValue("--toast-swipe-movement-x")),
    ).toBe("");
    // Up is not one of its directions; a drag that starts on a button is not a swipe.
    await drag(page, error.getByText("Check your card."), 0, -80);
    await expect(error).toBeVisible();
    await drag(page, error.getByRole("button", { name: "Retry" }), 80, 0);
    await expect(error).toBeVisible();
    await drag(page, error.getByText("Check your card."), 80, 0);
    await expect(error).toHaveCount(0);
  });

  test("over a modal dialog, toasts move into it and stay usable", async ({ page }) => {
    await page.goto("/toast/island");
    await button(page, "Open a dialog").click();
    await button(page, "Add from the dialog").click();
    const added = toast(page, "From the dialog");
    await expect(added).toBeVisible();
    expect(await viewport(page).evaluate((el) => el.parentElement?.localName)).toBe("dialog");
    await added.getByRole("button", { name: "Close" }).click();
    await expect(added).toHaveCount(0);
    await expect(button(page, "Add from the dialog")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();
    expect(await viewport(page).evaluate((el) => el.parentElement?.localName)).not.toBe("dialog");
  });

  test("a press in a toast does not dismiss an open popover", async ({ page }) => {
    await page.goto("/toast/island");
    await button(page, "Add an error").click();
    await button(page, "Filters").click();
    const filters = page.getByRole("dialog", { name: "Filters" });
    await expect(filters).toBeVisible();
    await toast(page, "Payment failed").getByText("Check your card.").click();
    await expect(filters).toBeVisible();
  });
});

test("a server-rendered page loads Toast's client script and no island runtime", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
  });
  await page.goto("/toast");
  await expect(toast(page, "Project saved")).toBeVisible();
  expect(scripts.some((script) => /\/toast\.script-[\w-]+\.js$/.test(script))).toBe(true);
  for (const script of scripts) expect(script).toMatch(/\/(toast\.script|animation)-/);
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes with toasts open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/toast");
      expect(await axe(page)).toEqual([]);
      await page.goto("/toast/island");
      await button(page, "Add an error").click();
      await button(page, "Upload").click();
      await expect(toast(page, "Uploaded")).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });
  }

  test("targets are large enough; toasts reflow at 320 px with text spacing", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/toast/island");
    await page.addStyleTag({ content: TEXT_SPACING });
    await button(page, "Add an error").click();
    const error = toast(page, "Payment failed");
    await expect(error).toBeVisible();
    expect(await smallTargets(viewport(page))).toEqual([]);
    expect(await clipped(viewport(page))).toEqual([]);
    const box = (await error.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  });
});
