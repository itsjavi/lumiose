// `lumiose({ prerender: true })` (TASK-217): every route's HTML already holds the app (built pages in
// preview, per-request renders in dev), and the browser hydrates it without re-rendering.
import { expect, test, type Page } from "@playwright/test";

// No-JS screenshots go to $CHIPTUNE_SHOTS when set (the preview project only).
const SHOTS = process.env.CHIPTUNE_SHOTS;

const PAGES: [path: string, check: (page: Page) => Promise<void>][] = [
  ["/", (page) => expect(page.locator(".row")).toHaveCount(64)],
  ["/songs/demo", (page) => expect(page.locator(".row")).toHaveCount(64)],
  ["/songs", (page) => expect(page.getByRole("heading", { name: "Current song" })).toBeVisible()],
  [
    "/instruments",
    (page) => expect(page.getByRole("heading", { name: "Instrument 00" })).toBeVisible(),
  ],
  ["/settings", (page) => expect(page.getByRole("heading", { name: "Keyboard" })).toBeVisible()],
  [
    "/no-such-page",
    (page) => expect(page.getByRole("heading", { name: "404 · Not here" })).toBeVisible(),
  ],
];

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("every route's HTML shows the app: header, view and mixer", async ({ page }, info) => {
    for (const [path, check] of PAGES) {
      await page.goto(path);
      await expect(page.locator(".header .title")).toHaveText("Lumiose Quest");
      await expect(page.getByRole("heading", { name: "Mixer" })).toBeVisible();
      await check(page);
      if (SHOTS && path === "/" && info.project.name === "preview") {
        await page.screenshot({ path: `${SHOTS}/task-217-no-js.png` });
      }
    }
  });

  test("a song URL the server cannot know shows the 404 page", async ({ page }) => {
    const response = await page.goto("/songs/nope");
    expect(response!.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "404 · Not here" })).toBeVisible();
  });
});

test("hydration keeps the prerendered nodes, and audio waits for a gesture", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    // The 404 page's own document status is the only expected error.
    if (message.type() === "error" && !message.text().includes("404 (Not Found)")) {
      problems.push(message.text());
    }
  });
  // Mark the server-rendered header before the app's scripts run: a mismatch would make the SPA
  // render on the client instead, replacing the node.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const header = document.querySelector(".header");
      if (header) (header as unknown as { prerendered: boolean }).prerendered = true;
    });
  });
  for (const [path, check] of PAGES) {
    await page.goto(path);
    await check(page);
    await expect(page.locator(".engine")).toHaveText("AUDIO OFF");
    expect(
      await page
        .locator(".header")
        .evaluate((el) => (el as unknown as { prerendered?: boolean }).prerendered),
      path,
    ).toBe(true);
  }
  expect(problems).toEqual([]);
});

test("a song saved in this browser opens from its URL, though only the demo is prerendered", async ({
  page,
}) => {
  // The server answers its URL with the 404 page (404.html, or dev's render), which the router
  // replaces with the song page before it is ever painted (TASK-231).
  await page.addInitScript(() => {
    const w = window as unknown as { flashed: boolean };
    w.flashed = false;
    const frame = (): void => {
      const el = document.querySelector(".not-found");
      if (el?.checkVisibility({ visibilityProperty: true })) w.flashed = true;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await page.goto("/songs");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/songs");
  await page.getByRole("button", { name: "New song" }).click();
  await page.getByRole("link", { name: "Tracker" }).click();
  await expect(page).toHaveURL(/\/songs\/(?!demo)\w+$/);
  await page.reload();
  await expect(page.locator(".header .title")).toHaveText("Untitled");
  await expect(page.locator(".row").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "404 · Not here" })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { flashed: boolean }).flashed)).toBe(
    false,
  );
  // `/` reopens the last song and names it in the URL.
  const url = page.url();
  await page.goto("/");
  await expect(page).toHaveURL(url);
});
