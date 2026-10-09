// Conformance suite of the Tracker app (doc-4 §5). It runs against one production server, chosen by
// BENCH_BASE_URL (default the Lumen app on :4101), and only uses the landmarks of landmarks.ts, so
// every app must pass it unchanged. Tests that mutate data create their own issue first, so they do
// not depend on each other or on the seed beyond its shape. Set BENCH_EXPECT_STREAMING=1 when the
// server runs with COMMENTS_DELAY_MS > 0 to also check that comments stream after the shell.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { PRIORITIES, STATUSES, tid } from "./landmarks.ts";

declare global {
  interface Window {
    __benchReady?: number;
  }
}

const integer = (text: string | null): number => {
  const match = /\d+/.exec(text ?? "");
  if (match === null) throw new Error(`no integer in ${JSON.stringify(text)}`);
  return Number(match[0]);
};

async function ready(page: Page): Promise<void> {
  // oxlint-disable-next-line no-underscore-dangle -- the readiness mark of doc-4 §4
  await page.waitForFunction(() => typeof window.__benchReady === "number");
}

/** Navigates and waits until the page's interactive parts are ready. */
async function open(page: Page, path: string, status = 200): Promise<void> {
  const response = await page.goto(path);
  expect(response?.status(), `status of ${path}`).toBe(status);
  await ready(page);
}

async function firstProjectSlug(page: Page): Promise<string> {
  await open(page, "/");
  const href = await page.locator(tid("sidebar-project")).first().getAttribute("href");
  return /\/projects\/([^/?#]+)/.exec(href ?? "")![1]!;
}

async function issueIds(rows: Locator): Promise<number[]> {
  return (await rows.evaluateAll((els) => els.map((el) => el.getAttribute("data-id")))).map(Number);
}

let users: string[] | undefined;

/** Signs in through the login form as a seeded user (the reporter of an existing issue). */
async function login(page: Page): Promise<string> {
  if (users === undefined) {
    await open(page, "/");
    const href = await page
      .locator(`${tid("recent-issue")} ${tid("issue-link")}`)
      .first()
      .getAttribute("href");
    await open(page, href!);
    users = [(await page.locator(tid("issue-reporter")).innerText()).trim()];
  }
  const name = users[0]!;
  await open(page, "/login");
  await page.locator(`${tid("login-form")} [name="username"]`).fill(name);
  await page
    .locator(`${tid("login-form")} [type="submit"], ${tid("login-form")} button`)
    .first()
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(tid("current-user"))).toHaveText(name);
  return name;
}

let created = 0;

/** Fills the new-issue form (already open) with valid values. */
async function fillNewIssue(page: Page, title: string): Promise<void> {
  const form = page.locator(tid("new-issue-form"));
  await form.locator('[name="title"]').fill(title);
  await form.locator('[name="body"]').fill(`Created by the conformance suite: ${title}.`);
  const projects = await form
    .locator('select[name="project"] option')
    .evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value).filter((v) => v !== ""));
  await form.locator('select[name="project"]').selectOption(projects[0]!);
  await form.locator('select[name="priority"]').selectOption("high");
}

/** Creates an issue through the form (signed in) and returns its id. */
async function createIssue(page: Page): Promise<{ id: number; title: string }> {
  const title = `Conformance ${Date.now().toString(36)} ${created++}`;
  await open(page, "/issues/new");
  await fillNewIssue(page, title);
  await page
    .locator(
      `${tid("new-issue-form")} button[type="submit"], ${tid("new-issue-form")} button:not([type])`,
    )
    .last()
    .click();
  await expect(page).toHaveURL(/\/issues\/\d+$/);
  await ready(page);
  return { id: Number(/\/issues\/(\d+)$/.exec(page.url())![1]), title };
}

function submitButton(form: Locator): Locator {
  return form.locator('button[type="submit"], button:not([type]), input[type="submit"]').last();
}

test.beforeEach(({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.text().startsWith("Failed to load resource")) return; // 404 pages log this
    throw new Error(`console error: ${message.text()}`);
  });
});

test.describe("layout", () => {
  test("every page has the header, the sidebar with 12 projects and the footer", async ({
    page,
  }) => {
    for (const path of ["/", "/search", "/login", "/issues/new"]) {
      await open(page, path);
      await expect(page.locator(tid("site-header"))).toBeVisible();
      await expect(page.locator(tid("nav-home"))).toHaveAttribute("href", "/");
      await expect(page.locator(tid("nav-search"))).toHaveAttribute("href", "/search");
      await expect(page.locator(tid("nav-new-issue"))).toHaveAttribute("href", "/issues/new");
      await expect(page.locator(tid("login-link"))).toHaveAttribute("href", "/login");
      await expect(page.locator(tid("current-user"))).toHaveCount(0);
      await expect(page.locator(tid("sidebar-project"))).toHaveCount(12);
      for (const count of await page.locator(tid("sidebar-project-count")).allInnerTexts()) {
        expect(count.trim()).toMatch(/^\d+$/);
      }
      await expect(page.locator(tid("site-footer"))).toBeVisible();
      await expect(page.locator(tid("page-title"))).toHaveCount(1);
    }
  });

  test("an unknown URL renders the 404 page inside the layout", async ({ page }) => {
    await open(page, "/no/such/page", 404);
    await expect(page.locator(tid("not-found"))).toBeVisible();
    await expect(page.locator(tid("sidebar-project"))).toHaveCount(12);
  });
});

test.describe("dashboard", () => {
  test("shows stat cards, the project table and the 10 recent issues", async ({ page }) => {
    await open(page, "/");
    const value = async (id: string) =>
      integer(await page.locator(`${tid(id)} ${tid("stat-value")}`).innerText());
    let byStatus = 0;
    for (const status of STATUSES) byStatus += await value(`stat-status-${status}`);
    let byPriority = 0;
    for (const priority of PRIORITIES) byPriority += await value(`stat-priority-${priority}`);
    expect(byStatus).toBeGreaterThanOrEqual(6000);
    expect(byPriority).toBe(byStatus);
    await expect(page.locator(tid("project-row"))).toHaveCount(12);
    await expect(page.locator(tid("recent-issue"))).toHaveCount(10);
    for (const href of await page
      .locator(`${tid("recent-issue")} ${tid("issue-link")}`)
      .evaluateAll((els) => els.map((el) => el.getAttribute("href")))) {
      expect(href).toMatch(/^\/issues\/\d+$/);
    }
  });
});

test.describe("project issues", () => {
  test("lists 50 issues with pagination", async ({ page }) => {
    const slug = await firstProjectSlug(page);
    await open(page, `/projects/${slug}`);
    const total = integer(await page.locator(tid("issue-total")).innerText());
    expect(total).toBeGreaterThan(150);
    const rows = page.locator(tid("issue-row"));
    await expect(rows).toHaveCount(50);
    const first = rows.first();
    const id = await first.getAttribute("data-id");
    await expect(first.locator(tid("issue-link"))).toHaveAttribute("href", `/issues/${id}`);
    await expect(first.locator(tid("issue-select"))).toHaveAttribute("value", id!);
    expect(STATUSES).toContain(
      await first.locator(tid("issue-status")).getAttribute("data-status"),
    );
    expect(PRIORITIES).toContain(
      await first.locator(tid("issue-priority")).getAttribute("data-priority"),
    );
    await expect(page.locator(tid("page-current"))).toHaveText("1");
    await expect(page.locator(tid("page-prev"))).toHaveCount(0);
    await expect(page.locator(tid("page-next"))).toHaveAttribute("href", /page=2/);

    await open(page, `/projects/${slug}?page=3`);
    await expect(page.locator(tid("page-current"))).toHaveText("3");
    await expect(page.locator(tid("page-prev"))).toHaveAttribute("href", /page=2/);
    await expect(page.locator(tid("page-next"))).toHaveAttribute("href", /page=4/);
    const page3 = await issueIds(rows);
    expect(page3).toHaveLength(50);
    expect(page3).not.toContain(Number(id));
  });

  test("filters by status, priority, label and text, keeping filters in page links", async ({
    page,
  }) => {
    const slug = await firstProjectSlug(page);
    const rows = page.locator(tid("issue-row"));

    await open(page, `/projects/${slug}?status=closed`);
    for (const status of await rows
      .locator(tid("issue-status"))
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-status")))) {
      expect(status).toBe("closed");
    }
    await open(page, `/projects/${slug}?priority=urgent`);
    for (const priority of await rows
      .locator(tid("issue-priority"))
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-priority")))) {
      expect(priority).toBe("urgent");
    }

    // The filter form is a GET form: submitting it puts the filters in the URL.
    await open(page, `/projects/${slug}`);
    const unfiltered = integer(await page.locator(tid("issue-total")).innerText());
    const form = page.locator(tid("filter-form"));
    await form.locator('[name="status"]').selectOption("open");
    const labels = await form
      .locator('select[name="label"] option')
      .evaluateAll((els) =>
        els.map((el) => (el as HTMLOptionElement).value).filter((v) => v !== ""),
      );
    expect(labels.length).toBe(15);
    await form.locator('[name="label"]').selectOption(labels[0]!);
    await form.locator('[name="sort"]').selectOption("created");
    await submitButton(form).click();
    await expect(page).toHaveURL(/status=open/);
    await expect(page).toHaveURL(new RegExp(`label=${encodeURIComponent(labels[0]!)}`));
    await expect(page).toHaveURL(/sort=created/);
    await ready(page);
    const filtered = integer(await page.locator(tid("issue-total")).innerText());
    expect(filtered).toBeLessThan(unfiltered);
    expect(filtered).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(await rows.count(), 10); i++) {
      await expect(rows.nth(i).locator(tid("issue-status"))).toHaveAttribute("data-status", "open");
      expect(await rows.nth(i).locator(tid("label-chip")).count()).toBeGreaterThan(0);
    }
    if (filtered > 50) {
      await expect(page.locator(tid("page-next"))).toHaveAttribute("href", /status=open/);
    }

    // Text search within the project.
    const word = (await rows.first().locator(tid("issue-link")).innerText()).split(/\s+/)[0]!;
    await open(page, `/projects/${slug}?q=${encodeURIComponent(word)}`);
    const matches = integer(await page.locator(tid("issue-total")).innerText());
    expect(matches).toBeGreaterThan(0);
    expect(matches).toBeLessThan(unfiltered);
  });

  test("an unknown project is a 404", async ({ page }) => {
    await open(page, "/projects/no-such-project", 404);
    await expect(page.locator(tid("not-found"))).toBeVisible();
  });
});

test.describe("issue page", () => {
  test("shows the issue, its sidebar and the streamed comments", async ({ page, request }) => {
    const slug = await firstProjectSlug(page);
    await open(page, `/projects/${slug}`);
    const link = page.locator(tid("issue-link")).first();
    const title = (await link.innerText()).trim();
    const href = (await link.getAttribute("href"))!;

    await open(page, href);
    await expect(page.locator(tid("page-title"))).toHaveText(title);
    expect(STATUSES).toContain(await page.locator(tid("issue-status")).getAttribute("data-status"));
    expect(PRIORITIES).toContain(
      await page.locator(tid("issue-priority")).getAttribute("data-priority"),
    );
    expect((await page.locator(tid("issue-body")).innerText()).length).toBeGreaterThan(100);
    await expect(page.locator(tid("issue-labels"))).toHaveCount(1);
    await expect(page.locator(tid("issue-project"))).toHaveAttribute("href", `/projects/${slug}`);
    for (const id of ["issue-assignee", "issue-reporter", "issue-created", "issue-updated"]) {
      await expect(page.locator(tid(id))).toHaveCount(1);
    }
    await expect(page.locator(`${tid("comment-list")}, ${tid("comments-empty")}`)).toBeVisible();
    await expect(page.locator(tid("comments-fallback"))).toHaveCount(0);
    for (const comment of await page.locator(tid("comment")).all()) {
      expect((await comment.locator(tid("comment-author")).innerText()).trim()).not.toBe("");
      expect((await comment.locator(tid("comment-body")).innerText()).trim()).not.toBe("");
    }

    if (process.env.BENCH_EXPECT_STREAMING === "1") {
      const html = await (await request.get(href)).text();
      const fallback = html.indexOf('data-testid="comments-fallback"');
      expect(fallback).toBeGreaterThan(-1);
      const firstComment = html.search(/data-testid="(comment|comments-empty)"/);
      expect(firstComment).toBeGreaterThan(fallback);
    }

    const api = await request.get(`/api${href}`);
    expect(api.status()).toBe(200);
    const json = (await api.json()) as { id: number; title: string; status: string };
    expect(json.id).toBe(Number(href.split("/").pop()));
    expect(json.title).toBe(title);
  });

  test("unknown issues are 404s", async ({ page, request }) => {
    await open(page, "/issues/999999", 404);
    await expect(page.locator(tid("not-found"))).toBeVisible();
    await open(page, "/issues/abc", 404);
    expect((await request.get("/api/issues/999999")).status()).toBe(404);
  });
});

test.describe("search", () => {
  test("the search page renders results and the box suggests issues", async ({ page, request }) => {
    const slug = await firstProjectSlug(page);
    await open(page, `/projects/${slug}`);
    const word = (await page.locator(tid("issue-link")).first().innerText()).split(/\s+/)[0]!;

    const api = await request.get(`/api/search?q=${encodeURIComponent(word)}`);
    expect(api.status()).toBe(200);
    const results = (await api.json()) as unknown[];
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(8);

    await open(page, "/search");
    await expect(page.locator(tid("search-result"))).toHaveCount(0);
    const input = page.locator(`${tid("search-form")} [name="q"]`);
    await input.pressSequentially(word, { delay: 20 });
    const suggestions = page.locator(tid("search-suggestion"));
    await expect(suggestions.first()).toBeVisible();
    expect(await suggestions.count()).toBeLessThanOrEqual(8);
    await expect(suggestions.first()).toHaveAttribute("href", /^\/issues\/\d+$/);

    await input.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/search\\?q=${encodeURIComponent(word)}`));
    await ready(page);
    expect(await page.locator(tid("search-result")).count()).toBeGreaterThan(0);
    await expect(
      page.locator(`${tid("search-result")} ${tid("issue-link")}`).first(),
    ).toHaveAttribute("href", /^\/issues\/\d+$/);
  });
});

test.describe("session", () => {
  test("login rejects unknown users, then signs in and out", async ({ page }) => {
    await open(page, "/login");
    await page.locator(`${tid("login-form")} [name="username"]`).fill("nobody-by-this-name");
    await submitButton(page.locator(tid("login-form"))).click();
    await expect(page.locator(tid("field-error-username"))).not.toBeEmpty();
    await expect(page.locator(tid("current-user"))).toHaveCount(0);

    const name = await login(page);
    await expect(page.locator(tid("login-link"))).toHaveCount(0);
    await ready(page);
    await submitButton(page.locator(tid("logout-form"))).click();
    await expect(page.locator(tid("login-link"))).toBeVisible();
    await expect(page.locator(tid("current-user"))).toHaveCount(0);
    expect(name).not.toBe("");
  });

  test("every action redirects to /login without a session", async ({ page }) => {
    // New issue.
    await open(page, "/issues/new");
    await fillNewIssue(page, "Signed out");
    await submitButton(page.locator(tid("new-issue-form"))).click();
    await expect(page).toHaveURL(/\/login$/);

    // Status form and comment composer of an existing issue.
    const slug = await firstProjectSlug(page);
    await open(page, `/projects/${slug}?status=open`);
    const href = (await page.locator(tid("issue-link")).first().getAttribute("href"))!;
    await open(page, href);
    await page.locator(`${tid("status-form")} [name="status"]`).selectOption("closed");
    await submitButton(page.locator(tid("status-form"))).click();
    await expect(page).toHaveURL(/\/login$/);
    await open(page, href);
    await expect(page.locator(tid("issue-status"))).not.toHaveAttribute("data-status", "closed");
    await page.locator(`${tid("comment-form")} [name="body"]`).fill("Signed out comment");
    await submitButton(page.locator(tid("comment-form"))).click();
    await expect(page).toHaveURL(/\/login$/);

    // Bulk close.
    await open(page, `/projects/${slug}?status=open`);
    await page.locator(tid("issue-select")).first().check();
    await page.locator(tid("close-selected")).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("actions", () => {
  test("new issue: validation errors, label picker and redirect to the issue", async ({ page }) => {
    const user = await login(page);
    await open(page, "/issues/new");
    const form = page.locator(tid("new-issue-form"));
    await submitButton(form).click();
    await expect(page.locator(tid("field-error-title"))).not.toBeEmpty();
    await expect(page).toHaveURL(/\/issues\/new$/);
    await ready(page);

    const options = page.locator(tid("label-option"));
    await expect(options).toHaveCount(15);
    const labels = [
      await options.nth(1).getAttribute("data-label"),
      await options.nth(4).getAttribute("data-label"),
    ];
    await options.nth(1).click();
    await options.nth(4).click();
    await options.nth(7).click();
    await options.nth(7).click(); // toggles back off
    await expect(options.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(options.nth(7)).toHaveAttribute("aria-pressed", "false");
    await expect(form.locator('input[name="labels"]')).toHaveValue(labels.join(","));

    const title = `Conformance new ${Date.now().toString(36)}`;
    await fillNewIssue(page, title);
    await submitButton(form).click();
    await expect(page).toHaveURL(/\/issues\/\d+$/);
    await ready(page);
    await expect(page.locator(tid("page-title"))).toHaveText(title);
    await expect(page.locator(tid("issue-status"))).toHaveAttribute("data-status", "open");
    await expect(page.locator(tid("issue-priority"))).toHaveAttribute("data-priority", "high");
    await expect(page.locator(`${tid("issue-labels")} ${tid("label-chip")}`)).toHaveCount(2);
    await expect(page.locator(tid("issue-reporter"))).toHaveText(user);
    await expect(page.locator(tid("comments-empty"))).toBeVisible();
  });

  test("the status form changes the status", async ({ page, request }) => {
    await login(page);
    const { id } = await createIssue(page);
    await page.locator(`${tid("status-form")} [name="status"]`).selectOption("in_progress");
    await submitButton(page.locator(tid("status-form"))).click();
    await expect(page.locator(tid("issue-status"))).toHaveAttribute("data-status", "in_progress");
    const json = (await (await request.get(`/api/issues/${id}`)).json()) as { status: string };
    expect(json.status).toBe("in_progress");
  });

  test("the comment composer counts characters and posts a comment", async ({ page }) => {
    await login(page);
    await createIssue(page);
    const form = page.locator(tid("comment-form"));
    const body = `Looks good ${Date.now().toString(36)}`;
    await form.locator('[name="body"]').fill(body);
    await expect(form.locator(tid("char-count"))).toContainText(String(body.length));
    await submitButton(form).click();
    await expect(page.locator(`${tid("comment")} ${tid("comment-body")}`).last()).toHaveText(body);
    await expect(page.locator(tid("comment"))).toHaveCount(1);
    await ready(page);
    await expect(page.locator(`${tid("comment-form")} [name="body"]`)).toHaveValue("");
  });

  test("bulk select closes the selected issues and refreshes the list", async ({
    page,
    request,
  }) => {
    await login(page);
    const slug = await firstProjectSlug(page);
    await open(page, `/projects/${slug}?status=open`);
    const rows = page.locator(tid("issue-row"));
    const ids = (await issueIds(rows)).slice(0, 2);
    await expect(page.locator(tid("selected-count"))).toContainText("0");
    for (const id of ids)
      await page.locator(`${tid("issue-row")}[data-id="${id}"] ${tid("issue-select")}`).check();
    await expect(page.locator(tid("selected-count"))).toContainText("2 selected");
    await page.locator(tid("close-selected")).click();
    for (const id of ids)
      await expect(page.locator(`${tid("issue-row")}[data-id="${id}"]`)).toHaveCount(0);
    await ready(page);
    await expect(page.locator(tid("selected-count"))).toContainText("0");
    for (const id of ids) {
      const json = (await (await request.get(`/api/issues/${id}`)).json()) as { status: string };
      expect(json.status).toBe("closed");
    }
  });
});
