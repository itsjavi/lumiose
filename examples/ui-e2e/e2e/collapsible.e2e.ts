// Collapsible (TASK-370): a native <details> whose <summary> toggles the panel with no JavaScript,
// the trigger's wiring, the disabled trigger, find-in-page (a fragment link inside the panel opens
// it), the animation hooks of the client script, the sync with a signal in an island, and WCAG 2.2
// AA with the default theme.
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  axe,
  clipped,
  focusRing,
  lastNavLink,
  SCHEMES,
  smallTargets,
  TEXT_SPACING,
} from "./a11y.ts";

/** Puts the whole page right to left. */
const rtl = (page: Page) => page.evaluate(() => (document.documentElement.dir = "rtl"));

const root = (page: Page, id: string) => page.getByTestId(id);
const trigger = (scope: Locator) => scope.locator(":scope > summary");
const isOpen = (scope: Locator) => scope.evaluate((details: HTMLDetailsElement) => details.open);

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the trigger opens and closes the panel; the server HTML holds the state", async ({
    page,
  }) => {
    await page.goto("/collapsible");
    const keys = root(page, "keys");
    await expect(keys.getByText("Store these keys")).toBeHidden();
    await trigger(keys).click();
    await expect(keys.getByText("Store these keys")).toBeVisible();
    await trigger(keys).click();
    expect(await isOpen(keys)).toBe(false);
    expect(await isOpen(root(page, "open"))).toBe(true);
    // A disabled trigger ignores the pointer, before any script, and takes no focus.
    const disabled = root(page, "disabled");
    await trigger(disabled).click({ force: true });
    expect(await isOpen(disabled)).toBe(false);
    await expect(trigger(disabled)).toHaveAttribute("tabindex", "-1");
    await expect(trigger(disabled)).toHaveAttribute("aria-disabled", "true");
  });

  test("a link to content inside a closed panel opens it (find-in-page reveals it too)", async ({
    page,
  }) => {
    await page.goto("/collapsible#deep-link");
    expect(await isOpen(root(page, "keys"))).toBe(true);
    await expect(page.locator("#deep-link")).toBeVisible();
  });
});

test("the trigger controls the panel by id", async ({ page }) => {
  await page.goto("/collapsible");
  const keys = root(page, "keys");
  const panel = keys.locator(":scope > div");
  await expect(trigger(keys)).toHaveAttribute("aria-controls", (await panel.getAttribute("id"))!);
  await expect(trigger(keys)).not.toHaveAttribute("aria-expanded");
});

test("keyboard: Tab reaches the trigger, Enter and Space toggle, disabled is skipped", async ({
  page,
}) => {
  await page.goto("/collapsible");
  await lastNavLink(page).focus();
  await page.keyboard.press("Tab");
  const keys = root(page, "keys");
  await expect(trigger(keys)).toBeFocused();
  await page.keyboard.press("Enter");
  expect(await isOpen(keys)).toBe(true);
  await page.keyboard.press(" ");
  expect(await isOpen(keys)).toBe(false);
  await page.keyboard.press("Tab");
  await expect(trigger(root(page, "open"))).toBeFocused();
  await page.keyboard.press("Tab");
  // The open panel's text has no control: the disabled trigger is skipped, the link comes next.
  await expect(trigger(root(page, "disabled"))).not.toBeFocused();
});

test("the client script measures the panel while it opens and closes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/collapsible");
  const keys = root(page, "keys");
  const panel = keys.locator(":scope > div");
  const height = () =>
    panel.evaluate((el) => el.style.getPropertyValue("--lu-collapsible-panel-height"));
  await trigger(keys).click();
  // The opening transitions from 0 to the content's height, then the height is `auto`.
  expect(await height()).toMatch(/^\d+px$/);
  await expect.poll(height).toBe("auto");
  await expect(panel).not.toHaveAttribute("data-starting-style");
  await trigger(keys).click();
  await expect(panel).toHaveAttribute("data-ending-style");
  await expect(panel).not.toHaveAttribute("data-ending-style");
  // A panel rendered open does not animate.
  await expect(root(page, "open").locator(":scope > div")).not.toHaveAttribute("style");
});

test.describe("in an island", () => {
  test("bind:open keeps a signal in sync both ways", async ({ page }) => {
    await page.goto("/collapsible/island");
    const state = page.getByTestId("open-state");
    const details = page.locator("details").first();
    await expect(state).toHaveText("open: false");
    await page.getByTestId("toggle").click();
    await expect(state).toHaveText("open: true");
    expect(await isOpen(details)).toBe(true);
    await details.locator("summary").click();
    await expect(state).toHaveText("open: false");
    expect(await isOpen(details)).toBe(false);
  });

  test("one rendered open reports no change until it changes (TASK-441 M40)", async ({ page }) => {
    await page.goto("/collapsible/island");
    const reports = page.getByTestId("reports");
    await expect(async () => {
      await page.getByTestId("mount").click({ timeout: 250 });
      await expect(page.getByTestId("mounted")).toBeVisible({ timeout: 250 });
    }).toPass();
    const mounted = page.getByTestId("mounted");
    expect(await isOpen(mounted)).toBe(true);
    // The browser's `toggle` for a `<details>` created open comes a task later.
    await page.waitForTimeout(200);
    await expect(reports).toHaveText("reports: 0");
    await mounted.locator("summary").click();
    await expect(reports).toHaveText("reports: 1");
  });
});

test("a server-rendered page loads Collapsible's client script and no island runtime", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
  });
  await page.goto("/collapsible");
  await trigger(root(page, "keys")).click();
  expect(scripts.some((script) => /\/collapsible\.script-[\w-]+\.js$/.test(script))).toBe(true);
  for (const script of scripts) expect(script).toMatch(/\/(collapsible\.script|panel|animation)-/);
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes closed and open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/collapsible");
      expect(await axe(page)).toEqual([]);
      await trigger(root(page, "keys")).click();
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus is visible and the trigger is a large enough target (2.4.7, 2.5.8)", async ({
    page,
  }) => {
    await page.goto("/collapsible");
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    expect(await focusRing(page)).toBe("2px solid");
    await trigger(root(page, "keys")).click();
    expect(await smallTargets(page.locator("main"))).toEqual([]);
  });

  test("it reflows at 320 CSS pixels and survives text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/collapsible");
    await page.addStyleTag({ content: TEXT_SPACING });
    await trigger(root(page, "keys")).click();
    expect(await clipped(page.locator("main"))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
  });
});

test.describe("right to left (TASK-385)", () => {
  test("the chevron still points down when closed and up when open", async ({ page }) => {
    await page.goto("/collapsible");
    await rtl(page);
    // Drawn from the right and bottom borders, rotated: the same shape in either direction.
    const sides = (id: string) =>
      trigger(root(page, id)).evaluate((summary) => {
        const style = getComputedStyle(summary, "::after");
        return [style.borderRightStyle, style.borderBottomStyle, style.borderLeftStyle];
      });
    expect(await sides("keys")).toEqual(["solid", "solid", "none"]);
    expect(await sides("open")).toEqual(["solid", "solid", "none"]);
  });
});
