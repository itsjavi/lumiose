// Under `lumiose dev`, the showcase's links reach the separately built apps (TASK-239): each mount
// serves its build, or a dev page naming the command that builds it, never a bare 404.
import { expect, test, type Page } from "@playwright/test";

/** The app itself, or the dev page that says how to build it. */
async function expectAppOrBuildHint(page: Page, title: RegExp, name: string) {
  const hint = page.getByRole("heading", { name: `${name} is not built` });
  await expect(page).toHaveTitle(new RegExp(`${title.source}|Not built: ${name}`));
  if (await hint.isVisible()) await expect(page.getByText("pnpm build:site")).toBeVisible();
}

function card(page: Page, title: string) {
  return page.locator(".item", { has: page.getByRole("heading", { name: title }) });
}

test("a showcase title link opens the app or its build hint", async ({ page }) => {
  await page.goto("/showcase");
  await card(page, "Dotmatrix").getByRole("link", { name: "Dotmatrix" }).click();
  await page.waitForURL("**/showcase/dotmatrix/");
  await expectAppOrBuildHint(page, /Dotmatrix/, "spa-dotmatrix");
});

test("a showcase screenshot links to its app, out of the tab order", async ({ page }) => {
  await page.goto("/showcase");
  const shot = card(page, "Lumiose Chip").locator("a.shot-link");
  await expect(shot).toHaveAttribute("href", "/showcase/chiptune-tracker/");
  await expect(shot).toHaveAttribute("tabindex", "-1");
  await expect(shot).toHaveAttribute("aria-hidden", "true");
  // The bookshelf needs a server: its screenshot links to its source.
  await expect(card(page, "Bookshelf").locator("a.shot-link")).toHaveAttribute(
    "href",
    /\/examples\/ssr-bookshelf$/,
  );
  await shot.click();
  await page.waitForURL("**/showcase/chiptune-tracker/");
  await expectAppOrBuildHint(page, /Lumiose Chip/, "spa-chiptune");
});

test("the benchmark apps are served in dev", async ({ request }) => {
  // The fullstack viewer and its results are committed; the js-framework-benchmark app needs a build.
  expect((await request.get("/benchmarks/fullstack/")).status()).toBe(200);
  const app = await request.get("/benchmarks/js-framework-benchmark/app/");
  if (app.status() !== 200) {
    expect(await app.text()).toContain("pnpm --filter @lumiose/bench-jsfb build");
  }
});
