import type { DatabaseSync, SQLInputValue, StatementSync } from "node:sqlite";
import { db, transaction } from "./db.ts";
import {
  PAGE_SIZE,
  PRIORITIES,
  type Comment,
  type Dashboard,
  type Issue,
  type IssuePage,
  type IssueQuery,
  type IssueSummary,
  type Label,
  type NewIssue,
  type Priority,
  type Project,
  type ProjectStats,
  type SearchHit,
  type Sort,
  type Status,
  type User,
} from "./types.ts";

type Row = Record<string, SQLInputValue>;

const statements = new WeakMap<DatabaseSync, Map<string, StatementSync>>();

/** A prepared statement for `sql`, cached per connection. */
function stmt(sql: string): StatementSync {
  const conn = db();
  let cache = statements.get(conn);
  if (!cache) statements.set(conn, (cache = new Map()));
  let statement = cache.get(sql);
  if (!statement) cache.set(sql, (statement = conn.prepare(sql)));
  return statement;
}

const all = (sql: string, ...params: SQLInputValue[]) => stmt(sql).all(...params) as Row[];
const get = (sql: string, ...params: SQLInputValue[]) =>
  stmt(sql).get(...params) as Row | undefined;

const toUser = (id: unknown, name: unknown, displayName: unknown): User => ({
  id: Number(id),
  name: String(name),
  displayName: String(displayName),
});

const SUMMARY_SELECT = `
  SELECT i.id, i.title, i.status, i.priority, i.created_at, i.updated_at,
    p.slug AS project_slug, p.name AS project_name,
    a.id AS assignee_id, a.name AS assignee_name, a.display_name AS assignee_display,
    (SELECT count(*) FROM comments c WHERE c.issue_id = i.id) AS comment_count
  FROM issues i
  JOIN projects p ON p.id = i.project_id
  LEFT JOIN users a ON a.id = i.assignee_id`;

const ORDER_BY: Record<Sort, string> = {
  updated: "i.updated_at DESC, i.id DESC",
  created: "i.created_at DESC, i.id DESC",
  priority: "i.priority_rank DESC, i.updated_at DESC, i.id DESC",
};

function labelsByIssue(ids: number[]): Map<number, Label[]> {
  const byIssue = new Map<number, Label[]>();
  if (ids.length === 0) return byIssue;
  const rows = all(
    `SELECT il.issue_id, l.id, l.name, l.color
     FROM issue_labels il JOIN labels l ON l.id = il.label_id
     WHERE il.issue_id IN (SELECT value FROM json_each(?))
     ORDER BY l.name`,
    JSON.stringify(ids),
  );
  for (const row of rows) {
    const issueId = Number(row.issue_id);
    let labels = byIssue.get(issueId);
    if (!labels) byIssue.set(issueId, (labels = []));
    labels.push({ id: Number(row.id), name: String(row.name), color: String(row.color) });
  }
  return byIssue;
}

function toSummary(row: Row, labels: Label[]): IssueSummary {
  return {
    id: Number(row.id),
    title: String(row.title),
    status: row.status as Status,
    priority: row.priority as Priority,
    project: { slug: String(row.project_slug), name: String(row.project_name) },
    assignee:
      row.assignee_id == null
        ? null
        : toUser(row.assignee_id, row.assignee_name, row.assignee_display),
    labels,
    commentCount: Number(row.comment_count),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function summaries(rows: Row[]): IssueSummary[] {
  const labels = labelsByIssue(rows.map((row) => Number(row.id)));
  return rows.map((row) => toSummary(row, labels.get(Number(row.id)) ?? []));
}

const escapeLike = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// ---------------------------------------------------------------- reads

export function getDashboard(): Dashboard {
  const byStatus: Record<Status, number> = { open: 0, in_progress: 0, closed: 0 };
  const byPriority: Record<Priority, number> = { low: 0, medium: 0, high: 0, urgent: 0 };
  const projects = new Map<number, ProjectStats>(
    all("SELECT id, slug, name FROM projects ORDER BY name").map((row) => [
      Number(row.id),
      {
        slug: String(row.slug),
        name: String(row.name),
        open: 0,
        inProgress: 0,
        closed: 0,
        total: 0,
      },
    ]),
  );
  // One pass over the covering (project_id, status, priority) index feeds every counter.
  for (const row of all(
    "SELECT project_id, status, priority, count(*) AS n FROM issues GROUP BY project_id, status, priority",
  )) {
    const n = Number(row.n);
    const status = row.status as Status;
    byStatus[status] += n;
    if (status !== "closed") byPriority[row.priority as Priority] += n;
    const project = projects.get(Number(row.project_id))!;
    project.total += n;
    if (status === "open") project.open += n;
    else if (status === "in_progress") project.inProgress += n;
    else project.closed += n;
  }
  const recent = summaries(all(`${SUMMARY_SELECT} ORDER BY i.updated_at DESC, i.id DESC LIMIT 10`));
  return { byStatus, byPriority, projects: [...projects.values()], recent };
}

const PROJECT_SELECT = `
  SELECT p.id, p.slug, p.name, p.description,
    (SELECT count(*) FROM issues i WHERE i.project_id = p.id AND i.status = 'open') AS open_count
  FROM projects p`;

const toProject = (row: Row): Project => ({
  id: Number(row.id),
  slug: String(row.slug),
  name: String(row.name),
  description: String(row.description),
  openCount: Number(row.open_count),
});

/** All projects by name, with their open-issue counts (the layout sidebar). */
export function listProjects(): Project[] {
  return all(`${PROJECT_SELECT} ORDER BY p.name`).map(toProject);
}

export function getProject(slug: string): Project | undefined {
  const row = get(`${PROJECT_SELECT} WHERE p.slug = ?`, slug);
  return row && toProject(row);
}

export function listLabels(): Label[] {
  return all("SELECT id, name, color FROM labels ORDER BY name").map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    color: String(row.color),
  }));
}

export function listIssues(query: IssueQuery = {}): IssuePage {
  const where: string[] = [];
  const params: SQLInputValue[] = [];
  if (query.projectSlug) {
    where.push("p.slug = ?");
    params.push(query.projectSlug);
  }
  if (query.status) {
    where.push("i.status = ?");
    params.push(query.status);
  }
  if (query.priority) {
    where.push("i.priority = ?");
    params.push(query.priority);
  }
  if (query.label) {
    where.push(
      "EXISTS (SELECT 1 FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE il.issue_id = i.id AND l.name = ?)",
    );
    params.push(query.label);
  }
  const q = query.q?.trim();
  if (q) {
    where.push("i.title LIKE ? ESCAPE '\\'");
    params.push(escapeLike(q));
  }
  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const pageSize = query.pageSize ?? PAGE_SIZE;
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const total = Number(
    get(
      `SELECT count(*) AS n FROM issues i JOIN projects p ON p.id = i.project_id${whereSql}`,
      ...params,
    )!.n,
  );
  const rows = all(
    `${SUMMARY_SELECT}${whereSql} ORDER BY ${ORDER_BY[query.sort ?? "updated"]} LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    (page - 1) * pageSize,
  );
  return { items: summaries(rows), total };
}

export function getIssue(id: number): Issue | undefined {
  if (!Number.isSafeInteger(id)) return undefined;
  const row = get(
    `SELECT s.*, i.body, r.id AS reporter_id, r.name AS reporter_name, r.display_name AS reporter_display
     FROM (${SUMMARY_SELECT} WHERE i.id = ?) s
     JOIN issues i ON i.id = s.id
     JOIN users r ON r.id = i.reporter_id`,
    id,
  );
  if (!row) return undefined;
  return {
    ...toSummary(row, labelsByIssue([id]).get(id) ?? []),
    body: String(row.body),
    reporter: toUser(row.reporter_id, row.reporter_name, row.reporter_display),
  };
}

const COMMENT_SELECT = `
  SELECT c.id, c.issue_id, c.body, c.created_at, u.id AS author_id, u.name AS author_name, u.display_name AS author_display
  FROM comments c JOIN users u ON u.id = c.author_id`;

const toComment = (row: Row): Comment => ({
  id: Number(row.id),
  issueId: Number(row.issue_id),
  body: String(row.body),
  author: toUser(row.author_id, row.author_name, row.author_display),
  createdAt: String(row.created_at),
});

/**
 * The issue's comments, oldest first. Asynchronous on purpose: it waits
 * `COMMENTS_DELAY_MS` (default 0) first, so the harness can model slow data
 * for streaming.
 */
export async function listComments(issueId: number): Promise<Comment[]> {
  const delay = Number(process.env.COMMENTS_DELAY_MS ?? 0);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  return all(`${COMMENT_SELECT} WHERE c.issue_id = ? ORDER BY c.created_at, c.id`, issueId).map(
    toComment,
  );
}

/** Issues whose title contains `q` (case-insensitive), most recently updated first. */
export function searchIssues(q: string, limit = 20): SearchHit[] {
  const term = q.trim();
  if (!term) return [];
  return all(
    `SELECT i.id, i.title, i.status, p.slug AS project_slug, p.name AS project_name
     FROM issues i JOIN projects p ON p.id = i.project_id
     WHERE i.title LIKE ? ESCAPE '\\'
     ORDER BY i.updated_at DESC, i.id DESC LIMIT ?`,
    escapeLike(term),
    limit,
  ).map((row) => ({
    id: Number(row.id),
    title: String(row.title),
    status: row.status as Status,
    project: { slug: String(row.project_slug), name: String(row.project_name) },
  }));
}

export function getUser(id: number): User | undefined {
  if (!Number.isSafeInteger(id)) return undefined;
  const row = get("SELECT id, name, display_name FROM users WHERE id = ?", id);
  return row && toUser(row.id, row.name, row.display_name);
}

/** The user for a session cookie value (`uid`), if it names an existing user. */
export function sessionUser(cookieValue: string | undefined | null): User | undefined {
  if (!cookieValue || !/^\d+$/.test(cookieValue)) return undefined;
  return getUser(Number(cookieValue));
}

export function getUserByName(name: string): User | undefined {
  const row = get(
    "SELECT id, name, display_name FROM users WHERE name = ?",
    name.trim().toLowerCase(),
  );
  return row && toUser(row.id, row.name, row.display_name);
}

// ---------------------------------------------------------------- writes

function requireUser(userId: number): void {
  if (!getUser(userId)) throw new Error(`Unknown user ${userId}`);
}

const now = () => new Date().toISOString();

/** Creates an open, unassigned issue from validated input and returns its id. */
export function createIssue(input: NewIssue, userId: number): number {
  requireUser(userId);
  const project = getProject(input.projectSlug);
  if (!project) throw new Error(`Unknown project ${input.projectSlug}`);
  return transaction(db(), () => {
    const timestamp = now();
    const { lastInsertRowid } = stmt(
      `INSERT INTO issues (project_id, title, body, status, priority, priority_rank, assignee_id, reporter_id, created_at, updated_at)
       VALUES (?, ?, ?, 'open', ?, ?, NULL, ?, ?, ?)`,
    ).run(
      project.id,
      input.title,
      input.body,
      input.priority,
      PRIORITIES.indexOf(input.priority),
      userId,
      timestamp,
      timestamp,
    );
    const id = Number(lastInsertRowid);
    for (const name of input.labels) {
      stmt(
        "INSERT INTO issue_labels (issue_id, label_id) SELECT ?, id FROM labels WHERE name = ?",
      ).run(id, name);
    }
    return id;
  });
}

/** Sets an issue's status. Returns false when the issue does not exist. */
export function updateIssueStatus(id: number, status: Status, userId: number): boolean {
  requireUser(userId);
  const { changes } = stmt("UPDATE issues SET status = ?, updated_at = ? WHERE id = ?").run(
    status,
    now(),
    id,
  );
  return Number(changes) > 0;
}

/** Adds a comment (body already validated) and bumps the issue's `updatedAt`. */
export function addComment(issueId: number, body: string, userId: number): Comment {
  requireUser(userId);
  return transaction(db(), () => {
    const timestamp = now();
    const { lastInsertRowid } = stmt(
      "INSERT INTO comments (issue_id, author_id, body, created_at) VALUES (?, ?, ?, ?)",
    ).run(issueId, userId, body, timestamp);
    stmt("UPDATE issues SET updated_at = ? WHERE id = ?").run(timestamp, issueId);
    return toComment(get(`${COMMENT_SELECT} WHERE c.id = ?`, lastInsertRowid)!);
  });
}

/** Closes the given issues. Returns how many were not closed before. */
export function closeIssues(ids: number[], userId: number): number {
  requireUser(userId);
  const valid = ids.filter((id) => Number.isSafeInteger(id));
  if (valid.length === 0) return 0;
  const { changes } = stmt(
    `UPDATE issues SET status = 'closed', updated_at = ?
     WHERE status != 'closed' AND id IN (SELECT value FROM json_each(?))`,
  ).run(now(), JSON.stringify(valid));
  return Number(changes);
}
