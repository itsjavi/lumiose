// TASK-216 end to end: spa routes prerendered at build time (decision-38). The build project serves
// dist/client as static files (the build has no dist/server); the dev project renders the same
// pages per request. Each spec checks the HTML, its hydration and client navigation from it.
import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/** Waits until the SPA root is interactive, and marks the document to detect full page loads. */
async function ready(page: Page): Promise<void> {
  await page.locator("#root-count").click();
  await expect(page.locator("#root-count")).toHaveText("root 1");
  await page.evaluate(() => {
    (window as unknown as { spa: boolean }).spa = true;
  });
}

/** Whether the document is still the one `ready()` marked (no full page load since). */
function sameDocument(page: Page): Promise<boolean> {
  return page.evaluate(() => (window as unknown as { spa?: boolean }).spa === true);
}

test("the build is static: no dist/server", () => {
  test.skip(test.info().project.name !== "build", "a build output check");
  expect(existsSync("dist/client/tracks/2/index.html")).toBe(true);
  expect(existsSync("dist/server")).toBe(false);
});

test("a prerendered page is real HTML that hydrates into the SPA", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
  });
  const html = await (await page.request.get("/tracks/2")).text();
  expect(html).toMatch(/<h1 id=track>Track (<!--\[-->)?2(<!--\]-->)?: (<!--\[-->)?Cave/);
  expect(html).toContain("<title>Cave</title>");
  expect(html).toContain("#lumiose:spa");
  // onMount() did not run while prerendering.
  expect(html).toMatch(/<p id=where>(<!--\[-->)?prerendered/);

  await page.goto("/tracks/2");
  await ready(page);
  await expect(page.locator("#track")).toHaveText("Track 2: Cave");
  await expect(page.locator("#where")).toHaveText("mounted, volume 100");
  await expect(page).toHaveTitle("Cave");
  expect(errors).toEqual([]);
});

test("client navigation from a prerendered page stays in the document", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await expect(page.locator("#home")).toHaveText("Tracks");
  await page.getByRole("link", { name: "Track 1", exact: true }).click();
  await expect(page.locator("#track")).toHaveText("Track 1: Overworld");
  await expect(page.locator("#url")).toHaveText("/tracks/1");
  await expect(page).toHaveTitle("Overworld");
  await page.getByRole("link", { name: "Track 3", exact: true }).click();
  await expect(page.locator("#track")).toHaveText("Track 3: Boss");
  await expect(page.locator("#where")).toHaveText("mounted, volume 100");
  // The persistent layout kept its state: no full page load.
  await expect(page.locator("#root-count")).toHaveText("root 1");
  expect(await sameDocument(page)).toBe(true);

  await page.goBack();
  await expect(page.locator("#track")).toHaveText("Track 1: Overworld");
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.locator("#home")).toBeVisible();
  expect(await sameDocument(page)).toBe(true);
});

test("deep links with params load their own prerendered page", async ({ page }) => {
  for (const [id, name] of [
    ["1", "Overworld"],
    ["3", "Boss"],
  ]) {
    const response = await page.goto(`/tracks/${id}`);
    expect(response!.status()).toBe(200);
    await ready(page);
    await expect(page.locator("#track")).toHaveText(`Track ${id}: ${name}`);
    await expect(page.locator("#url")).toHaveText(`/tracks/${id}`);
  }
  // And navigate on the client from there.
  await page.getByRole("link", { name: "Track 2", exact: true }).click();
  await expect(page.locator("#track")).toHaveText("Track 2: Cave");
  expect(await sameDocument(page)).toBe(true);
});

test("unknown URLs get the _404 page inside the SPA, which still navigates", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "build", "the static host's 404.html");
  // A param staticPaths() did not list, and a URL no route matches.
  for (const path of ["/tracks/99", "/missing"]) {
    const response = await page.goto(path);
    expect(response!.status()).toBe(404);
    await ready(page);
    await expect(page.locator("#not-found")).toHaveText("404 Not Found");
  }
  await page.getByRole("link", { name: "Track 2", exact: true }).click();
  await expect(page.locator("#track")).toHaveText("Track 2: Cave");
  expect(await sameDocument(page)).toBe(true);
});
