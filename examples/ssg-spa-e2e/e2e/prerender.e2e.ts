// TASK-216 end to end: spa routes prerendered at build time (decision-38), by the root layout's
// `prerender` (TASK-229). The build project serves
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

test("a conditional fragment with inserts before a static element hydrates in place (TASK-234)", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
  });
  // A client render after a hydration mismatch removes the server's elements.
  await page.addInitScript(() => {
    const w = window as unknown as { removed: string[] };
    w.removed = [];
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes) {
          if (node instanceof Element) w.removed.push(node.outerHTML);
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/");
  await ready(page);
  await expect(page.locator("#frag")).toHaveText("abstatic");
  const removed = await page.evaluate(() => (window as unknown as { removed: string[] }).removed);
  expect(removed.filter((html) => html.includes("frag-"))).toEqual([]);
  expect(errors).toEqual([]);
  await page.locator("#frag-toggle").click();
  await expect(page.locator("#frag")).toHaveText("");
  await page.locator("#frag-toggle").click();
  await expect(page.locator("#frag")).toHaveText("abstatic");
});

/**
 * Records whether an element matching `selector` is ever visible at an animation frame (where the
 * browser paints) while the page loads.
 */
async function watchFlash(page: Page, selector: string): Promise<void> {
  await page.addInitScript((watched) => {
    const w = window as unknown as { flashed: boolean };
    w.flashed = false;
    const frame = (): void => {
      const el = document.querySelector(watched);
      if (el?.checkVisibility({ visibilityProperty: true })) w.flashed = true;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, selector);
}

const flashed = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as unknown as { flashed: boolean }).flashed);

test("a param staticPaths() did not list renders its page, with no 404 flash (TASK-231)", async ({
  page,
}, testInfo) => {
  await watchFlash(page, "#not-found");
  const response = await page.goto("/tracks/4");
  // The static host answers with 404.html; dev renders the page.
  expect(response!.status()).toBe(testInfo.project.name === "build" ? 404 : 200);
  await expect(page.locator("#track")).toHaveText("Track 4: Credits");
  await expect(page.locator("#where")).toHaveText("mounted, volume 100");
  await expect(page).toHaveTitle("Credits");
  await ready(page);
  expect(await flashed(page)).toBe(false);
  await page.getByRole("link", { name: "Track 2", exact: true }).click();
  await expect(page.locator("#track")).toHaveText("Track 2: Cave");
  expect(await sameDocument(page)).toBe(true);
});

test("a page whose data is in the browser renders it after a server 404, with no flash (TASK-231)", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("track:5", "Saved"));
  await watchFlash(page, "#not-found");
  // The static host's 404.html, or the _404 that `lumiose dev` renders: the server has no such track.
  const response = await page.goto("/tracks/5");
  expect(response!.status()).toBe(404);
  await expect(page.locator("#track")).toHaveText("Track 5: Saved");
  await ready(page);
  expect(await flashed(page)).toBe(false);
});

test("unknown URLs get the _404 page inside the SPA, which still navigates", async ({ page }) => {
  // A route whose page finds nothing (on the client, from 404.html), and a URL no route matches.
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

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("unknown URLs show the _404 page", async ({ page }) => {
    for (const path of ["/tracks/99", "/missing"]) {
      const response = await page.goto(path);
      expect(response!.status()).toBe(404);
      await expect(page.locator("#not-found")).toHaveText("404 Not Found");
      await expect(page.locator("#not-found")).toBeVisible();
    }
  });
});
