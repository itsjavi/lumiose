// Button (TASK-364): a native `<button>` that submits only when asked to, natively disabled out of
// the tab order, or disabled with `focusableWhenDisabled`: focusable as `aria-disabled="true"`,
// its clicks, Enter and Space cancelled by its script. With the sync with signals in an island and
// WCAG 2.2 AA with the default theme (doc-9 sections 1 and 17).
import { expect, test, type Page } from "@playwright/test";
import { axe, focusRing, lastNavLink, SCHEMES, smallTargets } from "./a11y.ts";

/** Lumiose's console warnings (LUM codes), such as a hydration that fell back to rendering. */
const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/**
 * Waits for /button/island to hydrate: Save answers a click. The server HTML already shows the
 * same state, so nothing else tells.
 */
async function hydrated(page: Page) {
  await expect(async () => {
    await button(page, "Save").click({ timeout: 250 });
    await expect(page.getByTestId("button-state")).toHaveText("saves: 1, saving", {
      timeout: 250,
    });
  }).toPass();
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("a Button submits only with type submit; aria-disabled needs the script", async ({
    page,
  }) => {
    await page.goto("/button");
    await button(page, "Preview").click();
    await expect(page).toHaveURL(/\/button$/);
    await button(page, "Save").click();
    await expect(page).toHaveURL(/\/button\?intent=save$/);
    // Documented: without the script, an aria-disabled button still acts.
    await button(page, "Sending…").click({ force: true });
    await expect(page).toHaveURL(/\/button\?intent=send$/);
  });
});

test.describe("Button", () => {
  test("disabled skips focus; focusableWhenDisabled keeps it but cancels clicks and keys", async ({
    page,
  }) => {
    await page.goto("/button");
    await expect(button(page, "Publish")).toBeDisabled();
    const sending = button(page, "Sending…");
    await expect(sending).toHaveAttribute("aria-disabled", "true");
    await expect(sending).not.toHaveAttribute("disabled");
    await lastNavLink(page).focus();
    for (const name of ["Preview", "Save", "Sending…"]) {
      await page.keyboard.press("Tab");
      await expect(button(page, name)).toBeFocused();
    }
    await page.keyboard.press("Enter");
    await page.keyboard.press(" ");
    // Playwright waits for aria-disabled elements to be enabled: force the click.
    await sending.click({ force: true });
    await expect(page).toHaveURL(/\/button$/);
  });

  test("in an island: disabled while saving, focus stays, and further presses do nothing", async ({
    page,
  }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/button/island");
    await hydrated(page);
    const saving = button(page, "Saving…");
    await expect(saving).toHaveAttribute("aria-disabled", "true");
    await expect(saving).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press(" ");
    await saving.click({ force: true });
    await expect(page.getByTestId("button-state")).toHaveText("saves: 1, saving");
    await page.getByTestId("finish").click();
    await expect(button(page, "Save")).not.toHaveAttribute("aria-disabled");
    await button(page, "Save").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("button-state")).toHaveText("saves: 2, saving");
    expect(warnings).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes on the page and the island (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/button");
      expect(await axe(page)).toEqual([]);
      await page.goto("/button/island");
      await hydrated(page);
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus is visible, on an aria-disabled button too (2.4.7), and targets are 24px (2.5.8)", async ({
    page,
  }) => {
    await page.goto("/button");
    await lastNavLink(page).focus();
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Tab");
      expect(await focusRing(page)).toBe("2px solid");
    }
    expect(await smallTargets(page.locator("main"))).toEqual([]);
  });

  test("a server-rendered page loads Button's script only", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await page.goto("/button");
    await page.waitForLoadState("networkidle");
    expect(scripts).toEqual([expect.stringMatching(/\/button\.script-[\w-]+\.js$/)]);
    await expect(page.locator("script[data-l-islands]")).toHaveCount(0);
  });
});
