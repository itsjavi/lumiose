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

test("the landing page is the hero with live code, four rows, the UI strip and the closing box", async ({
  page,
}) => {
  const failures = watchFailures(page);
  await page.goto("/");
  await expect(page).toHaveTitle("Lumiose web framework: feels like React, runs like vanilla JS");
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
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Lumiose: Feels like React. Runs like vanilla JS.",
  );

  // The sections of decision-90's reference, in order, and nothing else.
  expect(
    await page.locator(".home > *").evaluateAll((sections) => sections.map((el) => el.className)),
  ).toEqual(["hero", "rows", "strip", "end"]);

  // The hero: the site's own copy, two actions, and the code panel.
  const hero = page.locator(".hero");
  await expect(hero.locator(".label").first()).toHaveText(
    "Static sites · Server-side rendering · Islands · SPAs",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "One component model, from static pages to full-stack apps",
  );
  await expect(hero.locator(".lead")).toContainText("TSX with their styles in the same file");
  await expect(hero.locator(".cta a")).toHaveText(["Get started", "Open playground"]);
  await expect(hero.getByRole("link", { name: "Get started" })).toHaveAttribute(
    "href",
    "/docs/getting-started/",
  );
  await expect(hero.getByRole("link", { name: "Open playground" })).toHaveAttribute(
    "href",
    "/playground/",
  );
  await expect(hero.locator(".code .bar")).toHaveText("Counter.stsxlive");
  await expect(hero.locator(".code pre")).toContainText("const count = signal(0);");
  await expect(hero.locator(".code pre u")).not.toHaveCount(0);
  // The counter under the code is that code, running: an island of its own.
  const counter = hero.locator(".out").getByRole("button");
  await expect(counter).toHaveText("Clicked 0 times");
  await counter.click();
  await counter.click();
  await expect(counter).toHaveText("Clicked 2 times");

  // The four rows: each one a link, the last one to the benchmarks, with no figure in it.
  await expect(page.locator(".rows h2")).toHaveText(["Write", "Render", "Hydrate", "Measure"]);
  expect(
    await page.locator(".rows a").evaluateAll((links) => links.map((a) => a.getAttribute("href"))),
  ).toEqual([
    "/docs/concepts/components/",
    "/docs/concepts/rendering-modes/",
    "/docs/concepts/islands/",
    "/benchmarks/",
  ]);

  // The UI strip: four live @lumiose/ui components.
  const tray = page.locator(".strip .tray");
  await expect(tray.locator("li")).toHaveCount(4);
  await expect(
    page.locator(".strip").getByRole("link", { name: "Browse components" }),
  ).toHaveAttribute("href", "/ui/");
  const demo = tray.getByRole("switch", { name: "Demo switch" });
  await expect(demo).toBeChecked();
  await demo.click();
  await expect(demo).not.toBeChecked();
  await tray.getByRole("tab", { name: "Two" }).click();
  await expect(tray.getByRole("tabpanel")).toHaveText("Second panel");
  await expect(tray.getByRole("slider", { name: "Demo slider" })).toHaveValue("40");
  await expect(tray.getByRole("button", { name: "Button" })).toBeVisible();

  // The closing box: the install command with its copy button, and the docs.
  const end = page.locator(".end");
  await expect(end.getByRole("heading", { level: 2 })).toHaveText("Enlighten your next project.");
  await expect(end.locator("code")).toHaveText("npm create lumiose@latest my-app");
  await expect(end.getByRole("button", { name: "Copy the install command" })).toBeVisible();
  await expect(end.getByRole("link", { name: "Read the docs" })).toHaveAttribute("href", "/docs/");

  // No benchmarks on the landing (they are on /benchmarks): no table, no chart, no measured number.
  const main = page.locator("main");
  await expect(main.locator("table, figure.chart, .proof")).toHaveCount(0);
  await expect(main).not.toContainText(/\d\s?(kB|×|req\/s|renders\/s|ms\b)/);
  // No gradients, round corners or shadows (decision-90), on any element or pseudo-element.
  const decorated = await main.evaluate((root) => {
    const found: string[] = [];
    for (const el of root.querySelectorAll("*")) {
      for (const pseudo of [null, "::before", "::after"]) {
        const style = getComputedStyle(el, pseudo);
        if (pseudo !== null && style.content === "none") continue;
        const name = `${el.tagName.toLowerCase()}.${el.getAttribute("class") ?? ""}${pseudo ?? ""}`;
        if (style.backgroundImage.includes("gradient")) found.push(`${name}: gradient`);
        // A blurred shadow is a shadow; a sharp inset one is a line (the selected tab's).
        const blurs = [...style.boxShadow.matchAll(/-?[\d.]+px -?[\d.]+px (-?[\d.]+)px/g)];
        if (blurs.some((blur) => Number(blur[1]) > 0)) found.push(`${name}: ${style.boxShadow}`);
        if (parseFloat(style.borderTopLeftRadius) > 0) found.push(`${name}: round corner`);
      }
    }
    return found;
  });
  expect(decorated).toEqual([]);
  expect(failures).toEqual([]);
});

test("the landing loads no playground or editor code", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.getByRole("button", { name: "Copy the install command" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".playground, .cm-editor")).toHaveCount(0);
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.filter((path) => /playground|codemirror|lezer|wasm|editor/i.test(path))).toEqual(
    [],
  );
  // The same check finds the editor where it is: on /playground.
  requests.length = 0;
  await page.goto("/playground");
  await page.waitForLoadState("networkidle");
  expect(requests.filter((path) => /playground|wasm/i.test(path))).not.toEqual([]);
});

for (const [width, height] of [
  [1280, 900],
  [390, 844],
] as const) {
  test(`nothing on the landing shifts after the first paint, at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    // Every layout shift the browser has reported since the first frame (`buffered`), except the
    // ones right after user input, summed as cumulative layout shift is.
    const shift = () =>
      page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            let total = 0;
            const add = (entries: PerformanceEntry[]) => {
              for (const entry of entries) {
                if ("hadRecentInput" in entry && entry.hadRecentInput === true) continue;
                if ("value" in entry && typeof entry.value === "number") total += entry.value;
              }
            };
            const observer = new PerformanceObserver((list) => add(list.getEntries()));
            observer.observe({ type: "layout-shift", buffered: true });
            // Two frames and a task, so the entries of the last layout have been delivered.
            requestAnimationFrame(() =>
              requestAnimationFrame(() =>
                setTimeout(() => {
                  add(observer.takeRecords());
                  observer.disconnect();
                  resolve(total);
                }, 50),
              ),
            );
          }),
      );
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // The counter has hydrated: it counts. (A shift within 500 ms of the click would be excused,
    // so the page is measured before it and again well after it.)
    expect(await shift(), "after load").toBe(0);
    const counter = page.locator(".hero .out").getByRole("button");
    await counter.click();
    await expect(counter).toHaveText("Clicked 1 times");
    await page.waitForTimeout(600);
    // Down the page in steps, so every island that hydrates when visible does.
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < total; y += height / 2) {
      await page.evaluate((top) => scrollTo(0, top), y);
      await page.waitForTimeout(100);
    }
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    expect(await shift(), "after scrolling to the bottom").toBe(0);
    // The measure sees a shift when there is one: content pushed down by a new block.
    await page.evaluate(() => {
      scrollTo(0, 0);
      const block = document.createElement("div");
      block.style.blockSize = "200px";
      document.querySelector(".home")!.prepend(block);
    });
    expect(await shift(), "with a block inserted above the hero").toBeGreaterThan(0);
  });
}

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
  await expect(page.locator(".rows a")).toHaveCount(4);
  await expect(page.locator(".hero .out").getByRole("button")).toHaveText("Clicked 0 times");
  const beam = page.locator(".lm-beams line").first();
  await expect(beam).toHaveCSS("animation-play-state", "running");
  await page.getByLabel("Pause background animation").check();
  await expect(beam).toHaveCSS("animation-play-state", "paused");
  // The tabs of the UI strip are server HTML: the first panel shows.
  await expect(page.locator(".tray").getByRole("tabpanel")).toHaveText("First panel");
  await context.close();
});

test("docs pages render the Markdown with navigation, TOC and prev/next", async ({ page }) => {
  const failures = watchFailures(page);
  await page.goto("/docs/concepts/styles");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Styles");
  const nav = page.getByRole("navigation", { name: "Docs" });
  await expect(nav.getByRole("link", { name: "Styles", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
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

const landingShot = (name: string) => `../../backlog/assets/redesign/task-607-landing-${name}.jpg`;

// SCREENSHOTS=1 pnpm screenshots: TASK-607's landing captures at 1280 and 390 px, in both themes,
// with the beams paused.
test("landing screenshots", async ({ page }) => {
  test.skip(!process.env["SCREENSHOTS"], "Set SCREENSHOTS=1 to capture.");
  for (const [name, width, height] of [
    ["desktop", 1280, 900],
    ["phone", 390, 844],
  ] as const) {
    for (const scheme of ["dark", "light"] as const) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await page.getByLabel("Pause background animation").check();
      // The click scrolls the control into view; the capture starts at the top, with nothing hovered.
      await page.evaluate(() => scrollTo(0, 0));
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
      await page.screenshot({
        path: landingShot(`${name}-${scheme}`),
        type: "jpeg",
        quality: 82,
        fullPage: true,
      });
    }
  }
});
