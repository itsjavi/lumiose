// TASK-18 end to end: the server-rendered page hydrates in Chromium. The loader (and, for the
// replay test, the Counter module) is held back with `page.route` so the test can tag the server
// nodes first: after hydration the same nodes must still be in the document (claimed, not
// re-created) and the browser must not have requested `/api/` for data the server awaited.
import { expect, test, type Page, type Request, type Route } from "@playwright/test";

/** Holds requests matching `pattern` until `release()`. */
async function hold(page: Page, pattern: RegExp): Promise<() => void> {
  const held: Route[] = [];
  let released = false;
  await page.route(pattern, (route) => (released ? route.continue() : void held.push(route)));
  return () => {
    released = true;
    for (const route of held.splice(0)) void route.continue();
  };
}

/** The browser's `/api/` requests. */
function apiRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (request: Request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) urls.push(url.pathname);
  });
  return urls;
}

/** Marks every server-rendered node below `main` so the test can tell them from new ones. */
async function tagServerNodes(page: Page): Promise<number> {
  return page.evaluate(() => {
    let count = 0;
    const walker = document.createTreeWalker(document.querySelector("main")!, 1 | 4);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      (node as Node & { $server?: boolean }).$server = true;
      count++;
    }
    return count;
  });
}

/**
 * Whether every node matching `selector`, with its elements and non-empty texts, came from the
 * server. (Empty texts are the client's range markers, which replace the `<!--[-->` comments.)
 */
function fromServer(page: Page, selector: string): Promise<boolean[]> {
  return page.$$eval(selector, (elements) =>
    elements.map((el) => {
      const nodes: Node[] = [el];
      const walker = document.createTreeWalker(el, 1 | 4);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        if (node.nodeType === 1 || (node as Text).data !== "") nodes.push(node);
      }
      return nodes.every((node) => (node as Node & { $server?: boolean }).$server === true);
    }),
  );
}

const LOADER = /\/dom\/loader\.ts/;

test("islands hydrate on the server nodes, with no refetch, and keep working", async ({ page }) => {
  const api = apiRequests(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
  });
  const release = await hold(page, LOADER);

  // The whole stream (shell, then the slow member's Suspense content) arrives before hydration.
  // (`load` would wait for the held loader script.)
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".slow .member")).toHaveText("Slow Sam");
  expect(await tagServerNodes(page)).toBeGreaterThan(30);
  release();

  const counter = page.locator('.counter[data-label="load"]');
  await expect(counter).toHaveAttribute("data-hydrated", "");
  await expect(page.locator(".team")).toHaveAttribute("data-hydrated", "");

  // Claimed: the islands' elements and texts are the server's, including async content (await
  // records), the streamed Suspense content and the inline `children` slot.
  for (const selector of [
    '.counter[data-label="load"]',
    ".team",
    ".members .member",
    ".slow .member",
    ".profile",
    ".footer",
    ".greeting",
  ]) {
    expect(await fromServer(page, selector), selector).not.toContain(false);
  }
  // No refetch: every awaited value was replayed from the records.
  expect(api).toEqual([]);

  // State after hydration.
  await counter.click();
  await counter.click();
  await expect(counter).toHaveText("load: 5");

  // Reactive reads inside replayed awaits are tracked: a new id fetches once.
  await expect(page.locator(".profile")).toHaveText("Selected: Ada");
  await page.locator(".select").click();
  await expect(page.locator(".profile")).toHaveText("Selected: Bob");
  expect(api).toEqual(["/api/member/bob"]);

  // A slot the server did not render comes from its `<template data-l-slot>`.
  await expect(page.locator(".extra")).toHaveCount(0);
  await page.locator(".toggle-extra").click();
  await expect(page.locator(".extra em")).toHaveText("Extra slot");
  await page.locator(".toggle-extra").click();
  await expect(page.locator(".extra")).toHaveCount(0);
  await expect(page.locator(".footer")).toHaveText("Team footer slot");

  // The plain island hydrated too (its handler runs).
  await page.locator(".greeting").click();
  await expect(page.locator(".greeting")).toHaveText("clicked");

  expect(errors).toEqual([]);
});

test("islands hydrate while the stream arrives; one with streamed content waits for it", async ({
  page,
}) => {
  const api = apiRequests(page);
  // The slow member streams 2.5 s after the shell.
  await page.goto("/?slow=2500", { waitUntil: "commit" });
  const counter = page.locator('.counter[data-label="load"]');
  await expect(counter).toHaveAttribute("data-hydrated", "");
  // The stream is still open: the boundary shows its fallback, and Team waits for its content.
  await expect(page.locator(".loading")).toBeVisible();
  await expect(page.locator(".team")).not.toHaveAttribute("data-hydrated");
  await counter.click();
  await expect(counter).toHaveText("load: 4");

  await expect(page.locator(".slow .member")).toHaveText("Slow Sam");
  await expect(page.locator(".team")).toHaveAttribute("data-hydrated", "");
  await expect(page.locator(".loading")).toHaveCount(0);
  // Its await records came with the streamed chunk.
  expect(api).toEqual([]);
});

test("client:visible hydrates only once scrolled into view", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.counter[data-label="load"]')).toHaveAttribute("data-hydrated", "");
  const visible = page.locator('.counter[data-label="visible"]');
  // Give the observer a chance to (wrongly) fire before checking.
  await page.waitForTimeout(300);
  await expect(visible).not.toHaveAttribute("data-hydrated");
  await visible.scrollIntoViewIfNeeded();
  await expect(visible).toHaveAttribute("data-hydrated", "");
  await visible.click();
  await expect(visible).toHaveText("visible: 11");
});

test("clicks before hydration are replayed once the island hydrated", async ({ page }) => {
  const release = await hold(page, /\/src\/Counter\.stsx/);
  await page.goto("/");
  const counter = page.locator('.counter[data-label="load"]');
  // The Team island hydrates, so the loader is running; the Counter module is still held.
  await expect(page.locator(".team")).toHaveAttribute("data-hydrated", "");
  await expect(counter).not.toHaveAttribute("data-hydrated");
  await counter.click();
  await counter.click();
  await expect(counter).toHaveText("load: 3");
  release();
  await expect(counter).toHaveAttribute("data-hydrated", "");
  await expect(counter).toHaveText("load: 5");
});

test("a mismatch falls back to a client render, with LUM4006 in dev", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (message) => warnings.push(message.text()));
  await page.goto("/?mismatch");
  // The client renders `<em>` where the server sent `<span>`: the range is rendered again.
  await expect(page.locator("em.greeting")).toHaveText("Hello, world");
  await expect(page.locator("span.greeting")).toHaveCount(0);
  await page.locator("em.greeting").click();
  await expect(page.locator("em.greeting")).toHaveText("clicked");
  const lum4006 = warnings.filter((text) => text.includes("LUM4006"));
  expect(lum4006).toEqual([expect.stringContaining("hydration mismatch in island Greeting")]);
  // The other islands are unaffected.
  await page.locator('.counter[data-label="load"]').click();
  await expect(page.locator('.counter[data-label="load"]')).toHaveText("load: 4");
});
