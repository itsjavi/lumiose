// TASK-25 end to end: an spa-mode app on file routes, server-rendered and hydrated, navigating on
// the client with lumiose/router. Each spec runs under `lumiose dev` and against a production build.
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

test("deep links render on the server and hydrate", async ({ page }) => {
  const html = await (await page.request.get("/users/2")).text();
  expect(html).toMatch(/<h1 id=user>(<!--\[-->)?User 2/);
  expect(html).toContain("#lumiose:spa");
  await page.goto("/users/2");
  await ready(page);
  await expect(page.locator("#user")).toHaveText("User 2");
  await expect(page.locator("#users-param")).toHaveText("param 2");
  // The await was replayed from the server's record: the page did not load the user again.
  await expect(page.locator("#hits")).toHaveText(/^load \d+$/);
  await expect(page).toHaveTitle("User 2");
});

test("client navigation keeps persistent layouts and their state", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await page.getByRole("link", { name: "User 1", exact: true }).click();
  await expect(page.locator("#user")).toHaveText("User 1");
  await expect(page.locator("#url")).toHaveText("/users/1");
  await expect(page).toHaveTitle("User 1");
  await expect(page.locator("#root-count")).toHaveText("root 1");
  await expect(page.getByRole("link", { name: "User 1", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.locator("#users-count").click();
  await page.getByRole("link", { name: "User 2", exact: true }).click();
  await expect(page.locator("#user")).toHaveText("User 2");
  await expect(page.locator("#users-param")).toHaveText("param 2");
  // The nested layout stayed mounted, so its counter kept its value.
  await expect(page.locator("#users-count")).toHaveText("users 1");

  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.locator("#home")).toBeVisible();
  await page.locator("#go").click();
  await expect(page.locator("#user")).toHaveText("User 2");
  await expect(page.locator("#users-count")).toHaveText("users 0");
  await expect(page.locator("#root-count")).toHaveText("root 1");
  expect(await sameDocument(page)).toBe(true);
});

/** The document's title and its one description. */
async function expectHead(page: Page, title: string, description: string): Promise<void> {
  await expect(page).toHaveTitle(title);
  const metas = page.locator('head meta[name="description"]');
  await expect(metas).toHaveCount(1);
  await expect(metas).toHaveAttribute("content", description);
  await expect(page.locator("head title")).toHaveCount(1);
}

test("the document's head defaults come back on pages without their own (TASK-256)", async ({
  page,
}) => {
  // The user page replaces the document's title and description; its tags carry them.
  const html = await (await page.request.get("/users/1")).text();
  expect(html).toContain("<title data-l-default='&lt;title&gt;SPA router e2e&lt;/title&gt;'>");
  expect(html.match(/<meta name="description"/g)).toHaveLength(1);
  await page.goto("/users/1");
  await ready(page);
  await expectHead(page, "User 1", "Profile of User 1");
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.locator("#home")).toBeVisible();
  await expectHead(page, "SPA router e2e", "An spa-mode fixture");
  await page.getByRole("link", { name: "User 2", exact: true }).click();
  await expectHead(page, "User 2", "Profile of User 2");
  await page.getByRole("link", { name: "Home" }).click();
  await expectHead(page, "SPA router e2e", "An spa-mode fixture");
  expect(await sameDocument(page)).toBe(true);
});

test("hreflang alternates and the canonical follow client navigations (TASK-263)", async ({
  page,
  baseURL,
}) => {
  const links = () =>
    page.evaluate(() =>
      Array.from(
        document.head.querySelectorAll<HTMLLinkElement>("link[hreflang],link[rel=canonical]"),
        (el) => `${el.rel} ${el.hreflang} ${el.getAttribute("href")}`,
      ),
    );
  await page.goto("/users/1");
  await ready(page);
  // The server's links.
  expect(await links()).toEqual([
    `canonical  ${baseURL}/users/1`,
    `alternate en ${baseURL}/users/1`,
    `alternate es ${baseURL}/es/users/1`,
  ]);
  await page.getByRole("link", { name: "User 2", exact: true }).click();
  await expect(page.locator("#user")).toHaveText("User 2");
  await expect
    .poll(links)
    .toEqual([
      `alternate en ${baseURL}/users/2`,
      `alternate es ${baseURL}/es/users/2`,
      `canonical  ${baseURL}/users/2`,
    ]);
  // Home exists in English only: no links.
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.locator("#home")).toBeVisible();
  await expect.poll(links).toEqual([]);
  expect(await sameDocument(page)).toBe(true);
});

test("a navigation holds the old page until the new page's data is ready", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await page.getByRole("link", { name: "User 3 (slow)" }).click();
  await expect(page.locator("#status")).toHaveText("navigating");
  await expect(page.locator("#home")).toBeVisible();
  await expect(page.locator("#url")).toHaveText("/");
  await expect(page.locator("#user")).toHaveText("User 3");
  await expect(page.locator("#home")).toHaveCount(0);
  await expect(page.locator("#status")).toHaveText("idle");
  await expect(page.locator("#url")).toHaveText("/users/3");
});

test("invalidate() re-runs the page's async components", async ({ page }) => {
  await page.goto("/users/1");
  await ready(page);
  const before = Number((await page.locator("#hits").textContent())!.slice(5));
  await page.locator("#refresh").click();
  await expect(page.locator("#hits")).toHaveText(`load ${before + 1}`);
  await expect(page.locator("#user")).toHaveText("User 1");
});

test("hydrates from the server's entry; invalidate(url) refetches it; back shows it at once", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) requests.push(request.url());
  });
  await page.goto("/users/1");
  await ready(page);
  // The SPA hydrated from the server's cache entry, without fetching it again.
  expect(requests).toEqual([]);
  const before = Number((await page.locator("#hits").textContent())!.slice(5));
  await page.locator("#refetch").click();
  await expect(page.locator("#hits")).toHaveText(`load ${before + 1}`);
  expect(requests.map((url) => new URL(url).pathname)).toEqual(["/api/users/1"]);
  // Away and back: the cached user shows at once, then the background refetch updates it.
  await page.locator("a[href='/']").first().click();
  await expect(page.locator("#url")).toHaveText("/");
  await page.goBack();
  await expect(page.locator("#user")).toHaveText("User 1");
  await expect(page.locator("#hits")).toHaveText(`load ${before + 2}`);
  expect(await sameDocument(page)).toBe(true);
});

test("back and forward restore pages and scroll positions", async ({ page }) => {
  await page.goto("/long");
  await ready(page);
  await page.locator("#bottom-link").scrollIntoViewIfNeeded();
  const scrolled = await page.evaluate(() => scrollY);
  expect(scrolled).toBeGreaterThan(1000);
  await page.locator("#bottom-link").click();
  await expect(page.locator("#user")).toHaveText("User 1");
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.goBack();
  await expect(page.locator("#long")).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(scrolled);
  await page.goForward();
  await expect(page.locator("#user")).toHaveText("User 1");
  expect(await sameDocument(page)).toBe(true);
});

/**
 * The slow page's module: src/routes/slow/page.tsx in dev, a page-[hash].js chunk in the build (the
 * home page's chunk loaded before the test listens).
 */
const pageModule = (path: string) => path.includes("slow") || /\/page-[\w-]+\.js$/.test(path);

test("<Link> prefetches on hover; a page's own <Suspense> shows its fallback", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  const requested: string[] = [];
  page.on("request", (request) => requested.push(new URL(request.url()).pathname));
  await page.getByRole("link", { name: "Suspense" }).hover();
  await expect.poll(() => requested.some(pageModule)).toBe(true);
  const count = requested.length;
  await page.getByRole("link", { name: "Suspense" }).click();
  await expect(page.locator("#slow")).toBeVisible();
  await expect(page.locator("#slow-fallback")).toBeVisible();
  await expect(page.locator("#slow-content")).toBeVisible();
  // The click loaded nothing more: the module was prefetched.
  expect(requested.slice(count).filter(pageModule)).toEqual([]);
});

test("unknown URLs render the not-found page inside the SPA", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await page.getByRole("link", { name: "Missing" }).click();
  await expect(page.locator("#not-found")).toHaveText("404 Not Found");
  await expect(page.locator("#root-count")).toHaveText("root 1");
  expect(await sameDocument(page)).toBe(true);

  const response = await page.goto("/also/missing");
  expect(response?.status()).toBe(404);
  await expect(page.locator("#not-found")).toHaveText("404 Not Found");
  await ready(page);
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.locator("#home")).toBeVisible();
  expect(await sameDocument(page)).toBe(true);
});

test("searchParams() follows the query and searchParams.set() changes it", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await page.getByRole("link", { name: "Search" }).click();
  await expect(page.locator("#q")).toHaveText("q=a");
  await page.locator("#more").click();
  await expect(page.locator("#q")).toHaveText("q=ab");
  await expect(page).toHaveURL(/\/search\?q=ab$/);
  await page.goBack();
  await expect(page.locator("#q")).toHaveText("q=a");
  expect(await sameDocument(page)).toBe(true);
});

test("links outside the SPA load the document", async ({ page }) => {
  await page.goto("/");
  await ready(page);
  await page.getByRole("link", { name: "Static page" }).click();
  await expect(page.locator("#static")).toBeVisible();
  expect(await sameDocument(page)).toBe(false);
});

test("ssr = false pages are client-rendered shells", async ({ page }) => {
  const html = await (await page.request.get("/csr")).text();
  expect(html).toContain("#lumiose:csr");
  expect(html).not.toContain("rendered in");
  await page.goto("/csr");
  await expect(page.locator("#csr")).toHaveText("rendered in the browser");
  await ready(page);
  await page.getByRole("link", { name: "User 1", exact: true }).click();
  await expect(page.locator("#user")).toHaveText("User 1");
  await page.getByRole("link", { name: "Client-rendered" }).click();
  await expect(page.locator("#csr")).toHaveText("rendered in the browser");
  expect(await sameDocument(page)).toBe(true);
});

test("@lumiose/query: shared query, reactive key and a mutation that invalidates", async ({
  page,
}) => {
  const html = await (await page.request.get("/query")).text();
  expect(html).toMatch(/<p id="?query-a"?>(<!--\[-->)?loading/);
  await page.goto("/query");
  await ready(page);
  await expect(page.locator("#query-a")).toHaveText(/^User 1 · load \d+$/);
  // Two cards with the same key: one fetch, so both show the same load.
  const first = await page.locator("#query-a").textContent();
  await expect(page.locator("#query-b")).toHaveText(first!);
  await page.locator("#query-user-2").click();
  await expect(page.locator("#query-a")).toHaveText(/^User 2 · load \d+$/);
  await expect(page.locator("#query-b")).toHaveText(/^User 2 /);
  const before = Number((await page.locator("#query-a").textContent())!.split("load ")[1]);
  await page.locator("#query-reload").click();
  await expect(page.locator("#query-a")).not.toHaveText(`User 2 · load ${before}`);
  const after = await page.locator("#query-a").textContent();
  expect(Number(after!.split("load ")[1])).toBeGreaterThan(before);
  await expect(page.locator("#query-b")).toHaveText(after!);
});

/** What the layout's afterNavigate saw (`type pathname`). */
function navigations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { navigations?: string[] }).navigations ?? []);
}

/**
 * TASK-296: the editor's beforeNavigate asks with confirm() inside the SPA (links, back/forward)
 * and lets the browser ask (beforeunload) for a link out of it; the layout's afterNavigate sees
 * each completed navigation once, and enter on the first load.
 */
async function guardsUnsavedChanges(page: Page): Promise<void> {
  await page.goto("/");
  await ready(page);
  await page.getByRole("link", { name: "Editor" }).click();
  await expect(page.locator("#editor")).toBeVisible();
  expect(await navigations(page)).toEqual(["enter /", "link /editor"]);
  await page.locator("#draft").fill("unsaved");
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.type());
    void dialog.dismiss();
  });

  await page.getByRole("link", { name: "User 1", exact: true }).click();
  await page.evaluate(() => history.back());
  await page.getByRole("link", { name: "Static page" }).click();
  await expect.poll(() => dialogs).toEqual(["confirm", "confirm", "beforeunload"]);
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.locator("#editor")).toBeVisible();
  expect(await sameDocument(page)).toBe(true);
  expect(await navigations(page)).toEqual(["enter /", "link /editor"]);

  page.removeAllListeners("dialog");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("link", { name: "User 1", exact: true }).click();
  await expect(page.locator("#user")).toHaveText("User 1");
  await page.goBack();
  await expect(page.locator("#editor")).toBeVisible();
  expect(await navigations(page)).toEqual([
    "enter /",
    "link /editor",
    "link /users/1",
    "popstate /editor",
  ]);
  expect(await sameDocument(page)).toBe(true);
}

test("beforeNavigate guards unsaved changes; afterNavigate follows navigations", async ({
  page,
}) => {
  await guardsUnsavedChanges(page);
});

test.describe("without the Navigation API", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "navigation", { value: undefined, configurable: true });
    });
  });

  test("the History API fallback routes links, back/forward and scroll", async ({ page }) => {
    await page.goto("/long");
    await ready(page);
    await page.locator("#bottom-link").scrollIntoViewIfNeeded();
    const scrolled = await page.evaluate(() => scrollY);
    await page.locator("#bottom-link").click();
    await expect(page.locator("#user")).toHaveText("User 1");
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    await page.getByRole("link", { name: "User 3 (slow)" }).click();
    await expect(page.locator("#status")).toHaveText("navigating");
    await expect(page.locator("#user")).toHaveText("User 3");
    await page.goBack();
    await expect(page.locator("#user")).toHaveText("User 1");
    await page.goBack();
    await expect(page.locator("#long")).toBeVisible();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(scrolled);
    expect(await sameDocument(page)).toBe(true);
  });

  test("the History API fallback runs beforeNavigate and afterNavigate", async ({ page }) => {
    await guardsUnsavedChanges(page);
  });
});
