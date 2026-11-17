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
  await expect(page).toHaveTitle("Lumiose web framework: feels like React, runs like vanilla JS");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "One component model, from static pages to full-stack apps",
  );
  await expect(page.locator(".hero .eyebrow")).toHaveText(
    "Static sites · Server-side rendering · Islands · SPAs",
  );
  await expect(page.locator(".hero .lead")).toContainText("TSX with their styles in the same file");
  // The meta and OG descriptions lead with the search terms, within 160 characters.
  const description = await page.locator('meta[name="description"]').last().getAttribute("content");
  expect(description).toMatch(
    /^Lumiose: one web framework for static sites, server-side rendering/,
  );
  expect(description!.length).toBeLessThanOrEqual(160);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    description!,
  );
  await expect(page.getByRole("link", { name: "Get started" }).first()).toHaveAttribute(
    "href",
    "/docs/getting-started/",
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
  await expect(page.locator("#compare-title")).toHaveText(
    "Feels like React. Runs like vanilla JS.",
  );
  // Server speed: one header over two cells, renders/s (SSR benchmark) then req/s (fullstack).
  await expect(table.locator("thead tr")).toHaveCount(1);
  await expect(table.locator("thead th").last()).toHaveText("Server speed");
  await expect(table.locator("thead th").last()).toHaveAttribute("colspan", "2");
  await expect(table.locator("tbody tr.self td").nth(4)).toHaveText(/^\d[\d,]* renders\/s$/);
  await expect(table.locator("tbody tr.self td").nth(5)).toHaveText(/^\d[\d,]* req\/s$/);
  const preact = table.locator("tbody tr", { has: page.locator("th", { hasText: /^Preact$/ }) });
  await expect(preact.locator("td").last()).toHaveText("No full-stack layer");
  await expect(
    page.locator("#compare .note", {
      hasText:
        /^Astro's interactive islands use a second UI framework: Preact in the fullstack comparison/,
    }),
  ).toHaveCount(1);

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

/** The beams' pulse, as the browser runs it: one CSS animation per beam. */
function beamAnimations(page: Page) {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) =>
        (animation.effect as KeyframeEffect | null)?.target?.matches(".lm-beams line"),
      )
      .map((animation) => animation.playState),
  );
}

test("the beams pulse behind every page, brighter on the landing, and pause with their control", async ({
  page,
}) => {
  const level = () =>
    page
      .locator(".lm-beams")
      .evaluate((svg) => getComputedStyle(svg).getPropertyValue("--lm-beam"));
  await page.goto("/docs/concepts/styles");
  const inner = Number(await level());
  await page.goto("/");
  expect(Number(await level())).toBeGreaterThan(inner);
  await expect(page.locator(".lm-beams line")).toHaveCount(14);
  await expect(page.locator(".lm-beams")).toHaveAttribute("aria-hidden", "true");
  expect(new Set(await beamAnimations(page))).toEqual(new Set(["running"]));

  const pause = page.getByRole("checkbox", { name: "Pause background animation" });
  await pause.check();
  expect(new Set(await beamAnimations(page))).toEqual(new Set(["paused"]));
  await pause.uncheck();
  expect(new Set(await beamAnimations(page))).toEqual(new Set(["running"]));
});

test("under reduced motion the beams are still, with no pause control", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".lm-beams line").first()).toHaveCSS("animation-name", "none");
  expect(await beamAnimations(page)).toEqual([]);
  await expect(page.getByLabel("Pause background animation")).toBeHidden();
});

test("without JavaScript the landing is complete, beams and their pause control included", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("#compare tbody tr")).toHaveCount(9);
  const beam = page.locator(".lm-beams line").first();
  await expect(beam).toHaveCSS("animation-play-state", "running");
  await page.getByLabel("Pause background animation").check();
  await expect(beam).toHaveCSS("animation-play-state", "paused");
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
  await page
    .getByRole("navigation", { name: "Previous and next pages" })
    .getByRole("link", { name: /Next/ })
    .click();
  await expect(page).toHaveURL(/\/docs\/concepts\/async\/?$/);
  expect(failures).toEqual([]);
});

test("search finds pages and headings", async ({ page }) => {
  await page.goto("/docs");
  const box = await search(page);
  await page.keyboard.press("/");
  await expect(box).toBeFocused();
  await page.keyboard.type("staticPaths");
  const results = page.getByRole("listbox", { name: "Search the docs" });
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
  await expect(page).toHaveURL(/\/docs\/errors\/LUM2001\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/LUM2001/);
});

test("llms.txt and llms-full.txt are served at the root, and the UI's below /ui", async ({
  request,
}) => {
  const llms = await request.get("/llms.txt");
  expect(llms.ok()).toBe(true);
  expect(llms.headers()["content-type"]).toContain("text/plain");
  const text = await llms.text();
  expect(text).toMatch(/^# Lumiose/);
  expect(text).toContain("](/docs/concepts/signals/)");
  expect(text).not.toMatch(/\]\([^)]+\.md\)/);
  const full = await request.get("/llms-full.txt");
  expect(await full.text()).toContain("<!-- source: concepts/signals.md -->");
  // @lumiose/ui's docs ship in their own package, with their own index (decision-64).
  const ui = await request.get("/ui/llms.txt");
  expect(ui.ok()).toBe(true);
  expect(await ui.text()).toContain("](/ui/dialog/)");
  const uiFull = await request.get("/ui/llms-full.txt");
  expect(await uiFull.text()).toContain("<!-- source: dialog.md -->");
});

test("/benchmarks compares the stacks from the committed results", async ({ page }) => {
  await page.goto("/benchmarks");
  // The stack table (decision-90): nine stacks, Lumiose first, no "not measured" cell.
  const table = page.locator("#stacks table");
  await expect(table.locator("tbody tr")).toHaveCount(9);
  await expect(table.locator("tbody tr").first()).toHaveClass(/self/);
  await expect(table.locator("tbody tr.self th")).toHaveText("Lumiose");
  await expect(table.locator("tbody tr.self td").nth(2)).toHaveText("0 kB");
  await expect(table).not.toContainText(/not measured/i);
  // Server speed: one header over two cells, renders/s (SSR benchmark) then req/s (fullstack).
  await expect(table.locator("thead th").last()).toHaveText("Server speed");
  await expect(table.locator("thead th").last()).toHaveAttribute("colspan", "2");
  await expect(table.locator("tbody tr.self td").nth(4)).toHaveText(/^\d[\d,]* renders\/s$/);
  await expect(table.locator("tbody tr.self td").nth(5)).toHaveText(/^\d[\d,]* req\/s$/);
  await expect(page.locator("#stacks .note").first()).toContainText(/^JS on a server page:/);
  // Four charts, Lumiose's row marked in each.
  await expect(page.locator("figure.chart")).toHaveCount(4);
  await expect(page.locator("figure.chart li.self")).toHaveCount(4);
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
  await page.getByRole("listbox", { name: "Search the docs" }).getByRole("option").first().click();
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
  await expect(page.getByRole("listbox", { name: "Search the docs" })).toBeVisible();
  await page.screenshot({ path: out("search") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs/concepts/signals");
  await page.screenshot({ path: out("docs-phone") });
  await page.goto("/");
  await page.screenshot({ path: out("home-phone") });
});

const landingShot = (name: string) => `../../backlog/assets/task-213-${name}.png`;

// SCREENSHOTS=1 pnpm screenshots: TASK-213's landing captures at 1440 and 390 px, in both themes,
// with the live demo loaded and the beams paused.
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
      await page.getByLabel("Pause background animation").check();
      // The click scrolls the control into view; the capture starts at the top.
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(300);
      await page.screenshot({ path: landingShot(`${width}-${scheme}`), fullPage: true });
    }
  }
});
