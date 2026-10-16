// Separator (TASK-374): a native `<hr>`, a separator for assistive technology, horizontal or
// vertical (`aria-orientation`), with no script; a vertical one fills the height of a row that
// centres its items, and WCAG 2.2 AA with the default theme (doc-9 section 17).
import { expect, test } from "@playwright/test";
import { axe, clipped, SCHEMES, TEXT_SPACING } from "./a11y.ts";

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("separators are announced, with their orientation", async ({ page }) => {
    await page.goto("/separator");
    const separators = page.locator("main").getByRole("separator");
    await expect(separators).toHaveCount(3);
    await expect(page.getByTestId("horizontal")).toHaveAttribute("data-orientation", "horizontal");
    await expect(page.getByTestId("horizontal")).not.toHaveAttribute("aria-orientation");
    await expect(page.getByTestId("vertical")).toHaveAttribute("aria-orientation", "vertical");
  });

  test("a vertical separator is as tall as its row, with no margins pushing the items", async ({
    page,
  }) => {
    await page.goto("/separator");
    for (const [rowId, id] of [
      ["row", "vertical"],
      ["unstyled-row", "unstyled"],
    ] as const) {
      const row = (await page.getByTestId(rowId).boundingBox())!;
      const separator = page.getByTestId(id);
      const box = (await separator.boundingBox())!;
      expect(box.height, id).toBeCloseTo(row.height, 0);
      expect(await separator.evaluate((el) => getComputedStyle(el).marginInlineStart), id).toBe(
        "0px",
      );
    }
    // The themed one is a 1px line; a horizontal one spans its container.
    expect((await page.getByTestId("vertical").boundingBox())!.width).toBe(1);
    const section = (await page.locator("section").first().boundingBox())!;
    expect((await page.getByTestId("horizontal").boundingBox())!.width).toBeCloseTo(
      section.width,
      0,
    );
  });

  test("it takes no focus", async ({ page }) => {
    await page.goto("/separator");
    await page.getByRole("link", { name: "Blog" }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Privacy" })).toBeFocused();
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/separator");
      expect(await axe(page)).toEqual([]);
    });
  }

  test("the page reflows at 320 CSS pixels with text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/separator");
    await page.addStyleTag({ content: TEXT_SPACING });
    const main = page.locator("main");
    const box = (await main.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(await clipped(main)).toEqual([]);
  });

  test("a server-rendered page loads no script", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await page.goto("/separator");
    await page.waitForLoadState("networkidle");
    expect(scripts).toEqual([]);
  });
});
