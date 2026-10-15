// Progress and Meter (TASK-373): native `<progress>` and `<meter>`, labelled, with the value as text
// and as `aria-valuetext`, an indeterminate progress, the sync with a signal in an island, and
// WCAG 2.2 AA with the default theme (doc-9 sections 1 and 17).
import { expect, test, type Page } from "@playwright/test";
import { axe, SCHEMES } from "./a11y.ts";

/** Lumiose's console warnings (LUM codes), such as a hydration that fell back to rendering. */
const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

/** Waits for /progress/island to hydrate: "Advance" answers. */
async function hydrated(page: Page) {
  const bar = page.getByRole("progressbar", { name: "Task" });
  await expect(async () => {
    await page.getByTestId("advance").click({ timeout: 250 });
    await expect(bar).toHaveAttribute("aria-valuetext", "50%", { timeout: 250 });
  }).toPass();
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("progress bars and meters are labelled, with their values and text", async ({ page }) => {
    await page.goto("/progress");
    const uploading = page.getByRole("progressbar", { name: "Uploading" });
    await expect(uploading).toHaveAttribute("value", "30");
    await expect(uploading).toHaveAttribute("aria-valuetext", "30%");
    await expect(page.getByText("30%", { exact: true })).toBeVisible();
    const downloading = page.getByRole("progressbar", { name: "Downloading" });
    await expect(downloading).toHaveAttribute("aria-valuetext", "150 MB of 300 MB");
    expect(await downloading.evaluate((el: HTMLProgressElement) => el.position)).toBe(0.25);
    const loading = page.getByRole("progressbar", { name: "Loading", exact: true });
    expect(await loading.evaluate((el) => el.matches(":indeterminate"))).toBe(true);
    await expect(loading).not.toHaveAttribute("aria-valuetext");
    const storage = page.getByRole("meter", { name: "Storage used" });
    await expect(storage).toHaveAttribute("aria-valuetext", "72%");
    await expect(page.getByRole("meter", { name: "Rating" })).toHaveAttribute(
      "aria-valuetext",
      "4 of 5 stars",
    );
    await expect(page.getByText("4 / 5")).toBeVisible();
  });
});

test.describe("in an island", () => {
  test("the value follows a signal; null makes the progress indeterminate", async ({ page }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/progress/island");
    await hydrated(page);
    const bar = page.getByRole("progressbar", { name: "Task" });
    const meter = page.getByRole("meter", { name: "Done" });
    await expect(meter).toHaveAttribute("aria-valuetext", "50%");
    await page.getByTestId("restart").click();
    expect(await bar.evaluate((el) => el.matches(":indeterminate"))).toBe(true);
    await expect(bar).not.toHaveAttribute("aria-valuetext");
    await expect(meter).toHaveAttribute("aria-valuetext", "0%");
    await page.getByTestId("advance").click();
    await expect(bar).toHaveAttribute("aria-valuetext", "25%");
    await expect(bar).toHaveAttribute("value", "25");
    expect(warnings).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes on the page and the island (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/progress");
      expect(await axe(page)).toEqual([]);
      await page.goto("/progress/island");
      await hydrated(page);
      expect(await axe(page)).toEqual([]);
    });
  }

  test("the indeterminate bar stands still when motion is reduced (2.3.3)", async ({ page }) => {
    const loading = page.getByRole("progressbar", { name: "Loading", exact: true });
    const animation = () => loading.evaluate((el) => getComputedStyle(el).animationName);
    // The fixture reduces motion everywhere; this test lets it move first.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/progress");
    expect(await animation()).toBe("lu-progress-slide");
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await animation()).toBe("none");
  });

  test("a server-rendered page loads no script", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await page.goto("/progress");
    await page.waitForLoadState("networkidle");
    expect(scripts).toEqual([]);
  });
});
