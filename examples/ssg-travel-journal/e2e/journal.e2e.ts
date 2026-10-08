// End-to-end tests of the static build served as plain files (see playwright.config.ts): page
// navigation, pagination, tags, the post pages, the two islands, the RSS feed, the sitemap, the
// search index, 404.html and the site without JavaScript. JOURNAL_SCREENSHOTS=1 also saves
// screenshots to backlog/assets/task-37-*.png.
import { expect, test, type Page } from "@playwright/test";

const ASSETS = new URL("../../../backlog/assets/", import.meta.url);
const POSTS = 10;
const NEWEST = { slug: "night-train-to-vienna", title: "The night train to Vienna" };
const SKYE = { slug: "walking-the-isle-of-skye", title: "Walking the Isle of Skye" };

async function screenshot(page: Page, name: string, fullPage = false): Promise<void> {
  if (!process.env.JOURNAL_SCREENSHOTS) return;
  // Let a cross-document view transition finish, so the shot is not mid cross-fade.
  await page.waitForFunction(() => document.getAnimations().length === 0);
  await page.screenshot({ path: new URL(`task-37-${name}.png`, ASSETS).pathname, fullPage });
}

/** Waits until both header islands have hydrated (they set `data-ready` on mount). */
async function islandsReady(page: Page): Promise<void> {
  await expect(page.locator("form.search[data-ready]")).toBeAttached();
  await expect(page.locator("button.toggle[data-ready]")).toBeAttached();
}

test.beforeEach(({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  page.on("console", (message) => {
    // A hydration mismatch (LUM4006) or a runtime error fails the test (404 responses log too).
    const text = message.text();
    if (text.startsWith("Failed to load resource")) return;
    if (message.type() === "error" || text.includes("LUM4006")) {
      throw new Error(`console ${message.type()}: ${text}`);
    }
  });
});

test.describe("static output", () => {
  test("every page is a prerendered file", async ({ request }) => {
    const paths = [
      "/",
      "/page/2",
      "/page/3/",
      "/posts/lisbon-on-foot",
      "/tags",
      "/tags/islands",
      "/archive",
      "/about",
    ];
    for (const path of paths) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()["content-type"]).toContain("text/html");
      const html = await response.text();
      expect(html).toMatch(/^<!doctype html>/i);
      // Fully resolved at build time: no streaming swap scripts or fallbacks.
      expect(html).not.toContain("<template for=");
    }
    // /page/1 is the home page: the build wrote a redirect page.
    const redirect = await (await request.get("/page/1")).text();
    expect(redirect).toContain('<meta http-equiv="refresh" content="0;url=/">');
  });

  test("pages load only the island loader and the islands as JavaScript", async ({ page }) => {
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await page.goto("/about");
    await islandsReady(page);
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) expect(script).toMatch(/^\/assets\/[\w-]+\.js$/);
    // Inline: the theme script of document.tsx, the speculation rules of lumen({ prefetch }) and
    // the island records.
    const inline = await page
      .locator("script:not([src])")
      .evaluateAll((elements) => elements.map((element) => element.getAttribute("type")));
    expect(inline).toEqual([null, "speculationrules", "application/json"]);
  });
});

test.describe("navigation", () => {
  test("the journal pages through every post", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Long Way Round · A slow travel journal");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Notes from the slow way between places.",
    );
    await expect(page.locator(".card")).toHaveCount(4);
    await expect(page.locator(".card.featured h2")).toHaveText(NEWEST.title);
    await expect(
      page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Journal" }),
    ).toHaveAttribute("aria-current", "page");
    await screenshot(page, "home");

    const pager = page.getByRole("navigation", { name: "Journal pages" });
    await pager.getByRole("link", { name: "Older →" }).click();
    await expect(page).toHaveURL(/\/page\/2$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Journal, page 2 of 3");
    await expect(page.locator(".card")).toHaveCount(4);
    await expect(pager.locator("[aria-current=page]")).toHaveText("2");

    await pager.getByRole("link", { name: "3" }).click();
    await expect(page).toHaveURL(/\/page\/3$/);
    await expect(page.locator(".card")).toHaveCount(POSTS - 8);
    await expect(pager.getByRole("link", { name: "Older →" })).toHaveCount(0);
    await pager.getByRole("link", { name: "← Newer" }).click();
    await expect(page).toHaveURL(/\/page\/2$/);
  });

  test("a card opens its post, which links to its neighbours", async ({ page }) => {
    await page.goto("/");
    const card = page.locator(".card", { hasText: "Hut to hut across the Dolomites" });
    const coverName = await card
      .locator("img")
      .evaluate((img) => getComputedStyle(img).viewTransitionName);
    await card.getByRole("link", { name: "Hut to hut across the Dolomites" }).click();

    await expect(page).toHaveURL(/\/posts\/dolomites-hut-to-hut$/);
    await expect(page).toHaveTitle("Hut to hut across the Dolomites · Long Way Round");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Hut to hut across the Dolomites",
    );
    await expect(page.locator(".hero time")).toHaveText("9 May 2026");
    // The cover keeps its view-transition-name, so it morphs between the two pages.
    const cover = page.locator("img.cover");
    expect(await cover.evaluate((img) => getComputedStyle(img).viewTransitionName)).toBe(coverName);
    expect(coverName).toBe("cover-dolomites-hut-to-hut");

    // The Markdown body: a GFM table, a list and heading anchors, styled through :deep().
    const prose = page.locator(".prose");
    await expect(prose.locator("table tbody tr")).toHaveCount(5);
    await expect(prose.locator("h2#the-stages")).toBeVisible();
    expect(
      await prose
        .locator("h2")
        .first()
        .evaluate((h) => getComputedStyle(h).fontSize),
    ).not.toBe(await page.locator("body").evaluate((b) => getComputedStyle(b).fontSize));
    const toc = page.getByRole("navigation", { name: "On this page" });
    await screenshot(page, "post", true);
    await toc.getByRole("link", { name: "Notes for next time" }).click();
    await expect(page).toHaveURL(/#notes-for-next-time$/);

    const more = page.getByRole("navigation", { name: "More posts" });
    await more.getByRole("link", { name: /Older/ }).click();
    await expect(page).toHaveURL(/\/posts\/lisbon-on-foot$/);
    await page
      .getByRole("navigation", { name: "More posts" })
      .getByRole("link", { name: /Newer/ })
      .click();
    await expect(page).toHaveURL(/\/posts\/dolomites-hut-to-hut$/);
  });

  test("navigations are view-transitioned, and a link prefetches its page on hover", async ({
    page,
  }) => {
    const prefetched: string[] = [];
    page.on("request", (request) => {
      if (request.headers()["sec-purpose"]?.startsWith("prefetch")) {
        prefetched.push(new URL(request.url()).pathname);
      }
    });
    await page.goto("/");
    // lumen({ viewTransitions: true }): the document opts in (without reduced motion).
    const optedIn = await page.evaluate(() =>
      [...document.styleSheets].some((sheet) =>
        [...sheet.cssRules].some((rule) => rule.cssText.includes("@view-transition")),
      ),
    );
    expect(optedIn).toBe(true);
    // lumen({ prefetch: "hover" }), the default: speculation rules with moderate eagerness.
    await page.locator(".card.featured h2 a").hover();
    await expect.poll(() => prefetched).toEqual([`/posts/${NEWEST.slug}`]);
  });

  test("<Link prefetch> sets a link's prefetch apart from the default", async ({ page }) => {
    const prefetched: string[] = [];
    page.on("request", (request) => {
      if (request.headers()["sec-purpose"]?.startsWith("prefetch")) {
        prefetched.push(new URL(request.url()).pathname);
      }
    });
    await page.goto("/");
    const pager = page.getByRole("navigation", { name: "Journal pages" });
    // A pointer that only passes over a link: too short for moderate eagerness (hover), enough
    // for eager (viewport), which desktop Chromium triggers on a brief hover.
    const passOver = async (link: ReturnType<Page["locator"]>) => {
      await link.hover();
      await page.waitForTimeout(40);
      await page.mouse.move(0, 0);
    };
    // prefetch="none": never, however long the pointer rests on it. (Page 3: the browser prefetches
    // URLs, and "Older →" makes /page/2 a candidate, whichever link to it is hovered.)
    await pager.getByRole("link", { name: "3", exact: true }).hover();
    await page.waitForTimeout(500);
    // A plain link (the project default, hover) the pointer passes over.
    await passOver(page.locator(".card:not(.featured) h2 a").first());
    await page.waitForTimeout(500);
    expect(prefetched).toEqual([]);
    // prefetch="viewport": eager.
    await passOver(pager.getByRole("link", { name: "Older →" }));
    await expect.poll(() => prefetched).toEqual(["/page/2"]);
    // The pager ships no JavaScript: <Link> on an MPA page renders a plain <a>.
    await expect(pager.locator("a[data-l-prefetch]")).toHaveCount(4);
  });

  test("tags list their posts", async ({ page }) => {
    await page.goto("/tags");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tags");
    await expect(page.getByRole("link", { name: /^Islands 3 posts$/ })).toBeVisible();
    await page.getByRole("link", { name: /^Islands/ }).click();

    await expect(page).toHaveURL(/\/tags\/islands$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Islands");
    await expect(page.locator(".card h2")).toHaveText([
      "Seven days of fog in the Faroe Islands",
      "Lofoten in February",
      "Walking the Isle of Skye",
    ]);
    await screenshot(page, "tag");
    await page
      .locator(".card", { hasText: "Lofoten" })
      .getByRole("link", { name: "Winter" })
      .click();
    await expect(page).toHaveURL(/\/tags\/winter$/);
    await expect(page.locator(".card")).toHaveCount(2);
    await page.getByRole("link", { name: "All tags" }).click();
    await expect(page).toHaveURL(/\/tags$/);
  });

  test("the archive lists every post by year", async ({ page }) => {
    await page.goto("/archive");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["2026", "2025"]);
    await expect(page.locator(".archive li")).toHaveCount(POSTS);
    await page.getByRole("link", { name: SKYE.title }).click();
    await expect(page).toHaveURL(new RegExp(`/posts/${SKYE.slug}$`));
  });

  test("unknown paths get the 404 page", async ({ page }) => {
    const response = await page.goto("/posts/does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle("Page not found · Long Way Round");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "This page took a wrong turn.",
    );
    await expect(page.locator(".not-found li")).toHaveCount(3);
    await screenshot(page, "404");
    await page.getByRole("link", { name: "Back to the journal" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("islands", () => {
  test("search finds posts as you type", async ({ page }) => {
    await page.goto("/about");
    await islandsReady(page);
    const input = page.getByRole("combobox", { name: "Search the journal" });
    const results = page.getByRole("listbox", { name: "Posts" });

    await input.fill("island");
    await expect(results.getByRole("option")).toHaveCount(3);
    await expect(input).toHaveAttribute("aria-expanded", "true");
    await screenshot(page, "search");

    await input.fill("skye cliffs");
    await expect(results.getByRole("option")).toHaveText([/Walking the Isle of Skye/]);
    await input.fill("zzz");
    await expect(page.getByRole("status")).toHaveText("No posts match “zzz”.");
    await input.press("Escape");
    await expect(page.locator(".search .panel")).toBeHidden();

    await input.fill("night");
    await input.press("ArrowDown");
    await expect(results.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
    await input.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/posts/${NEWEST.slug}$`));
  });

  test("the theme toggle cycles system, light and dark, and remembers the choice", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await islandsReady(page);
    const html = page.locator("html");
    const toggle = page.locator("button.toggle");
    const background = () =>
      page.locator("body").evaluate((body) => getComputedStyle(body).backgroundColor);
    const light = await background();
    await expect(toggle).toHaveAttribute("aria-label", "System theme: switch to light theme");

    await toggle.click();
    await expect(html).toHaveAttribute("data-theme", "light");
    await toggle.click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    expect(await background()).not.toBe(light);

    // The inline script in document.tsx applies the stored choice before the islands load.
    await page.goto("/archive");
    await expect(html).toHaveAttribute("data-theme", "dark");
    await islandsReady(page);
    await expect(toggle).toHaveAttribute("aria-label", "Dark theme: switch to system theme");
    await page.goto("/");
    await islandsReady(page);
    await screenshot(page, "dark");
    await toggle.click();
    await expect(html).not.toHaveAttribute("data-theme");
    expect(await background()).toBe(light);
  });
});

test.describe("feeds", () => {
  test("RSS lists every post with absolute links", async ({ request }) => {
    const response = await request.get("/rss.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");
    const xml = await response.text();
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="utf-8"\?>\n<rss version="2.0"/);
    expect(xml.match(/<item>/g)).toHaveLength(POSTS);
    expect(xml).toContain(`<title>${NEWEST.title}</title>`);
    expect(xml).toContain(`<link>https://long-way-round.example/posts/${NEWEST.slug}</link>`);
    expect(xml).toContain("<pubDate>Fri, 18 Sep 2026 00:00:00 GMT</pubDate>");
    expect(xml).toContain("<content:encoded><![CDATA[<p>The ticket said");
  });

  test("the sitemap lists every page", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    const origin = "https://long-way-round.example";
    expect(locs).toContain(`${origin}/`);
    expect(locs).toContain(`${origin}/page/3`);
    expect(locs).toContain(`${origin}/posts/${SKYE.slug}`);
    expect(locs).toContain(`${origin}/tags/islands`);
    expect(locs).toContain(`${origin}/archive`);
    // 3 journal pages, the posts, /tags, 10 tag pages, /archive and /about.
    expect(locs).toHaveLength(3 + POSTS + 1 + 10 + 2);
    for (const loc of locs) {
      const response = await request.get(new URL(loc!).pathname);
      expect(response.status(), loc).toBe(200);
    }
  });

  test("the search index has one entry per post", async ({ request }) => {
    const index = (await (await request.get("/search.json")).json()) as { url: string }[];
    expect(index).toHaveLength(POSTS);
    expect(index[0]).toEqual({
      url: `/posts/${NEWEST.slug}`,
      title: NEWEST.title,
      summary: expect.stringContaining("couchette"),
      tags: ["trains", "cities", "slow-travel"],
      date: "2026-09-18",
    });
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("pages, links and the search form still work", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".card")).toHaveCount(4);
    // The theme toggle needs JavaScript: it keeps its space but stays invisible.
    await expect(page.locator("button.toggle")).toBeHidden();
    await page.getByRole("link", { name: "Tags", exact: true }).click();
    await expect(page).toHaveURL(/\/tags$/);
    // The search form falls back to the archive, which lists every post.
    const input = page.getByRole("combobox", { name: "Search the journal" });
    await input.fill("lofoten");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/archive\?q=lofoten$/);
    await expect(page.locator(".archive li")).toHaveCount(POSTS);
  });
});

test.describe("small screens", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the layout stacks", async ({ page }) => {
    await page.goto("/posts/oaxaca-market-mornings");
    await islandsReady(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Market mornings in Oaxaca");
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
    await screenshot(page, "mobile");
  });
});
