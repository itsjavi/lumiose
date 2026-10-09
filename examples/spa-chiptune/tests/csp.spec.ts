// `lumen({ csp: "strict" })` (TASK-138): the built SPA's pages carry a hash policy (they are static
// shells) and nothing the app loads violates it, playing audio included; in dev, Lumen's inline
// scripts and styles carry a nonce (no policy is sent: Vite injects its own styles).
import { expect, test } from "@playwright/test";

test("the app runs under its strict Content Security Policy", async ({ page }, info) => {
  await page.addInitScript(() => {
    const seen: string[] = ((window as unknown as { cspViolations: string[] }).cspViolations = []);
    document.addEventListener("securitypolicyviolation", (event) => {
      seen.push(
        `${event.violatedDirective} ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}`,
      );
    });
  });
  const violations = () =>
    page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations);
  for (const path of ["/", "/songs", "/instruments", "/settings"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    if (info.project.name === "preview") {
      const policy = await page
        .locator('meta[http-equiv="Content-Security-Policy"]')
        .getAttribute("content");
      expect(policy, path).toMatch(/^script-src 'self'.*; style-src 'self'/);
    }
    expect(await violations(), path).toEqual([]);
  }
  // Playing loads the AudioWorklet module.
  await page.goto("/");
  await expect(page.locator(".row").first()).toBeVisible();
  await page.keyboard.press("Space");
  await page.waitForTimeout(500);
  expect(await violations()).toEqual([]);
});
