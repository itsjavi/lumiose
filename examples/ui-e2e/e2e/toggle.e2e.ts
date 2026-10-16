// Toggle and Toggle Group (TASK-369): `<button aria-pressed>` toggles; a group presses one at a
// time (pressing it again releases it) or several, has one tab stop that the arrows (following
// the orientation and the direction), Home and End move, loops unless told not to, and skips
// disabled toggles. With the sync with signals in an island and WCAG 2.2 AA with the default theme
// (doc-9 sections 1, 13 and 17).
import { expect, test, type Page } from "@playwright/test";
import {
  axe,
  clipped,
  focusRing,
  lastNavLink,
  SCHEMES,
  smallTargets,
  TEXT_SPACING,
} from "./a11y.ts";

/** Lumiose's console warnings (LUM codes), such as a hydration that fell back to rendering. */
const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

const toggle = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/** Waits for /toggle/island to hydrate: "Set the signals" answers. */
async function hydrated(page: Page) {
  await expect(async () => {
    await page.getByTestId("set-signals").click({ timeout: 250 });
    await expect(page.getByTestId("align-state")).toHaveText("align: right", { timeout: 250 });
  }).toPass();
}

test.describe("Toggle Group on a server page", () => {
  test("presses one toggle at a time, and releases it on a second press", async ({ page }) => {
    await page.goto("/toggle");
    await expect(toggle(page, "Left")).toHaveAttribute("aria-pressed", "true");
    await toggle(page, "Center").click();
    await expect(toggle(page, "Center")).toHaveAttribute("aria-pressed", "true");
    await expect(toggle(page, "Left")).toHaveAttribute("aria-pressed", "false");
    await toggle(page, "Center").click();
    await expect(toggle(page, "Center")).toHaveAttribute("aria-pressed", "false");
    // Several at a time.
    await toggle(page, "Italic").click();
    await expect(toggle(page, "Bold")).toHaveAttribute("aria-pressed", "true");
    await expect(toggle(page, "Italic")).toHaveAttribute("aria-pressed", "true");
  });

  test("keyboard: one tab stop, arrows, Home and End move focus and loop; Space and Enter press", async ({
    page,
  }) => {
    await page.goto("/toggle");
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    await expect(toggle(page, "Left")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(toggle(page, "Center")).toBeFocused();
    await expect(toggle(page, "Center")).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press(" ");
    await expect(toggle(page, "Center")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("End");
    await expect(toggle(page, "Right")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(toggle(page, "Left")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(toggle(page, "Right")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(toggle(page, "Right")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Home");
    await expect(toggle(page, "Left")).toBeFocused();
    // Tab leaves the group, and comes back to the last focused toggle.
    await page.keyboard.press("Tab");
    await expect(toggle(page, "Bold")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(toggle(page, "Left")).toBeFocused();
  });

  test("vertical without loop: up and down, disabled skipped, the ends stop", async ({ page }) => {
    await page.goto("/toggle");
    await toggle(page, "List").focus();
    await page.keyboard.press("ArrowRight");
    await expect(toggle(page, "List")).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(toggle(page, "List")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(toggle(page, "Grid")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(toggle(page, "Grid")).toBeFocused();
    await expect(toggle(page, "Board")).toBeDisabled();
  });

  test("the tab stop moves on when its toggle goes or is disabled (TASK-437 M11)", async ({
    page,
  }) => {
    await page.goto("/toggle");
    await page.waitForFunction(() => customElements.get("lu-toggle-group"));
    const bold = toggle(page, "Bold");
    // Left, the pressed toggle, is the stop: it goes.
    await bold.focus();
    await toggle(page, "Left").evaluate((item) => item.remove());
    await page.keyboard.press("Shift+Tab");
    await expect(toggle(page, "Center")).toBeFocused();
    // Center, the stop now, is disabled.
    await bold.focus();
    await toggle(page, "Center").evaluate((item) => ((item as HTMLButtonElement).disabled = true));
    await page.keyboard.press("Shift+Tab");
    await expect(toggle(page, "Right")).toBeFocused();
  });

  test("a group rendered disabled gets a tab stop once enabled (TASK-437 M11)", async ({
    page,
  }) => {
    await page.goto("/toggle");
    await page.waitForFunction(() => customElements.get("lu-toggle-group"));
    const sizes = page.getByRole("group", { name: "Size" }).getByRole("button");
    // As the server renders a disabled group: no toggle is a tab stop.
    await sizes.evaluateAll((items: HTMLButtonElement[]) => {
      for (const item of items) {
        item.disabled = true;
        item.tabIndex = -1;
      }
    });
    await sizes.evaluateAll((items: HTMLButtonElement[]) => {
      for (const item of items) item.disabled = false;
    });
    await toggle(page, "List").focus();
    await page.keyboard.press("Tab");
    await expect(toggle(page, "Small")).toBeFocused();
  });

  test("right to left: the left arrow moves forward", async ({ page }) => {
    await page.goto("/toggle");
    await toggle(page, "Small").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(toggle(page, "Medium")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(toggle(page, "Small")).toBeFocused();
  });
});

test.describe("in an island", () => {
  test("bind:pressed and bind:value keep signals in sync both ways", async ({ page }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/toggle/island");
    await hydrated(page);
    await expect(page.getByTestId("pin-state")).toHaveText("pinned: yes");
    await expect(toggle(page, "Pin")).toHaveAttribute("aria-pressed", "true");
    await expect(toggle(page, "Right")).toHaveAttribute("aria-pressed", "true");
    await expect(toggle(page, "Left")).toHaveAttribute("aria-pressed", "false");
    await toggle(page, "Pin").click();
    await expect(page.getByTestId("pin-state")).toHaveText("pinned: no");
    await toggle(page, "Center").click();
    await expect(page.getByTestId("align-state")).toHaveText("align: center");
    await toggle(page, "Center").click();
    await expect(page.getByTestId("align-state")).toHaveText("align: none");
    expect(warnings).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes on the page and the island (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/toggle");
      expect(await axe(page)).toEqual([]);
      await page.goto("/toggle/island");
      await hydrated(page);
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus is visible (2.4.7), targets are 24px (2.5.8), pressed is not colour alone (1.4.1)", async ({
    page,
  }) => {
    await page.goto("/toggle");
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    expect(await focusRing(page)).toBe("2px solid");
    expect(await smallTargets(page.locator("main"))).toEqual([]);
    const shadow = (name: string) =>
      toggle(page, name).evaluate((el) => getComputedStyle(el).boxShadow);
    expect(await shadow("Left")).toContain("inset");
    expect(await shadow("Center")).toBe("none");
  });

  test("the page reflows at 320 CSS pixels with text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/toggle");
    await page.addStyleTag({ content: TEXT_SPACING });
    const main = page.locator("main");
    const box = (await main.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(await clipped(main)).toEqual([]);
  });

  test("a server-rendered page loads ToggleGroup's script only", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await page.goto("/toggle");
    await page.waitForLoadState("networkidle");
    expect(scripts).toEqual([expect.stringMatching(/\/toggle-group\.script-[\w-]+\.js$/)]);
    await expect(page.locator("script[data-l-islands]")).toHaveCount(0);
  });
});
