// The website as a static host serves it: landing page, docs, search, theme, redirects, llms.txt,
// the 404 page, and the same site below a base path (/lumiose/, as on GitHub Pages).
import { expect, test, type Page } from "@playwright/test";

/** Requests that failed or answered >= 400, except the known modulepreload 404s (TASK-98). */
function watchFailures(page: Page): string[] {
  const failures: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().includes("@lumiose/site-kit")) {
      failures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("pageerror", (error) => {
    // A cross-document view transition cut short by the next navigation; harmless.
    if (!error.message.includes("Transition was aborted"))
      failures.push(`pageerror: ${error.message}`);
  });
  return failures;
}

/** The DocsSearch island, once hydrated. */
async function search(page: Page) {
  await expect(page.locator(".search[data-ready]")).toBeAttached();
  return page.getByRole("combobox", { name: "Search the docs" });
}

test("the landing page presents Lumiose with benchmark evidence", async ({ page }) => {
  const failures = watchFailures(page);
  await page.goto("/");
  await expect(page).toHaveTitle(/Lumiose/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Feels like React. Runs like vanilla JS.",
  );
  const description = await page.locator('meta[name="description"]').last().getAttribute("content");
  expect((await page.locator(".hero .lead").textContent())?.replace(/\s+/g, " ")).toBe(description);
  await expect(page.getByRole("link", { name: "Get started" }).first()).toHaveAttribute(
    "href",
    "/docs/getting-started",
  );
  await expect(page.getByRole("link", { name: "Compare the stacks" })).toHaveAttribute(
    "href",
    "#compare",
  );
  await expect(page.locator(".proof strong")).toHaveText([/^\d\.\d\d×$/, "0 kB", /^\d+\.\d kB$/]);

  // The stack table, right below the hero: nine stacks, Lumiose last, no "not measured" cell.
  const table = page.locator("#compare table");
  await expect(table.locator("tbody tr")).toHaveCount(9);
  await expect(table.locator("tbody tr.self th")).toHaveText("Lumiose");
  await expect(table.locator("tbody tr.self td").nth(2)).toHaveText("0 kB");
  await expect(table).not.toContainText(/not measured/i);

  // The four sections, in order, then the closing call.
  await expect(page.locator(".box h3")).toHaveText([
    "Familiar to write",
    "Every rendering mode",
    "Light and fast, measured",
    "Explicit, for you and your agent",
  ]);
  await expect(page.locator(".box figure.chart li.self")).toContainText("Lumiose");
  await expect(page.locator(".modes a").first()).toHaveAttribute(
    "href",
    /\/demos\/travel-journal\/$/,
  );
  expect(failures).toEqual([]);
});

/** Counts requestAnimationFrame calls, to see whether the light field's loop runs. */
async function countFrames(page: Page) {
  await page.addInitScript(() => {
    const original = window.requestAnimationFrame.bind(window);
    (window as unknown as { frames: number }).frames = 0;
    window.requestAnimationFrame = (callback) => {
      (window as unknown as { frames: number }).frames++;
      return original(callback);
    };
  });
  return async (ms: number) => {
    const before = await page.evaluate(() => (window as unknown as { frames: number }).frames);
    await page.waitForTimeout(ms);
    return (await page.evaluate(() => (window as unknown as { frames: number }).frames)) - before;
  };
}

test("the light field pauses with its button and off-screen", async ({ page }) => {
  const frames = await countFrames(page);
  await page.goto("/");
  const pause = page.getByRole("button", { name: "Pause animation" });
  // client:idle: the island loads after the first paint, and only with WebGL.
  await expect(page.locator(".stage canvas.on")).toBeAttached({ timeout: 10_000 });
  await expect(pause).toBeVisible();
  expect(await frames(500)).toBeGreaterThan(5);

  await pause.click();
  const play = page.getByRole("button", { name: "Play animation" });
  await expect(play).toBeVisible();
  expect(await frames(500)).toBeLessThanOrEqual(1);
  await play.click();
  expect(await frames(500)).toBeGreaterThan(5);

  await page.locator("#start-title").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  expect(await frames(500)).toBeLessThanOrEqual(1);
});

test("under reduced motion the light field is one still frame", async ({ page }) => {
  const frames = await countFrames(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".stage canvas.on")).toBeAttached({ timeout: 10_000 });
  await expect(page.locator(".stage .motion")).toBeHidden();
  expect(await frames(1000)).toBeLessThanOrEqual(1);
});

test("without JavaScript the landing is complete, on the CSS light", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("#compare tbody tr")).toHaveCount(9);
  await expect(page.locator(".stage .motion")).toBeHidden();
  await expect(page.locator(".live-demo").getByText("You write")).toBeVisible();
  await context.close();
});

test("docs pages render the Markdown with navigation, TOC and prev/next", async ({ page }) => {
  const failures = watchFailures(page);
  await page.goto("/docs/concepts/styles");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Styles");
  const nav = page.getByRole("navigation", { name: "Docs" });
  await expect(nav.getByRole("link", { name: "Styles" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "On this page" })).toContainText(
    "Common mistakes",
  );
  await expect(page.locator(".prose figure.code").first()).toBeVisible();
  await expect(page.locator(".prose .tok-keyword").first()).toBeVisible();
  // Links between docs point at pages, not at Markdown files.
  expect(await page.locator('.prose a[href$=".md"], .prose a[href*=".md#"]').count()).toBe(0);
  await page.getByRole("link", { name: /Next/ }).click();
  await expect(page).toHaveURL(/\/docs\/concepts\/async\/?$/);
  expect(failures).toEqual([]);
});

test("search finds pages and headings", async ({ page }) => {
  await page.goto("/docs");
  const box = await search(page);
  await page.keyboard.press("/");
  await expect(box).toBeFocused();
  await page.keyboard.type("staticPaths");
  const results = page.getByRole("listbox", { name: "Docs pages" });
  await expect(results.getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/docs\/.+/);
});

test("the theme toggle switches and remembers dark mode", async ({ page }) => {
  await page.goto("/docs");
  const html = page.locator("html");
  const before = await html.getAttribute("data-theme");
  await page.getByRole("button", { name: /theme/i }).click();
  await expect(html).not.toHaveAttribute("data-theme", before ?? "");
  const chosen = await html.getAttribute("data-theme");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", chosen!);
});

test("diagnostics have pages, and the printed URLs redirect to them", async ({ page }) => {
  await page.goto("/docs/errors");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Diagnostics");
  await page.goto("/errors/LUM2001");
  await expect(page).toHaveURL(/\/docs\/errors\/LUM2001$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/LUM2001/);
});

test("llms.txt and llms-full.txt are served at the root", async ({ request }) => {
  const llms = await request.get("/llms.txt");
  expect(llms.ok()).toBe(true);
  expect(llms.headers()["content-type"]).toContain("text/plain");
  const text = await llms.text();
  expect(text).toMatch(/^# Lumiose/);
  expect(text).toContain("](/docs/concepts/signals)");
  expect(text).not.toMatch(/\]\([^)]+\.md\)/);
  const full = await request.get("/llms-full.txt");
  expect(await full.text()).toContain("<!-- source: concepts/signals.md -->");
});

test("unknown URLs get the 404 page", async ({ page }) => {
  const response = await page.goto("/docs/nope");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page is not here");
});

test("below a base path every URL keeps the base", async ({ page }) => {
  const failures = watchFailures(page);
  const outside: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.host === "127.0.0.1:5194" && !url.pathname.startsWith("/lumiose/")) {
      if (!url.pathname.includes("@lumiose/site-kit")) outside.push(url.pathname);
    }
  });
  await page.goto("/lumiose/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Get started" }).first().click();
  await expect(page).toHaveURL(/\/lumiose\/docs\/getting-started\/?$/);
  await (await search(page)).fill("islands");
  await page.getByRole("listbox", { name: "Docs pages" }).getByRole("option").first().click();
  await expect(page).toHaveURL(/\/lumiose\/docs\/.+/);
  expect(outside).toEqual([]);
  expect(failures).toEqual([]);
});

test("phones get the docs first and the menu in a disclosure", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/docs/concepts/signals");
  const nav = page.getByRole("navigation", { name: "Docs" });
  await expect(nav).toBeHidden();
  await page.locator("summary", { hasText: "Menu" }).click();
  await expect(nav).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

const out = (name: string) => `../../backlog/assets/task-57-${name}.png`;

// SCREENSHOTS=1 pnpm screenshots: the representative captures in backlog/assets.
test("screenshots", async ({ page }) => {
  test.skip(!process.env["SCREENSHOTS"], "Set SCREENSHOTS=1 to capture.");
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/");
    await page.waitForTimeout(300);
    await page.screenshot({ path: out(`home-${scheme}`), fullPage: true });
    await page.goto("/docs/concepts/styles");
    await page.waitForTimeout(300);
    await page.screenshot({ path: out(`docs-${scheme}`) });
  }
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/docs/errors/LUM2001");
  await page.screenshot({ path: out("diagnostic") });
  await page.goto("/docs/concepts/islands");
  await (await search(page)).fill("bind:value");
  await expect(page.getByRole("listbox", { name: "Docs pages" })).toBeVisible();
  await page.screenshot({ path: out("search") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs/concepts/signals");
  await page.screenshot({ path: out("docs-phone") });
  await page.goto("/");
  await page.screenshot({ path: out("home-phone") });
});

const landingShot = (name: string) => `../../backlog/assets/task-213-${name}.png`;

// SCREENSHOTS=1 pnpm screenshots: TASK-213's landing captures at 1440 and 390 px, in both themes,
// with the live demo loaded and the light paused once it is fully up.
test("landing screenshots", async ({ page }) => {
  test.skip(!process.env["SCREENSHOTS"], "Set SCREENSHOTS=1 to capture.");
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const) {
    for (const scheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      await page.locator(".live-demo").scrollIntoViewIfNeeded();
      await expect(page.locator(".playground .status")).toContainText("Compiled", {
        timeout: 20_000,
      });
      await page.evaluate(() => scrollTo(0, 0));
      await expect(page.locator(".stage canvas.on")).toBeAttached({ timeout: 10_000 });
      await page.waitForTimeout(3000);
      await page.getByRole("button", { name: "Pause animation" }).click();
      // The click scrolls the button into view; the capture starts at the top.
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(300);
      await page.screenshot({ path: landingShot(`${width}-${scheme}`), fullPage: true });
    }
  }
});
