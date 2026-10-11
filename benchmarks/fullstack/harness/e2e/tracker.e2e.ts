// Conformance suite of the Tracker app (doc-4 §5). It runs against one production server, chosen by
// BENCH_BASE_URL (default the Lumiose app on :4101), and only uses the landmarks of landmarks.ts, so
// every app must pass it unchanged. Tests that mutate data create their own issue or pick open
// issues, so they do not depend on each other. Set BENCH_EXPECT_STREAMING=1 when the server runs
// with COMMENTS_DELAY_MS > 0 to also check that comments stream after the shell.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { PRIORITIES, STATUSES, USERNAME, formOf, tid } from "./landmarks.ts";

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

/** The status or priority value of the first badge of that kind inside `scope`. */
async function badge(scope: Locator, kind: "status" | "priority"): Promise<string> {
  const values: readonly string[] = kind === "status" ? STATUSES : PRIORITIES;
  const className = await scope.locator(`.badge[class*="${kind}-"]`).first().getAttribute("class");
  const value = new RegExp(`${kind}-(\\w+)`).exec(className ?? "")?.[1] ?? "";
  expect(values).toContain(value);
  return value;
}

async function firstProjectSlug(page: Page): Promise<string> {
  await open(page, "/");
  const href = await page.locator(tid("sidebar-project")).first().getAttribute("href");
  return /\/projects\/([^/?#]+)/.exec(href ?? "")![1]!;
}

async function issueIds(rows: Locator): Promise<number[]> {
  return (await rows.evaluateAll((els) => els.map((el) => el.getAttribute("data-issue-id")))).map(
    Number,
  );
}

async function pageCount(page: Page): Promise<number> {
  const info = page.locator(tid("page-info"));
  if ((await info.count()) === 0) return 1; // a single page has no pagination
  return integer(/of (\d+)/.exec(await info.innerText())?.[1] ?? null);
}

/** Signs in through the login form as a seeded user; returns the display name. */
async function login(page: Page): Promise<string> {
  await open(page, "/login");
  await page.locator(`${formOf("login-submit")} [name="username"]`).fill(USERNAME);
  await page.locator(tid("login-submit")).click();
  await expect(page).toHaveURL(/\/$/);
  const name = page.locator(`${tid("current-user")} .user-name`);
  await expect(name).not.toBeEmpty();
  await ready(page);
  return (await name.innerText()).trim();
}

/** Fills the new-issue form (already open) with valid values. */
async function fillNewIssue(page: Page, title: string): Promise<void> {
  const form = page.locator(formOf("create-issue"));
  await form.locator('[name="title"]').fill(title);
  await form.locator('[name="body"]').fill(`Created by the conformance suite: ${title}.`);
  const projects = await form
    .locator('select[name="project"] option')
    .evaluateAll((els) =>
      els.map((el) => (el as HTMLOptionElement).value).filter((value) => value !== ""),
    );
  await form.locator('select[name="project"]').selectOption(projects[0]!);
  await form.locator('select[name="priority"]').selectOption("high");
}

let created = 0;

/** Creates an issue through the form (signed in) and returns its id. */
async function createIssue(page: Page): Promise<number> {
  await open(page, "/issues/new");
  await fillNewIssue(page, `Conformance ${Date.now().toString(36)} ${created++}`);
  await page.locator(tid("create-issue")).click();
  await expect(page).toHaveURL(/\/issues\/\d+$/);
  await ready(page);
  return Number(/\/issues\/(\d+)$/.exec(page.url())![1]);
}

async function apiStatus(page: Page, id: number): Promise<string> {
  const response = await page.request.get(`/api/issues/${id}`);
  expect(response.status()).toBe(200);
  return ((await response.json()) as { status: string }).status;
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
      await expect(page.locator(tid("app-header"))).toBeVisible();
      const nav = await page
        .locator(`${tid("nav")} a`)
        .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
      expect(nav).toEqual(expect.arrayContaining(["/", "/issues/new", "/search"]));
      await expect(page.locator(tid("login-link"))).toHaveAttribute("href", "/login");
      await expect(page.locator(`${tid("current-user")} .user-name`)).toHaveCount(0);
      await expect(page.locator(tid("sidebar-project"))).toHaveCount(12);
      for (const count of await page.locator(`${tid("sidebar-project")} .count`).allInnerTexts()) {
        expect(count.trim()).toMatch(/^\d+$/);
      }
      await expect(page.locator(tid("app-footer"))).toContainText("fullstack comparison benchmark");
      await expect(page.locator(`${tid("main")} h1`)).toHaveCount(1);
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
      integer(await page.locator(`${tid(id)} .stat-value`).innerText());
    const byStatus: Record<string, number> = {};
    for (const status of STATUSES) byStatus[status] = await value(`stat-${status}`);
    let byPriority = 0;
    for (const priority of PRIORITIES) byPriority += await value(`stat-${priority}`);
    expect(byStatus.open! + byStatus.in_progress! + byStatus.closed!).toBeGreaterThanOrEqual(6000);
    expect(byPriority).toBe(byStatus.open! + byStatus.in_progress!);
    await expect(page.locator(tid("project-row"))).toHaveCount(12);
    const recent = page.locator(`${tid("recent-issues")} li`);
    await expect(recent).toHaveCount(10);
    for (const href of await recent
      .locator(".issue-link")
      .evaluateAll((els) => els.map((el) => el.getAttribute("href")))) {
      expect(href).toMatch(/^\/issues\/\d+$/);
    }
  });
});

test.describe("project issues", () => {
  test("lists 50 issues with pagination", async ({ page }) => {
    const slug = await firstProjectSlug(page);
    await open(page, `/projects/${slug}`);
    await expect(page.locator(`${tid("main")} h1`)).toHaveCount(1);
    expect(await pageCount(page)).toBeGreaterThan(3);
    const rows = page.locator(tid("issue-row"));
    await expect(rows).toHaveCount(50);
    const first = rows.first();
    const id = await first.getAttribute("data-issue-id");
    await expect(first.locator(".issue-link")).toHaveAttribute("href", `/issues/${id}`);
    await expect(first.locator(tid("row-select"))).toHaveAttribute("value", id!);
    await badge(first, "status");
    await badge(first, "priority");
    await expect(page.locator(tid("page-info"))).toContainText("Page 1 of");
    await expect(page.locator(tid("page-prev"))).toHaveCount(0);
    await expect(page.locator(tid("page-next"))).toHaveAttribute("href", /page=2/);

    await open(page, `/projects/${slug}?page=3`);
    await expect(page.locator(tid("page-info"))).toContainText("Page 3 of");
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
    for (const row of (await rows.all()).slice(0, 10))
      expect(await badge(row, "status")).toBe("closed");
    await open(page, `/projects/${slug}?priority=urgent`);
    for (const row of (await rows.all()).slice(0, 10))
      expect(await badge(row, "priority")).toBe("urgent");

    // The filter form is a GET form: submitting it puts the filters in the URL.
    await open(page, `/projects/${slug}`);
    const unfiltered = await pageCount(page);
    const form = page.locator(formOf("filter-submit"));
    await form.locator('[name="status"]').selectOption("open");
    const labels = await form
      .locator('select[name="label"] option')
      .evaluateAll((els) =>
        els.map((el) => (el as HTMLOptionElement).value).filter((value) => value !== ""),
      );
    expect(labels).toHaveLength(15);
    await form.locator('[name="label"]').selectOption(labels[0]!);
    await form.locator('[name="sort"]').selectOption("created");
    await page.locator(tid("filter-submit")).click();
    await expect(page).toHaveURL(/status=open/);
    await expect(page).toHaveURL(new RegExp(`label=${encodeURIComponent(labels[0]!)}`));
    await expect(page).toHaveURL(/sort=created/);
    await ready(page);
    expect(await rows.count()).toBeGreaterThan(0);
    expect(await pageCount(page)).toBeLessThan(unfiltered);
    for (const row of (await rows.all()).slice(0, 10)) {
      expect(await badge(row, "status")).toBe("open");
      await expect(row.locator(".labels .label", { hasText: labels[0]! })).toHaveCount(1);
    }
    if ((await pageCount(page)) > 1) {
      await expect(page.locator(tid("page-next"))).toHaveAttribute("href", /status=open/);
    }

    // Text search within the project.
    const word = (await rows.first().locator(".issue-link").innerText()).split(/\s+/)[0]!;
    await open(page, `/projects/${slug}?q=${encodeURIComponent(word)}`);
    expect(await rows.count()).toBeGreaterThan(0);
    for (const title of (await rows.locator(".issue-link").allInnerTexts()).slice(0, 10)) {
      expect(title.toLowerCase()).toContain(word.toLowerCase());
    }
  });

  test("an unknown project is a 404", async ({ page }) => {
    await open(page, "/projects/no-such-project", 404);
    await expect(page.locator(tid("not-found"))).toBeVisible();
  });
});

test.describe("issue page", () => {
  test("shows the issue, its details and the streamed comments", async ({ page, request }) => {
    const slug = await firstProjectSlug(page);
    await open(page, `/projects/${slug}`);
    const link = page.locator(`${tid("issue-row")} .issue-link`).first();
    const title = (await link.innerText()).trim();
    const href = (await link.getAttribute("href"))!;
    const id = Number(href.split("/").pop());

    await open(page, href);
    await expect(page.locator(tid("issue-title"))).toContainText(title);
    await expect(page.locator(tid("issue-title"))).toContainText(`#${id}`);
    const meta = page.locator(tid("issue-status"));
    await badge(meta, "status");
    await badge(meta, "priority");
    await expect(meta.locator("a")).toHaveAttribute("href", `/projects/${slug}`);
    expect((await page.locator(tid("issue-body")).innerText()).length).toBeGreaterThan(100);
    await expect(page.locator(tid("assignee"))).not.toBeEmpty();
    await expect(page.locator(tid("reporter"))).not.toBeEmpty();

    await expect(page.locator(tid("comment-list"))).toBeVisible();
    await expect(page.locator(tid("comments-loading"))).toHaveCount(0);
    const comments = page.locator(tid("comment"));
    await expect(page.locator(tid("comment-count"))).toContainText(String(await comments.count()));
    for (const comment of await comments.all()) {
      await expect(comment.locator(".comment-meta strong")).not.toBeEmpty();
      await expect(comment.locator(".comment-body")).not.toBeEmpty();
    }

    if (process.env.BENCH_EXPECT_STREAMING === "1") {
      const html = await (await request.get(href)).text();
      // Attribute quotes are optional in HTML (Lumiose omits them where it can).
      const fallback = html.search(/data-testid=["']?comments-loading\b/);
      expect(fallback, "the comments fallback is in the shell").toBeGreaterThan(-1);
      // The comments arrive later in the same response: as streamed markup, or as streamed data
      // that the client renders (SvelteKit streams load promises, not HTML; doc-4 §8).
      const markup = html.search(/data-testid=["']?comment-list\b/);
      if (markup !== -1) {
        expect(markup, "the comments are streamed after the shell").toBeGreaterThan(fallback);
      } else if ((await comments.count()) > 0) {
        const words = (await comments.first().locator(".comment-body").innerText())
          .split(/\s+/)
          .slice(0, 3)
          .join(" ");
        expect(
          html.indexOf(words, fallback),
          "the comments are streamed after the shell",
        ).toBeGreaterThan(fallback);
      }
    }

    const api = await request.get(`/api/issues/${id}`);
    expect(api.status()).toBe(200);
    const json = (await api.json()) as { id: number; title: string };
    expect(json.id).toBe(id);
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
    const word = (
      await page
        .locator(`${tid("issue-row")} .issue-link`)
        .first()
        .innerText()
    ).split(/\s+/)[0]!;

    const api = await request.get(`/api/search?q=${encodeURIComponent(word)}`);
    expect(api.status()).toBe(200);
    const results = (await api.json()) as unknown[];
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(8);

    await open(page, "/search");
    await expect(page.locator(tid("search-result"))).toHaveCount(0);
    const input = page.locator(tid("search-input"));
    await input.pressSequentially(word, { delay: 20 });
    const suggestions = page.locator(tid("suggestion"));
    await expect(suggestions.first()).toBeVisible();
    expect(await suggestions.count()).toBeLessThanOrEqual(8);
    await expect(suggestions.first().locator("a")).toHaveAttribute("href", /^\/issues\/\d+$/);

    await input.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/search\\?q=${encodeURIComponent(word)}`));
    await ready(page);
    expect(await page.locator(tid("search-result")).count()).toBeGreaterThan(0);
    await expect(page.locator(`${tid("search-result")} .issue-link`).first()).toHaveAttribute(
      "href",
      /^\/issues\/\d+$/,
    );
  });
});

test.describe("session", () => {
  test("login rejects unknown users, then signs in and out", async ({ page }) => {
    await open(page, "/login");
    await page.locator(`${formOf("login-submit")} [name="username"]`).fill("nobody-by-this-name");
    await page.locator(tid("login-submit")).click();
    await expect(page.locator(tid("error-username"))).not.toBeEmpty();
    await expect(page.locator(`${tid("current-user")} .user-name`)).toHaveCount(0);

    await login(page);
    await expect(page.locator(tid("login-link"))).toHaveCount(0);
    await page.locator(tid("logout-button")).click();
    await expect(page.locator(tid("login-link"))).toBeVisible();
    await expect(page.locator(`${tid("current-user")} .user-name`)).toHaveCount(0);
  });

  test("every action redirects to /login without a session", async ({ page }) => {
    // New issue.
    await open(page, "/issues/new");
    await fillNewIssue(page, "Signed out");
    await page.locator(tid("create-issue")).click();
    await expect(page).toHaveURL(/\/login$/);

    // Status form and comment composer of an open issue.
    const slug = await firstProjectSlug(page);
    await open(page, `/projects/${slug}?status=open`);
    const href = (await page
      .locator(`${tid("issue-row")} .issue-link`)
      .first()
      .getAttribute("href"))!;
    await open(page, href);
    await page.locator(tid("status-select")).selectOption("closed");
    await page.locator(tid("status-submit")).click();
    await expect(page).toHaveURL(/\/login$/);
    await open(page, href);
    expect(await badge(page.locator(tid("issue-status")), "status")).toBe("open");
    await page.locator(tid("comment-input")).fill("Signed out comment");
    await page.locator(tid("comment-submit")).click();
    await expect(page).toHaveURL(/\/login$/);

    // Bulk close.
    await open(page, `/projects/${slug}?status=open`);
    await page.locator(tid("row-select")).first().check();
    await page.locator(tid("close-selected")).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("actions", () => {
  test("new issue: validation errors, label picker and redirect to the issue", async ({ page }) => {
    const user = await login(page);
    await open(page, "/issues/new");
    await page.locator(tid("create-issue")).click();
    await expect(page.locator(tid("error-title"))).not.toBeEmpty();
    await expect(page.locator(tid("error-project"))).not.toBeEmpty();
    await expect(page).toHaveURL(/\/issues\/new$/);
    await ready(page);

    const chips = page.locator(tid("label-chip"));
    await expect(chips).toHaveCount(15);
    const labels = [
      (await chips.nth(1).innerText()).trim(),
      (await chips.nth(4).innerText()).trim(),
    ];
    await chips.nth(1).click();
    await chips.nth(4).click();
    await chips.nth(7).click();
    await chips.nth(7).click(); // toggles back off
    await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(chips.nth(7)).toHaveAttribute("aria-pressed", "false");
    const form = page.locator(formOf("create-issue"));
    await expect(form.locator('input[name="labels"]')).toHaveValue(labels.join(","));

    const title = `Conformance new ${Date.now().toString(36)}`;
    await fillNewIssue(page, title);
    await page.locator(tid("create-issue")).click();
    await expect(page).toHaveURL(/\/issues\/\d+$/);
    await ready(page);
    await expect(page.locator(tid("issue-title"))).toContainText(title);
    expect(await badge(page.locator(tid("issue-status")), "status")).toBe("open");
    expect(await badge(page.locator(tid("issue-status")), "priority")).toBe("high");
    await expect(page.locator(`${tid("issue-labels")} li`)).toHaveText(labels);
    await expect(page.locator(tid("reporter"))).toHaveText(user);
    await expect(page.locator(tid("comment-count"))).toHaveText("0 comments");
  });

  test("the status form changes the status", async ({ page }) => {
    await login(page);
    const id = await createIssue(page);
    await page.locator(tid("status-select")).selectOption("in_progress");
    await page.locator(tid("status-submit")).click();
    await expect(page.locator(`${tid("issue-status")} .badge.status-in_progress`)).toBeVisible();
    expect(await apiStatus(page, id)).toBe("in_progress");
  });

  test("the comment composer counts characters and posts a comment", async ({ page }) => {
    await login(page);
    await createIssue(page);
    const body = `Looks good ${Date.now().toString(36)}`;
    await page.locator(tid("comment-input")).fill(body);
    await expect(page.locator(tid("char-count"))).toHaveText(`${body.length} / 2000`);
    await page.locator(tid("comment-submit")).click();
    await expect(page.locator(`${tid("comment")} .comment-body`)).toHaveText([body]);
    await expect(page.locator(tid("comment-count"))).toHaveText("1 comment");
    await ready(page);
    await expect(page.locator(tid("comment-input"))).toHaveValue("");
  });

  test("bulk select closes the selected issues and refreshes the list", async ({ page }) => {
    await login(page);
    const slug = await firstProjectSlug(page);
    await open(page, `/projects/${slug}?status=open`);
    const rows = page.locator(tid("issue-row"));
    const ids = (await issueIds(rows)).slice(0, 2);
    await expect(page.locator(tid("selected-count"))).toHaveText("0 selected");
    await expect(page.locator(tid("close-selected"))).toBeDisabled();
    for (const id of ids) {
      await page.locator(`${tid("issue-row")}[data-issue-id="${id}"] ${tid("row-select")}`).check();
    }
    await expect(page.locator(tid("selected-count"))).toHaveText("2 selected");
    await page.locator(tid("close-selected")).click();
    for (const id of ids) {
      await expect(page.locator(`${tid("issue-row")}[data-issue-id="${id}"]`)).toHaveCount(0);
    }
    await ready(page);
    await expect(page.locator(tid("selected-count"))).toHaveText("0 selected");
    for (const id of ids) expect(await apiStatus(page, id)).toBe("closed");
  });
});
