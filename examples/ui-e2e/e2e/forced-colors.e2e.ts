// Forced colours (TASK-441 M38): a forced palette (Windows' contrast themes) drops shadows and
// gradients and paints author backgrounds as Canvas. The default theme's state indicators stay
// visible there: a switch's thumb and state, a pressed toggle, the selected tab, progress and
// meter values, a slider's range, a scroll thumb and a highlighted menu item. Engines without the
// emulation skip.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { focusRing, forcedColorsIssues } from "./a11y.ts";
import { chromatic } from "./pixels.ts";

/** Loads `path` with forced colours, or skips where the engine cannot emulate them. */
async function forced(page: Page, path: string) {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.goto(path);
  const active = await page.evaluate(() => matchMedia("(forced-colors: active)").matches);
  test.skip(!active, "no forced-colors emulation in this engine");
}

const css = (locator: Locator, property: string, pseudo: string | null = null) =>
  locator.evaluate(
    (element, [name, part]) => getComputedStyle(element, part).getPropertyValue(name!),
    [property, pseudo] as const,
  );

test.describe("forced colours (TASK-441 M38)", () => {
  test("a switch's thumb shows, and on differs from off", async ({ page }) => {
    await forced(page, "/form");
    const on = page.getByRole("switch", { name: "Newsletter" });
    const off = page.getByRole("switch", { name: "Off for now" });
    for (const each of [on, off]) {
      expect(await css(each, "background-color", "::before")).not.toBe(
        await css(each, "background-color"),
      );
    }
    expect(await css(on, "background-color")).not.toBe(await css(off, "background-color"));
  });

  test("a pressed toggle differs from the others", async ({ page }) => {
    await forced(page, "/toggle");
    const pressed = page.getByRole("button", { name: "Left", exact: true });
    const other = page.getByRole("button", { name: "Center", exact: true });
    await expect(pressed).toHaveAttribute("aria-pressed", "true");
    expect(await css(pressed, "background-color")).not.toBe(await css(other, "background-color"));
  });

  test("only the selected tab has a bar, in both orientations", async ({ page }) => {
    await forced(page, "/tabs");
    const manual = page.getByTestId("manual");
    const selected = manual.getByRole("tab", { name: "Password", exact: true });
    const other = manual.getByRole("tab", { name: "Account", exact: true });
    expect(await css(selected, "border-bottom-width")).toBe("2px");
    expect(await css(selected, "border-bottom-color")).not.toBe(
      await css(other, "border-bottom-color"),
    );
    const vertical = page.getByTestId("vertical");
    const usage = vertical.getByRole("tab", { name: "Usage", exact: true });
    const api = vertical.getByRole("tab", { name: "API", exact: true });
    await expect(usage).toHaveAttribute("aria-selected", "true");
    // Unselected, the edge is Canvas, the page's colour: no bar.
    const canvas = await page.evaluate(() => {
      const probe = document.body.appendChild(document.createElement("div"));
      probe.style.backgroundColor = "Canvas";
      return getComputedStyle(probe).backgroundColor;
    });
    expect(await css(api, "border-right-color")).toBe(canvas);
    expect(await css(usage, "border-right-color")).not.toBe(await css(api, "border-right-color"));
  });

  test("progress and meter values paint", async ({ page }) => {
    await forced(page, "/progress");
    const bars = page.locator(".lu-progress > progress, .lu-meter > meter");
    const count = await bars.count();
    expect(count).toBeGreaterThan(3);
    for (let i = 0; i < count; i++) {
      // The value is drawn in Highlight, a hue; Canvas, the text and the border have none.
      expect(chromatic(await bars.nth(i).screenshot()), `bar ${i}`).toBeGreaterThan(20);
    }
  });

  test("a slider's range, a scroll thumb and a highlighted menu item show", async ({ page }) => {
    await forced(page, "/slider");
    const range = page.locator(".lu-slider > div > div > div").first();
    expect(await css(range, "background-color")).not.toBe(
      await css(page.locator(".lu-slider > div > div").first(), "background-color"),
    );

    await page.goto("/scroll-area");
    const area = page.locator("lu-scroll-area").first();
    expect(await css(area.locator("[data-thumb]").first(), "background-color")).not.toBe(
      await css(area, "background-color"),
    );

    await page.goto("/menu");
    await page.getByRole("button", { name: "Actions" }).focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu", { name: "Actions" });
    const rename = menu.getByRole("menuitem", { name: "Rename" });
    await expect(rename).toHaveAttribute("data-highlighted", "");
    expect(await css(rename, "background-color")).not.toBe(await css(menu, "background-color"));
  });

  test("every themed control keeps a boundary, and focus a visible ring (TASK-462)", async ({
    page,
  }) => {
    test.slow();
    await forced(page, "/");
    const paths = await page
      .locator("main a[href^='/']")
      .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")!))]);
    const found: string[] = [];
    for (const path of paths) {
      await page.goto(path);
      for (const each of await forcedColorsIssues(page.locator("main"))) {
        found.push(`${path}: ${each}`);
      }
      // The first tab stop in main, after the layout's link: its ring is drawn in a system
      // colour, against Canvas. Inputs whose component draws the ring around them (a slider's
      // thumb, a number field's group, OTP slots) have their own suites' checks.
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      const own = await page.evaluate(
        () =>
          document.activeElement?.closest("main")?.matches("*") === true &&
          document.activeElement.matches("button, a[href], [role=tab], summary"),
      );
      const ring = await focusRing(page);
      if (own && (ring === "none" || ring.includes("contrast"))) {
        found.push(`${path}: focus ring ${ring}`);
      }
    }
    expect(found).toEqual([]);
  });
});
