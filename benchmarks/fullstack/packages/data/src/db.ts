import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL
);
CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL
);
CREATE TABLE labels (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL
);
CREATE TABLE issues (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  priority_rank INTEGER NOT NULL,
  assignee_id INTEGER REFERENCES users(id),
  reporter_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE issue_labels (
  issue_id INTEGER NOT NULL REFERENCES issues(id),
  label_id INTEGER NOT NULL REFERENCES labels(id),
  PRIMARY KEY (issue_id, label_id)
) WITHOUT ROWID;
CREATE TABLE comments (
  id INTEGER PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES issues(id),
  author_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export const INDEXES = `
CREATE INDEX issues_project_updated ON issues(project_id, updated_at);
CREATE INDEX issues_updated ON issues(updated_at);
CREATE INDEX issues_status ON issues(status);
CREATE INDEX issue_labels_label ON issue_labels(label_id);
CREATE INDEX comments_issue ON comments(issue_id, created_at);
`;

/** The DB file: `TRACKER_DB`, or `.data/tracker.db` under the current working directory (the app). */
export function dbPath(): string {
  return resolve(process.env.TRACKER_DB ?? ".data/tracker.db");
}

let current: { path: string; db: DatabaseSync } | undefined;

/** The shared connection, opened lazily. Throws if the database has not been seeded. */
export function db(): DatabaseSync {
  const path = dbPath();
  if (current?.path === path && current.db.isOpen) return current.db;
  if (!existsSync(path)) {
    throw new Error(`Tracker database not found at ${path}. Run the app's "seed" script first.`);
  }
  const conn = new DatabaseSync(path);
  conn.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;");
  current = { path, db: conn };
  return conn;
}

/** Closes the shared connection (tests and the seed script). */
export function closeDb(): void {
  current?.db.close();
  current = undefined;
}

/** Runs `fn` in a transaction on `conn`. */
export function transaction<T>(conn: DatabaseSync, fn: () => T): T {
  conn.exec("BEGIN");
  try {
    const result = fn();
    conn.exec("COMMIT");
    return result;
  } catch (error) {
    conn.exec("ROLLBACK");
    throw error;
  }
}
