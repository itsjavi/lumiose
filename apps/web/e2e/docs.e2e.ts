// The docs layout (TASK-608): words beside the code they describe, from the Markdown's structure,
// and a step bar on a page of numbered steps.
import { expect, test, type Page } from "@playwright/test";

const box = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!;

test("a section with words and code is two columns on desktop and stacks on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/docs/getting-started");
  const heading = "#\\31 -install";
  const code = `.pair:has(${heading}) figure.code`;
  let [words, aside] = [await box(page, heading), await box(page, code)];
  expect(aside.x).toBeGreaterThan(words.x + words.width - 1);
  expect(Math.abs(aside.y - words.y)).toBeLessThan(80);
  // The words after the code go below the heading, beside the code.
  const after = await box(page, `.pair:has(${heading}) .tail`);
  expect(after.x).toBe(words.x);
  expect(after.x + after.width).toBeLessThan(aside.x);

  // A section without code is one column of a readable measure.
  const editor = await box(page, ".sec:has(#editor) .words >> nth=0");
  expect(editor.width).toBeLessThan(760);
  await expect(page.locator(".sec:has(#editor) .pair")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 800 });
  [words, aside] = [await box(page, heading), await box(page, code)];
  expect(aside.y).toBeGreaterThan(words.y + words.height - 1);
  expect(aside.x).toBeLessThan(words.x + 40);
  expect((await box(page, `.pair:has(${heading}) .tail`)).y).toBeGreaterThan(aside.y);
});

test("a page of numbered steps gets the step bar, built from its headings", async ({ page }) => {
  await page.goto("/docs/getting-started");
  const steps = page.getByRole("navigation", { name: "Steps" });
  await expect(steps.getByRole("link")).toHaveText([
    /^1 Install$/,
    /^2 Configure TypeScript$/,
    /^3 Configure Vite$/,
    /^4 Write a component$/,
    /^5 Mount it$/,
    /^6 Check the project$/,
  ]);
  // The heading shows its number as a label; the anchor keeps the number.
  await expect(page.locator("#\\34 -write-a-component")).toHaveText(/Step 4\s*Write a component/);
  await steps.getByRole("link", { name: "4 Write a component" }).click();
  await expect(page).toHaveURL(/#4-write-a-component$/);
  // The bar stays in view, the heading stops below it, and the bar marks the step being read.
  const heading = page.locator("#\\34 -write-a-component");
  await expect(heading).toBeInViewport();
  await expect(steps).toBeInViewport();
  const [bar, target] = [(await steps.boundingBox())!, (await heading.boundingBox())!];
  expect(target.y).toBeGreaterThanOrEqual(bar.y + bar.height);
  await expect(steps.getByRole("link", { name: "4 Write a component" })).toHaveAttribute(
    "aria-current",
    "step",
  );

  await page.goto("/docs/concepts/signals");
  await expect(page.getByRole("navigation", { name: "Steps" })).toHaveCount(0);
});

test("the headings of a page fold into 'On this page', and their anchors work", async ({
  page,
}) => {
  await page.goto("/docs/concepts/signals");
  const toc = page.getByRole("navigation", { name: "On this page" });
  await toc.locator("summary").click();
  await toc.getByRole("link", { name: "Common mistakes" }).click();
  await expect(page).toHaveURL(/#common-mistakes$/);
  await expect(page.locator("#common-mistakes")).toBeInViewport();
  await page.locator("#common-mistakes .anchor").focus();
  await expect(page.locator("#common-mistakes .anchor")).toBeVisible();
});

test("docs pages do not scroll sideways at 390, 900 and 1280 px, in both themes", async ({
  page,
}) => {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of [390, 900, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of [
        "/docs/getting-started",
        "/docs/concepts/signals",
        "/docs/reference/cli",
      ]) {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path} at ${width} px (${scheme})`).toBeLessThanOrEqual(0);
      }
    }
  }
});
