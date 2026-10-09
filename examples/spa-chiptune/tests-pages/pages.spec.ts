import { expect, test } from "@playwright/test";

// GitHub Pages sends no COOP/COEP. The Pages build registers a service worker that adds them and
// reloads once, so the audio engine runs in SharedArrayBuffer mode; without a service worker the
// app still works, in postMessage mode.

const isolated = () => globalThis.crossOriginIsolated;

test("a deep link becomes cross-origin isolated after one reload and plays in SharedArrayBuffer mode", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("settings");
  await expect.poll(() => page.evaluate(isolated), { timeout: 15_000 }).toBe(true);
  await expect(page).toHaveURL(/\/lumen\/examples\/spa-chiptune\/settings\/?$/);
  await page.getByRole("button", { name: "Play song" }).click();
  await expect(page.locator(".engine")).toHaveText("AUDIO ON");
  await expect(page.getByText("SharedArrayBuffer (cross-origin isolated)")).toBeVisible();
  if (process.env.CHIPTUNE_SHOTS)
    await page.screenshot({ path: `${process.env.CHIPTUNE_SHOTS}/task-172-settings-pages.png` });
  // The tracker's song URL is not a file on Pages (the root 404.html routes it): reloading that
  // deep link keeps the song and the isolation.
  await page.goto("./");
  await expect(page).toHaveURL(/\/songs\/\w+$/);
  const songUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(songUrl);
  await expect(page.locator(".row").first()).toBeVisible();
  expect(await page.evaluate(isolated)).toBe(true);
  expect(errors).toEqual([]);
});

test.describe("without a service worker", () => {
  test.use({ serviceWorkers: "block" });

  test("the app falls back to postMessage telemetry", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("settings");
    await page.waitForTimeout(1000);
    expect(await page.evaluate(isolated)).toBe(false);
    await page.getByRole("button", { name: "Play song" }).click();
    await expect(page.locator(".engine")).toHaveText("AUDIO ON");
    await expect(page.getByText("postMessage, ~60 Hz")).toBeVisible();
    expect(errors).toEqual([]);
  });
});
