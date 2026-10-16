// WCAG 1.4.10 Reflow at more sizes than each suite's 320 by 640 (TASK-462): every fixture the home
// page lists, at 320 by 256 (a phone in landscape, 400% zoom of a short window) and 1280 by 256
// (400% zoom of 1280 by 1024, where a row of controls must not need a second scroll direction).
// The page never scrolls sideways, and no content is cut off.
import { expect, test } from "@playwright/test";
import { clipped } from "./a11y.ts";

const SIZES = [
  { width: 320, height: 256 },
  { width: 1280, height: 256 },
];

/** Overflow the fixtures make on purpose, visible and not cut off. */
const EXPECTED = new Set([
  // A button shown below the open popup, where a press can land on it, without moving the layout.
  '/popover: section "Popover with a title and actio"',
  '/popover: div "Popover with a title and actio"',
  // The placement triggers keep 8rem on either side for their side popups; at 320 wide Firefox
  // counts that padding as overflow. The triggers stay in view.
  '/popover: div "topOn the top siderightOn the "',
  // A center-aligned slider's thumbs overhang its track (slider.e2e.ts).
  '/slider: div ""',
]);

for (const size of SIZES) {
  test(`every fixture reflows at ${size.width} by ${size.height} (1.4.10)`, async ({ page }) => {
    test.slow();
    await page.goto("/");
    const paths = await page
      .locator("main a[href^='/']")
      .evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")!))]);
    expect(paths.length).toBeGreaterThan(30);
    await page.setViewportSize(size);
    const found: string[] = [];
    for (const path of paths) {
      await page.goto(path);
      const wide = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (wide > 1) found.push(`${path}: scrolls ${wide}px sideways`);
      for (const each of await clipped(page.locator("main"))) found.push(`${path}: ${each}`);
    }
    expect(found.filter((each) => !EXPECTED.has(each))).toEqual([]);
  });
}
