import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  SEED_COUNTS,
  addComment,
  closeDb,
  closeIssues,
  createIssue,
  formatDate,
  getDashboard,
  getIssue,
  getProject,
  getUser,
  getUserByName,
  issueListHref,
  listComments,
  listIssues,
  listLabels,
  listProjects,
  parseIssueFilters,
  parseLabels,
  searchIssues,
  seed,
  sessionUser,
  updateIssueStatus,
  validateComment,
  validateIssue,
  validateLogin,
} from "../src/index.ts";

const dir = mkdtempSync(join(tmpdir(), "bench-data-"));
const path = join(dir, "tracker.db");

beforeAll(() => {
  process.env.TRACKER_DB = path;
  seed(path);
});

afterAll(() => {
  closeDb();
  delete process.env.TRACKER_DB;
  rmSync(dir, { recursive: true, force: true });
});

function contentHash(file: string): string {
  const conn = new DatabaseSync(file, { readOnly: true });
  const hash = createHash("sha256");
  for (const table of ["users", "projects", "labels", "issues", "issue_labels", "comments"]) {
    for (const row of conn.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all())
      hash.update(JSON.stringify(row));
  }
  conn.close();
  return hash.digest("hex");
}

describe("seed", () => {
  it("creates the documented dataset", () => {
    const conn = new DatabaseSync(path, { readOnly: true });
    const count = (table: string) =>
      Number(conn.prepare(`SELECT count(*) AS n FROM ${table}`).get()!.n);
    expect(count("users")).toBe(SEED_COUNTS.users);
    expect(count("projects")).toBe(SEED_COUNTS.projects);
    expect(count("labels")).toBe(SEED_COUNTS.labels);
    expect(count("issues")).toBe(SEED_COUNTS.issues);
    expect(count("comments")).toBe(SEED_COUNTS.comments);
    const perIssue = conn.prepare(
      "SELECT max(n) AS max FROM (SELECT count(*) AS n FROM issue_labels GROUP BY issue_id)",
    );
    expect(Number(perIssue.get()!.max)).toBe(3);
    const body = conn.prepare("SELECT avg(length(body)) AS n FROM issues").get()!;
    expect(Number(body.n)).toBeGreaterThan(450);
    expect(Number(body.n)).toBeLessThan(650);
    conn.close();
  });

  it("is deterministic", () => {
    const other = join(dir, "again.db");
    seed(other);
    expect(contentHash(other)).toBe(contentHash(path));
    expect(readFileSync(other).length).toBeGreaterThan(0);
  });
});

describe("reads", () => {
  it("getDashboard", () => {
    const d = getDashboard();
    expect(d.byStatus.open + d.byStatus.in_progress + d.byStatus.closed).toBe(SEED_COUNTS.issues);
    const notClosed = d.byStatus.open + d.byStatus.in_progress;
    expect(Object.values(d.byPriority).reduce((a, b) => a + b, 0)).toBe(notClosed);
    expect(d.projects).toHaveLength(12);
    expect(d.projects.reduce((a, p) => a + p.total, 0)).toBe(SEED_COUNTS.issues);
    expect(d.recent).toHaveLength(10);
    const times = d.recent.map((issue) => issue.updatedAt);
    expect(times.toSorted().toReversed()).toEqual(times);
    // React Server Components reject null-prototype objects: every result must be a plain object.
    expect(Object.getPrototypeOf(d.recent[0])).toBe(Object.prototype);
  });

  it("listProjects and getProject", () => {
    const projects = listProjects();
    expect(projects).toHaveLength(12);
    const names = projects.map((p) => p.name);
    expect(names.toSorted()).toEqual(names);
    const api = getProject("api")!;
    expect(api.name).toBe("API");
    expect(api.openCount).toBe(projects.find((p) => p.slug === "api")!.openCount);
    expect(getProject("nope")).toBeUndefined();
  });

  it("listIssues filters, sorts and paginates", () => {
    const all = listIssues({ projectSlug: "api" });
    expect(all.items).toHaveLength(PAGE_SIZE);
    expect(all.items.every((issue) => issue.project.slug === "api")).toBe(true);

    const open = listIssues({ projectSlug: "api", status: "open", priority: "high" });
    expect(open.total).toBeLessThan(all.total);
    expect(open.items.every((i) => i.status === "open" && i.priority === "high")).toBe(true);

    const bugs = listIssues({ label: "bug" });
    expect(bugs.items.every((i) => i.labels.some((l) => l.name === "bug"))).toBe(true);

    const q = listIssues({ q: "LOGIN" });
    expect(q.total).toBeGreaterThan(0);
    expect(q.items.every((i) => i.title.toLowerCase().includes("login"))).toBe(true);
    expect(listIssues({ q: "100%_" }).total).toBe(0);

    const byPriority = listIssues({ sort: "priority" }).items;
    expect(byPriority[0]!.priority).toBe("urgent");
    const byCreated = listIssues({ sort: "created" }).items;
    expect(byCreated[0]!.id).toBe(SEED_COUNTS.issues);

    const page2 = listIssues({ projectSlug: "api", page: 2 });
    expect(page2.total).toBe(all.total);
    expect(page2.items[0]!.id).not.toBe(all.items[0]!.id);
    const last = Math.ceil(all.total / PAGE_SIZE);
    expect(listIssues({ projectSlug: "api", page: last }).items.length).toBe(
      all.total - (last - 1) * PAGE_SIZE,
    );
  });

  it("getIssue", () => {
    const issue = getIssue(1)!;
    expect(issue.id).toBe(1);
    expect(issue.body.length).toBeGreaterThan(400);
    expect(issue.reporter.name).toBeTruthy();
    expect(getIssue(999_999)).toBeUndefined();
  });

  it("listComments is async and ordered", async () => {
    const issue = getIssue(1)!;
    const pending = listComments(1);
    expect(pending).toBeInstanceOf(Promise);
    const comments = await pending;
    expect(comments.length).toBe(issue.commentCount);
    const times = comments.map((c) => c.createdAt);
    expect(times.toSorted()).toEqual(times);
  });

  it("listComments waits COMMENTS_DELAY_MS", async () => {
    process.env.COMMENTS_DELAY_MS = "30";
    const start = performance.now();
    await listComments(1);
    delete process.env.COMMENTS_DELAY_MS;
    expect(performance.now() - start).toBeGreaterThanOrEqual(25);
  });

  it("searchIssues", () => {
    expect(searchIssues("dark mode").every((hit) => hit.title.includes("dark mode"))).toBe(true);
    expect(searchIssues("dark mode", 8)).toHaveLength(8);
    expect(searchIssues("   ")).toEqual([]);
  });

  it("users and sessions", () => {
    const alice = getUserByName("alice")!;
    expect(alice).toEqual({ id: 1, name: "alice", displayName: expect.stringMatching(/^Alice /) });
    expect(getUserByName("Alice ")).toEqual(alice);
    expect(getUser(1)).toEqual(alice);
    expect(getUser(500)).toBeUndefined();
    expect(sessionUser("1")).toEqual(alice);
    expect(sessionUser("1abc")).toBeUndefined();
    expect(sessionUser(undefined)).toBeUndefined();
  });
});

describe("validation", () => {
  it("validateIssue", () => {
    expect(validateIssue({})).toEqual({
      ok: false,
      errors: {
        title: "Title is required.",
        project: "Choose a project.",
        priority: "Choose a priority.",
      },
    });
    const bad = validateIssue({
      title: "ab",
      project: "nope",
      priority: "meh",
      labels: "bug,nope",
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.errors.title).toMatch(/at least 3/);
      expect(bad.errors.project).toBe("Unknown project.");
      expect(bad.errors.labels).toBe("Unknown label: nope.");
    }
    const tooMany = validateIssue({
      title: "Okay",
      project: "api",
      priority: "low",
      labels: "bug,ui,api,docs",
    });
    expect(!tooMany.ok && tooMany.errors.labels).toBe("Choose at most 3 labels.");
    expect(
      validateIssue({
        title: "  Fix it  ",
        body: " b ",
        project: "api",
        priority: "high",
        labels: "ui, bug,ui",
      }),
    ).toEqual({
      ok: true,
      value: {
        title: "Fix it",
        body: "b",
        projectSlug: "api",
        priority: "high",
        labels: ["ui", "bug"],
      },
    });
  });

  it("validateComment and validateLogin", () => {
    expect(validateComment("  ")).toEqual({
      ok: false,
      errors: { body: "Comment cannot be empty." },
    });
    expect(validateComment("x".repeat(2001)).ok).toBe(false);
    expect(validateComment(" hi ")).toEqual({ ok: true, value: "hi" });
    expect(validateLogin("")).toEqual({ ok: false, errors: { username: "Enter a username." } });
    expect(validateLogin("nobody")).toEqual({ ok: false, errors: { username: "Unknown user." } });
    expect(validateLogin("bob").ok).toBe(true);
  });

  it("parseLabels", () => {
    expect(parseLabels("a, b,,a")).toEqual(["a", "b"]);
    expect(parseLabels(["a", "b,c"])).toEqual(["a", "b", "c"]);
    expect(parseLabels(undefined)).toEqual([]);
  });
});

describe("writes", () => {
  it("createIssue", () => {
    const id = createIssue(
      {
        title: "New one",
        body: "Body",
        projectSlug: "auth",
        priority: "urgent",
        labels: ["ui", "bug"],
      },
      1,
    );
    expect(id).toBe(SEED_COUNTS.issues + 1);
    const issue = getIssue(id)!;
    expect(issue).toMatchObject({
      title: "New one",
      status: "open",
      priority: "urgent",
      assignee: null,
      commentCount: 0,
    });
    expect(issue.project.slug).toBe("auth");
    expect(issue.labels.map((l) => l.name)).toEqual(["bug", "ui"]);
    expect(issue.reporter.id).toBe(1);
    expect(listIssues({ projectSlug: "auth" }).items[0]!.id).toBe(id);
    expect(() =>
      createIssue({ title: "x", body: "", projectSlug: "api", priority: "low", labels: [] }, 999),
    ).toThrow();
  });

  it("updateIssueStatus", () => {
    expect(updateIssueStatus(2, "in_progress", 1)).toBe(true);
    expect(getIssue(2)!.status).toBe("in_progress");
    expect(updateIssueStatus(999_999, "closed", 1)).toBe(false);
  });

  it("addComment", async () => {
    const before = (await listComments(3)).length;
    const comment = addComment(3, "Looks good", 2);
    expect(comment).toMatchObject({ issueId: 3, body: "Looks good", author: { id: 2 } });
    expect((await listComments(3)).length).toBe(before + 1);
    expect(getIssue(3)!.updatedAt).toBe(comment.createdAt);
  });

  it("closeIssues", () => {
    const ids = listIssues({ status: "open" })
      .items.slice(0, 3)
      .map((i) => i.id);
    expect(closeIssues([...ids, 999_999], 1)).toBe(3);
    expect(ids.every((id) => getIssue(id)!.status === "closed")).toBe(true);
    expect(closeIssues(ids, 1)).toBe(0);
    expect(closeIssues([], 1)).toBe(0);
  });
});

describe("format helpers", () => {
  it("formatDate", () => {
    expect(formatDate("2026-09-01T23:59:00.000Z")).toBe("Sep 1, 2026");
  });

  it("parseIssueFilters and issueListHref round-trip", () => {
    const filters = parseIssueFilters(
      new URLSearchParams("status=open&priority=bad&label=bug&q=+x+&sort=priority&page=3"),
    );
    expect(filters).toEqual({
      status: "open",
      priority: undefined,
      label: "bug",
      q: "x",
      sort: "priority",
      page: 3,
    });
    expect(issueListHref("api", filters)).toBe(
      "/projects/api?status=open&label=bug&q=x&sort=priority&page=3",
    );
    expect(issueListHref("api", filters, { page: 1 })).toBe(
      "/projects/api?status=open&label=bug&q=x&sort=priority",
    );
    expect(parseIssueFilters({ status: ["closed"], page: "0", sort: "" })).toEqual({
      status: "closed",
      priority: undefined,
      label: undefined,
      q: undefined,
      sort: "updated",
      page: 1,
    });
    expect(issueListHref("web-app", parseIssueFilters({}))).toBe("/projects/web-app");
  });

  it("listLabels", () => {
    expect(listLabels()).toHaveLength(15);
  });
});

describe("db()", () => {
  it("reuses the connection while TRACKER_DB is unchanged, and follows a new value", async () => {
    const { db } = await import("../src/db.ts");
    const other = join(dir, "other.db");
    seed(other); // seeding closes the shared connection
    const first = db();
    expect(db()).toBe(first);
    process.env.TRACKER_DB = other;
    try {
      expect(db()).not.toBe(first);
    } finally {
      process.env.TRACKER_DB = path;
    }
    expect(realpathSync(db().location()!)).toBe(realpathSync(path));
  });
});
