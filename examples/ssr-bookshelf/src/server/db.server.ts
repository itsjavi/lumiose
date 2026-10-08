// The bookshelf database: node:sqlite (`DatabaseSync`, built into Node), versioned migrations
// tracked in `PRAGMA user_version`, a prepared-statement cache and a transaction helper.

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";

export type { DatabaseSync };

/** Env variable that overrides the database file (default `data/bookshelf.db` under the cwd). */
export const DATABASE_ENV = "BOOKSHELF_DB";

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "catalog",
    sql: `
      CREATE TABLE genres (
        id INTEGER PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL
      ) STRICT;

      CREATE TABLE authors (
        id INTEGER PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        bio TEXT NOT NULL,
        country TEXT NOT NULL,
        birth_year INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX authors_name ON authors (name COLLATE NOCASE);

      CREATE TABLE books (
        id INTEGER PRIMARY KEY,
        isbn TEXT NOT NULL UNIQUE CHECK (length(isbn) = 13),
        title TEXT NOT NULL,
        subtitle TEXT,
        description TEXT NOT NULL,
        year INTEGER NOT NULL,
        pages INTEGER NOT NULL CHECK (pages > 0),
        genre_id INTEGER NOT NULL REFERENCES genres (id),
        cover_hue INTEGER NOT NULL CHECK (cover_hue BETWEEN 0 AND 359)
      ) STRICT;
      CREATE INDEX books_genre ON books (genre_id);
      CREATE INDEX books_year ON books (year);
      CREATE INDEX books_title ON books (title COLLATE NOCASE);

      CREATE TABLE book_authors (
        book_id INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL REFERENCES authors (id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (book_id, author_id)
      ) STRICT, WITHOUT ROWID;
      CREATE INDEX book_authors_author ON book_authors (author_id);

      -- Full-text index over title, author names and description; rowid = books.id.
      -- Kept in sync by the triggers below, so writes never touch it directly.
      CREATE VIRTUAL TABLE book_search USING fts5 (
        title, authors, description,
        tokenize = 'unicode61 remove_diacritics 2'
      );

      CREATE TRIGGER books_search_insert AFTER INSERT ON books BEGIN
        INSERT INTO book_search (rowid, title, authors, description)
        VALUES (new.id, new.title, '', new.description);
      END;
      CREATE TRIGGER books_search_update AFTER UPDATE OF title, description ON books BEGIN
        UPDATE book_search SET title = new.title, description = new.description
        WHERE rowid = new.id;
      END;
      CREATE TRIGGER books_search_delete AFTER DELETE ON books BEGIN
        DELETE FROM book_search WHERE rowid = old.id;
      END;
      CREATE TRIGGER book_authors_search_insert AFTER INSERT ON book_authors BEGIN
        UPDATE book_search SET authors = (
          SELECT group_concat(a.name, ' ') FROM book_authors ba
          JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = new.book_id
        ) WHERE rowid = new.book_id;
      END;
      CREATE TRIGGER book_authors_search_delete AFTER DELETE ON book_authors BEGIN
        UPDATE book_search SET authors = coalesce((
          SELECT group_concat(a.name, ' ') FROM book_authors ba
          JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = old.book_id
        ), '') WHERE rowid = old.book_id;
      END;
      CREATE TRIGGER authors_search_rename AFTER UPDATE OF name ON authors BEGIN
        UPDATE book_search SET authors = (
          SELECT group_concat(a.name, ' ') FROM book_authors ba
          JOIN authors a ON a.id = ba.author_id WHERE ba.book_id = book_search.rowid
        ) WHERE rowid IN (SELECT book_id FROM book_authors WHERE author_id = new.id);
      END;
    `,
  },
  {
    version: 2,
    name: "accounts",
    sql: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;

      -- The session token lives only in the (signed) cookie; the table stores its SHA-256, so
      -- a leaked database does not leak live sessions. Deleting a row revokes the session.
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      ) STRICT, WITHOUT ROWID;
      CREATE INDEX sessions_user ON sessions (user_id);
      CREATE INDEX sessions_expires ON sessions (expires_at);
    `,
  },
  {
    version: 3,
    name: "reviews and reading lists",
    sql: `
      CREATE TABLE reviews (
        id INTEGER PRIMARY KEY,
        book_id INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        title TEXT,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (book_id, user_id)
      ) STRICT;
      CREATE INDEX reviews_book_created ON reviews (book_id, created_at DESC);
      CREATE INDEX reviews_user_created ON reviews (user_id, created_at DESC);
      CREATE INDEX reviews_created ON reviews (created_at);

      CREATE VIEW book_ratings AS
        SELECT book_id, count(*) AS review_count, avg(rating) AS average
        FROM reviews GROUP BY book_id;

      CREATE TABLE reading_list (
        user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        book_id INTEGER NOT NULL REFERENCES books (id) ON DELETE CASCADE,
        added_at TEXT NOT NULL,
        PRIMARY KEY (user_id, book_id)
      ) STRICT, WITHOUT ROWID;
      CREATE INDEX reading_list_book ON reading_list (book_id);
    `,
  },
];

export function defaultDatabasePath(): string {
  return process.env[DATABASE_ENV] || resolve(process.cwd(), "data/bookshelf.db");
}

/**
 * Opens (creating if needed) and migrates a database. Pass `":memory:"` for tests.
 * File databases use WAL, so page renders can read while an action writes.
 */
export function openDatabase(filename: string = defaultDatabasePath()): DatabaseSync {
  const inMemory = filename === ":memory:";
  if (!inMemory) mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename, { enableForeignKeyConstraints: true, timeout: 5000 });
  if (!inMemory) db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
  migrate(db);
  return db;
}

/** Applies pending migrations in order, each in its own transaction. Returns how many ran. */
export function migrate(db: DatabaseSync, migrations: readonly Migration[] = MIGRATIONS): number {
  const current = schemaVersion(db);
  let applied = 0;
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    transaction(db, () => {
      db.exec(migration.sql);
      db.exec(`PRAGMA user_version = ${Math.trunc(migration.version)}`);
    });
    applied++;
  }
  return applied;
}

export function schemaVersion(db: DatabaseSync): number {
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number } | undefined;
  return row?.user_version ?? 0;
}

const statementCaches = new WeakMap<DatabaseSync, Map<string, StatementSync>>();

/** A prepared statement, prepared once per database and SQL text. */
export function statement(db: DatabaseSync, sql: string): StatementSync {
  let cache = statementCaches.get(db);
  if (cache === undefined) {
    cache = new Map();
    statementCaches.set(db, cache);
  }
  let prepared = cache.get(sql);
  if (prepared === undefined) {
    prepared = db.prepare(sql);
    cache.set(sql, prepared);
  }
  return prepared;
}

let savepoints = 0;

/**
 * Runs `fn` in a transaction (a savepoint when already inside one): commits when it returns,
 * rolls back when it throws. `fn` must be synchronous; node:sqlite is.
 */
export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  if (db.isTransaction) {
    const name = `sp${++savepoints}`;
    db.exec(`SAVEPOINT ${name}`);
    try {
      const result = fn();
      db.exec(`RELEASE ${name}`);
      return result;
    } catch (error) {
      db.exec(`ROLLBACK TO ${name}; RELEASE ${name}`);
      throw error;
    }
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Timestamps are stored as ISO-8601 UTC text, which sorts chronologically. */
export function timestamp(date: Date = new Date()): string {
  return date.toISOString();
}

// One connection per process. Kept on globalThis so dev-server module reloads reuse it.
const SHARED = Symbol.for("lumen-examples.ssr-bookshelf.db");

/** The app's shared database, opened (and migrated) on first use. */
export function getDatabase(): DatabaseSync {
  const store = globalThis as { [SHARED]?: DatabaseSync };
  return (store[SHARED] ??= openDatabase());
}
