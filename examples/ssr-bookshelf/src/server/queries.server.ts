// Typed queries over the bookshelf database. `createQueries(db)` binds them to a connection
// (tests pass an in-memory one); pages and actions use `queries()`, bound to the shared database.

import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { setTimeout as sleep } from "node:timers/promises";
import { normalizePaging, pageInfo } from "../lib/pagination.ts";
import type { ReviewInput } from "../lib/validation.ts";
import type {
  Author,
  AuthorRef,
  AuthorSummary,
  Book,
  BookFilters,
  BookSort,
  BookSummary,
  Genre,
  MutationResult,
  Page,
  Rating,
  RatingSummary,
  ReadingListEntry,
  Review,
  User,
  UserReview,
} from "../types.ts";
import { getDatabase, statement, timestamp, transaction } from "./db.server.ts";

/** Env variable for the artificial delay of `recommendationsFor` (milliseconds). */
export const SLOW_ENV = "BOOKSHELF_SLOW_MS";
const DEFAULT_SLOW_MS = 1500;
const REVIEWS_PAGE_SIZE = 10;
/** Phantom reviews at the global mean added by the Bayesian average (see WEIGHTED_RATING). */
const PRIOR_REVIEWS = 5;

export interface QueriesOptions {
  /** Delay before `recommendationsFor` resolves. Default: `BOOKSHELF_SLOW_MS` or 1500. */
  recommendationDelayMs?: number;
}

export interface Paging {
  page?: number;
  pageSize?: number;
}

export interface TrendingOptions {
  /** Window length. Default 30 days. */
  days?: number;
  limit?: number;
  /**
   * End of the window. Default: the newest review, so the seeded (fixed-date) demo data keeps
   * a trending list whenever it is run.
   */
  now?: Date;
}

export interface RecommendationOptions {
  limit?: number;
  /** Overrides the configured delay. */
  delayMs?: number;
  /** Aborts the wait, e.g. with the signal of a superseded render. */
  signal?: AbortSignal;
}

export type Queries = ReturnType<typeof createQueries>;

// --- SQL building blocks -----------------------------------------------------------------------

const SUMMARY_COLUMNS = `
  b.id, b.isbn, b.title, b.year, b.cover_hue,
  g.slug AS genre_slug, g.name AS genre_name,
  r.average, coalesce(r.review_count, 0) AS review_count,
  (SELECT json_group_array(json_object('slug', a.slug, 'name', a.name) ORDER BY ba.position)
     FROM book_authors ba JOIN authors a ON a.id = ba.author_id
    WHERE ba.book_id = b.id) AS authors_json`;

const SUMMARY_JOINS = `
  JOIN genres g ON g.id = b.genre_id
  LEFT JOIN book_ratings r ON r.book_id = b.id`;

const SUMMARY_FROM = `books b ${SUMMARY_JOINS}`;

/** One row with the mean of all ratings, for WEIGHTED_RATING. */
const STATS_JOIN = "CROSS JOIN (SELECT avg(rating) AS mean FROM reviews) stats";

/**
 * Bayesian average: the book's ratings plus PRIOR_REVIEWS phantom reviews at the global mean, so
 * a single 5-star review does not outrank many 4.8s. Needs STATS_JOIN.
 */
const WEIGHTED_RATING = `(${PRIOR_REVIEWS} * stats.mean + r.average * r.review_count)
  / (${PRIOR_REVIEWS} + r.review_count)`;

const TITLE_ORDER = "b.title COLLATE NOCASE, b.id";

const ORDER_BY: Record<BookSort, string> = {
  title: TITLE_ORDER,
  newest: `b.year DESC, ${TITLE_ORDER}`,
  oldest: `b.year ASC, ${TITLE_ORDER}`,
  // Unreviewed books last.
  rating: `r.average IS NULL, ${WEIGHTED_RATING} DESC, review_count DESC, ${TITLE_ORDER}`,
  relevance: "s.rank, b.id",
};

const REVIEW_COLUMNS = `
  rv.id, rv.book_id, rv.user_id, u.name AS user_name, rv.rating, rv.title, rv.body,
  rv.created_at, rv.updated_at`;

interface BookSummaryRow {
  id: number;
  isbn: string;
  title: string;
  year: number;
  cover_hue: number;
  genre_slug: string;
  genre_name: string;
  average: number | null;
  review_count: number;
  authors_json: string | null;
}

interface BookRow extends BookSummaryRow {
  subtitle: string | null;
  description: string;
  pages: number;
}

interface ReviewRow {
  id: number;
  book_id: number;
  user_id: number;
  user_name: string;
  rating: number;
  title: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

interface UserReviewRow extends ReviewRow {
  book_isbn: string;
  book_title: string;
}

interface AuthorRow {
  id: number;
  slug: string;
  name: string;
  bio: string;
  country: string;
  birth_year: number;
  book_count: number;
  average: number | null;
  review_count: number;
}

interface UserRow {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

/**
 * Turns user input into an FTS5 query: each word (letters and digits only, so no FTS syntax
 * gets through) becomes a quoted prefix term, and all terms must match. `null` when the input
 * has no words.
 */
export function toFtsQuery(input: string): string | null {
  const words = input
    .normalize("NFKC")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu);
  if (words === null) return null;
  return words
    .slice(0, 8)
    .map((word) => `"${word}"*`)
    .join(" ");
}

export function createQueries(db: DatabaseSync, options: QueriesOptions = {}) {
  const get = <Row>(sql: string, ...params: SQLInputValue[]) =>
    statement(db, sql).get(...params) as Row | undefined;
  const all = <Row>(sql: string, ...params: SQLInputValue[]) =>
    statement(db, sql).all(...params) as unknown as Row[];
  const count = (sql: string, ...params: SQLInputValue[]) =>
    get<{ n: number }>(sql, ...params)?.n ?? 0;
  const exists = (sql: string, ...params: SQLInputValue[]) => get(sql, ...params) !== undefined;

  const delayMs = () =>
    options.recommendationDelayMs ?? (Number(process.env[SLOW_ENV]) || DEFAULT_SLOW_MS);

  // --- Books ---------------------------------------------------------------------------------

  function listBooks(filters: BookFilters = {}): Page<BookSummary> {
    const { page, pageSize, offset } = normalizePaging(filters.page, filters.pageSize);
    const match = filters.q === undefined ? null : toFtsQuery(filters.q);
    const joins: string[] = [];
    const where: string[] = [];
    const params: SQLInputValue[] = [];
    if (match !== null) {
      // bm25 column weights: title 10, authors 4, description 1 (lower rank = better match).
      joins.push(`JOIN (
        SELECT rowid AS book_id, bm25(book_search, 10.0, 4.0, 1.0) AS rank
        FROM book_search WHERE book_search MATCH ?
      ) s ON s.book_id = b.id`);
      params.push(match);
    }
    if (filters.genre !== undefined) {
      where.push("g.slug = ?");
      params.push(filters.genre);
    }
    if (filters.author !== undefined) {
      where.push(`b.id IN (
        SELECT ba.book_id FROM book_authors ba JOIN authors a ON a.id = ba.author_id
        WHERE a.slug = ?
      )`);
      params.push(filters.author);
    }
    const filterSql = `${joins.join(" ")}${where.length > 0 ? ` WHERE ${where.join(" AND ")}` : ""}`;
    const sort: BookSort =
      filters.sort === undefined || (filters.sort === "relevance" && match === null)
        ? match === null
          ? "title"
          : "relevance"
        : filters.sort;

    const total = count(
      `SELECT count(*) AS n FROM books b JOIN genres g ON g.id = b.genre_id ${filterSql}`,
      ...params,
    );
    const rows = all<BookSummaryRow>(
      `SELECT ${SUMMARY_COLUMNS}
       FROM ${SUMMARY_FROM} ${sort === "rating" ? STATS_JOIN : ""} ${filterSql}
       ORDER BY ${ORDER_BY[sort]} LIMIT ? OFFSET ?`,
      ...params,
      pageSize,
      offset,
    );
    return { ...pageInfo(total, page, pageSize), items: rows.map(toBookSummary) };
  }

  function getBook(isbn: string): Book | null {
    const row = get<BookRow>(
      `SELECT ${SUMMARY_COLUMNS}, b.subtitle, b.description, b.pages
       FROM ${SUMMARY_FROM} WHERE b.isbn = ?`,
      isbn,
    );
    if (row === undefined) return null;
    const histogram: Book["ratingHistogram"] = [0, 0, 0, 0, 0];
    for (const { rating, n } of all<{ rating: number; n: number }>(
      "SELECT rating, count(*) AS n FROM reviews WHERE book_id = ? GROUP BY rating",
      row.id,
    )) {
      histogram[rating - 1] = n;
    }
    return {
      ...toBookSummary(row),
      subtitle: row.subtitle,
      description: row.description,
      pages: row.pages,
      ratingHistogram: histogram,
    };
  }

  /** Best rated books (by WEIGHTED_RATING, so a few glowing reviews do not beat many good ones). */
  function featuredBooks(limit = 6): BookSummary[] {
    return all<BookSummaryRow>(
      `SELECT ${SUMMARY_COLUMNS}
       FROM ${SUMMARY_FROM}
       ${STATS_JOIN}
       WHERE r.review_count > 0
       ORDER BY ${WEIGHTED_RATING} DESC, b.id
       LIMIT ?`,
      limit,
    ).map(toBookSummary);
  }

  /** Books with the most reviews in the window ending at `now`. */
  function trendingBooks({ days = 30, limit = 6, now }: TrendingOptions = {}): BookSummary[] {
    const end =
      now === undefined
        ? get<{ latest: string | null }>("SELECT max(created_at) AS latest FROM reviews")?.latest
        : timestamp(now);
    if (end == null) return [];
    const start = timestamp(new Date(Date.parse(end) - days * 86_400_000));
    return all<BookSummaryRow>(
      `SELECT ${SUMMARY_COLUMNS}
       FROM ${SUMMARY_FROM}
       JOIN (
         SELECT book_id, count(*) AS recent FROM reviews
         WHERE created_at > ? AND created_at <= ? GROUP BY book_id
       ) t ON t.book_id = b.id
       ORDER BY t.recent DESC, r.average DESC, b.id
       LIMIT ?`,
      start,
      end,
      limit,
    ).map(toBookSummary);
  }

  /**
   * Books in the genres the user rated 4+ or saved, best rated first, excluding books they
   * reviewed or saved; featured books for anonymous users or when nothing matches.
   * Deliberately slow (see `SLOW_ENV`) so the page can stream it inside `<Suspense>`.
   */
  async function recommendationsFor(
    userId: number | null,
    { limit = 6, delayMs: delay, signal }: RecommendationOptions = {},
  ): Promise<BookSummary[]> {
    await sleep(delay ?? delayMs(), undefined, signal === undefined ? undefined : { signal });
    if (userId === null) return featuredBooks(limit);
    const picks = all<BookSummaryRow>(
      `WITH affinity AS (
         SELECT genre_id, sum(weight) AS weight FROM (
           SELECT b.genre_id, 2 AS weight FROM reviews rv JOIN books b ON b.id = rv.book_id
           WHERE rv.user_id = ? AND rv.rating >= 4
           UNION ALL
           SELECT b.genre_id, 1 AS weight FROM reading_list rl JOIN books b ON b.id = rl.book_id
           WHERE rl.user_id = ?
         ) GROUP BY genre_id
       )
       SELECT ${SUMMARY_COLUMNS}
       FROM ${SUMMARY_FROM}
       JOIN affinity af ON af.genre_id = b.genre_id
       WHERE b.id NOT IN (SELECT book_id FROM reviews WHERE user_id = ?)
         AND b.id NOT IN (SELECT book_id FROM reading_list WHERE user_id = ?)
       ORDER BY af.weight DESC, coalesce(r.average, 0) DESC, b.id
       LIMIT ?`,
      userId,
      userId,
      userId,
      userId,
      limit,
    ).map(toBookSummary);
    return picks.length > 0 ? picks : featuredBooks(limit);
  }

  // --- Genres and authors ----------------------------------------------------------------------

  function listGenres(): Genre[] {
    return all<Genre>(
      `SELECT g.id, g.slug, g.name, count(b.id) AS bookCount
       FROM genres g LEFT JOIN books b ON b.genre_id = g.id
       GROUP BY g.id ORDER BY g.name`,
    ).map((row) => ({ ...row }));
  }

  function getGenre(slug: string): Genre | null {
    const row = get<Genre>(
      `SELECT g.id, g.slug, g.name, count(b.id) AS bookCount
       FROM genres g LEFT JOIN books b ON b.genre_id = g.id
       WHERE g.slug = ? GROUP BY g.id`,
      slug,
    );
    return row === undefined ? null : { ...row };
  }

  /** Authors by name; `q` filters by a case-insensitive substring of the name. */
  function listAuthors({ q, ...paging }: Paging & { q?: string } = {}): Page<AuthorSummary> {
    const { page, pageSize, offset } = normalizePaging(paging.page, paging.pageSize);
    const pattern = q?.trim() ? `%${q.trim().replace(/[\\%_]/g, "\\$&")}%` : null;
    const where = pattern === null ? "" : "WHERE a.name LIKE ? ESCAPE '\\'";
    const params: SQLInputValue[] = pattern === null ? [] : [pattern];
    const total = count(`SELECT count(*) AS n FROM authors a ${where}`, ...params);
    const items = all<AuthorSummary>(
      `SELECT a.id, a.slug, a.name,
         (SELECT count(*) FROM book_authors ba WHERE ba.author_id = a.id) AS bookCount
       FROM authors a ${where}
       ORDER BY a.name COLLATE NOCASE, a.id LIMIT ? OFFSET ?`,
      ...params,
      pageSize,
      offset,
    ).map((row) => ({ ...row }));
    return { ...pageInfo(total, page, pageSize), items };
  }

  /** The author's books: `listBooks({ author: slug })`. */
  function getAuthor(slug: string): Author | null {
    const row = get<AuthorRow>(
      `SELECT a.id, a.slug, a.name, a.bio, a.country, a.birth_year,
         (SELECT count(*) FROM book_authors ba WHERE ba.author_id = a.id) AS book_count,
         stats.average, stats.review_count
       FROM authors a,
         (SELECT avg(rv.rating) AS average, count(rv.id) AS review_count
            FROM book_authors ba JOIN reviews rv ON rv.book_id = ba.book_id
            JOIN authors x ON x.id = ba.author_id WHERE x.slug = ?) stats
       WHERE a.slug = ?`,
      slug,
      slug,
    );
    if (row === undefined) return null;
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      bio: row.bio,
      country: row.country,
      birthYear: row.birth_year,
      bookCount: row.book_count,
      rating: ratingSummary(row.average, row.review_count),
    };
  }

  // --- Reviews ---------------------------------------------------------------------------------

  /** A book's reviews, newest first. */
  function listReviews(bookId: number, paging: Paging = {}): Page<Review> {
    const { page, pageSize, offset } = normalizePaging(
      paging.page,
      paging.pageSize,
      REVIEWS_PAGE_SIZE,
    );
    const total = count("SELECT count(*) AS n FROM reviews WHERE book_id = ?", bookId);
    const items = all<ReviewRow>(
      `SELECT ${REVIEW_COLUMNS} FROM reviews rv JOIN users u ON u.id = rv.user_id
       WHERE rv.book_id = ? ORDER BY rv.created_at DESC, rv.id DESC LIMIT ? OFFSET ?`,
      bookId,
      pageSize,
      offset,
    ).map(toReview);
    return { ...pageInfo(total, page, pageSize), items };
  }

  /** A user's reviews with their books, newest first (profile page). */
  function listUserReviews(userId: number, paging: Paging = {}): Page<UserReview> {
    const { page, pageSize, offset } = normalizePaging(
      paging.page,
      paging.pageSize,
      REVIEWS_PAGE_SIZE,
    );
    const total = count("SELECT count(*) AS n FROM reviews WHERE user_id = ?", userId);
    const items = all<UserReviewRow>(
      `SELECT ${REVIEW_COLUMNS}, b.isbn AS book_isbn, b.title AS book_title
       FROM reviews rv JOIN users u ON u.id = rv.user_id JOIN books b ON b.id = rv.book_id
       WHERE rv.user_id = ? ORDER BY rv.created_at DESC, rv.id DESC LIMIT ? OFFSET ?`,
      userId,
      pageSize,
      offset,
    ).map((row) => ({ ...toReview(row), book: { isbn: row.book_isbn, title: row.book_title } }));
    return { ...pageInfo(total, page, pageSize), items };
  }

  function getReview(reviewId: number): Review | null {
    const row = get<ReviewRow>(
      `SELECT ${REVIEW_COLUMNS} FROM reviews rv JOIN users u ON u.id = rv.user_id
       WHERE rv.id = ?`,
      reviewId,
    );
    return row === undefined ? null : toReview(row);
  }

  /** The user's own review of a book, to prefill the edit form. */
  function getUserReview(userId: number, bookId: number): Review | null {
    const row = get<ReviewRow>(
      `SELECT ${REVIEW_COLUMNS} FROM reviews rv JOIN users u ON u.id = rv.user_id
       WHERE rv.user_id = ? AND rv.book_id = ?`,
      userId,
      bookId,
    );
    return row === undefined ? null : toReview(row);
  }

  /** One review per user and book: a second one is a `conflict`. */
  function createReview(
    userId: number,
    bookId: number,
    input: ReviewInput,
    now: Date = new Date(),
  ): MutationResult<Review> {
    return transaction(db, () => {
      if (!exists("SELECT 1 FROM books WHERE id = ?", bookId)) {
        return { ok: false, reason: "not-found" } as const;
      }
      const at = timestamp(now);
      const inserted = get<{ id: number }>(
        `INSERT INTO reviews (book_id, user_id, rating, title, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (book_id, user_id) DO NOTHING
         RETURNING id`,
        bookId,
        userId,
        input.rating,
        input.title,
        input.body,
        at,
        at,
      );
      if (inserted === undefined) return { ok: false, reason: "conflict" } as const;
      return { ok: true, value: getReview(inserted.id)! } as const;
    });
  }

  /** Only the author of a review may edit it (`forbidden` otherwise). */
  function updateReview(
    userId: number,
    reviewId: number,
    input: ReviewInput,
    now: Date = new Date(),
  ): MutationResult<Review> {
    return transaction(db, () => {
      const denied = checkOwnership(reviewId, userId);
      if (denied !== null) return denied;
      statement(
        db,
        "UPDATE reviews SET rating = ?, title = ?, body = ?, updated_at = ? WHERE id = ?",
      ).run(input.rating, input.title, input.body, timestamp(now), reviewId);
      return { ok: true, value: getReview(reviewId)! } as const;
    });
  }

  /** Only the author of a review may delete it (`forbidden` otherwise). */
  function deleteReview(
    userId: number,
    reviewId: number,
  ): MutationResult<{ id: number; bookId: number }> {
    return transaction(db, () => {
      const denied = checkOwnership(reviewId, userId);
      if (denied !== null) return denied;
      const row = get<{ book_id: number }>(
        "DELETE FROM reviews WHERE id = ? RETURNING book_id",
        reviewId,
      )!;
      return { ok: true, value: { id: reviewId, bookId: row.book_id } } as const;
    });
  }

  function checkOwnership(
    reviewId: number,
    userId: number,
  ): { ok: false; reason: "not-found" | "forbidden" } | null {
    const owner = get<{ user_id: number }>("SELECT user_id FROM reviews WHERE id = ?", reviewId);
    if (owner === undefined) return { ok: false, reason: "not-found" };
    if (owner.user_id !== userId) return { ok: false, reason: "forbidden" };
    return null;
  }

  // --- Reading list --------------------------------------------------------------------------

  /** Idempotent: `added` is false when the book was already on the list. */
  function addToReadingList(
    userId: number,
    bookId: number,
    now: Date = new Date(),
  ): MutationResult<{ added: boolean }> {
    if (!exists("SELECT 1 FROM books WHERE id = ?", bookId)) {
      return { ok: false, reason: "not-found" };
    }
    const { changes } = statement(
      db,
      `INSERT INTO reading_list (user_id, book_id, added_at) VALUES (?, ?, ?)
       ON CONFLICT (user_id, book_id) DO NOTHING`,
    ).run(userId, bookId, timestamp(now));
    return { ok: true, value: { added: Number(changes) === 1 } };
  }

  /** True when the book was on the list. */
  function removeFromReadingList(userId: number, bookId: number): boolean {
    const { changes } = statement(
      db,
      "DELETE FROM reading_list WHERE user_id = ? AND book_id = ?",
    ).run(userId, bookId);
    return Number(changes) === 1;
  }

  function isOnReadingList(userId: number, bookId: number): boolean {
    return exists("SELECT 1 FROM reading_list WHERE user_id = ? AND book_id = ?", userId, bookId);
  }

  /** Which of `bookIds` are on the user's list: the initial state of a page's toggle islands. */
  function readingListIds(userId: number, bookIds: readonly number[]): number[] {
    if (bookIds.length === 0) return [];
    return all<{ book_id: number }>(
      `SELECT book_id FROM reading_list
       WHERE user_id = ? AND book_id IN (SELECT value FROM json_each(?))
       ORDER BY book_id`,
      userId,
      JSON.stringify(bookIds),
    ).map((row) => row.book_id);
  }

  /** The user's list, most recently added first. */
  function readingList(userId: number, paging: Paging = {}): Page<ReadingListEntry> {
    const { page, pageSize, offset } = normalizePaging(paging.page, paging.pageSize);
    const total = count("SELECT count(*) AS n FROM reading_list WHERE user_id = ?", userId);
    const items = all<BookSummaryRow & { added_at: string }>(
      `SELECT ${SUMMARY_COLUMNS}, rl.added_at
       FROM reading_list rl JOIN books b ON b.id = rl.book_id ${SUMMARY_JOINS}
       WHERE rl.user_id = ? ORDER BY rl.added_at DESC, b.id DESC LIMIT ? OFFSET ?`,
      userId,
      pageSize,
      offset,
    ).map((row) => ({ book: toBookSummary(row), addedAt: row.added_at }));
    return { ...pageInfo(total, page, pageSize), items };
  }

  // --- Users -----------------------------------------------------------------------------------

  function getUserById(id: number): User | null {
    const row = get<UserRow>("SELECT id, email, name, created_at FROM users WHERE id = ?", id);
    return row === undefined ? null : toUser(row);
  }

  /** Case-insensitive. */
  function getUserByEmail(email: string): User | null {
    const row = get<UserRow>(
      "SELECT id, email, name, created_at FROM users WHERE email = ?",
      email.trim(),
    );
    return row === undefined ? null : toUser(row);
  }

  return {
    listBooks,
    getBook,
    featuredBooks,
    trendingBooks,
    recommendationsFor,
    listGenres,
    getGenre,
    listAuthors,
    getAuthor,
    listReviews,
    listUserReviews,
    getReview,
    getUserReview,
    createReview,
    updateReview,
    deleteReview,
    addToReadingList,
    removeFromReadingList,
    isOnReadingList,
    readingListIds,
    readingList,
    getUserById,
    getUserByEmail,
  };
}

let shared: Queries | undefined;

/** Queries over the app's shared database (`getDatabase()`). */
export function queries(): Queries {
  return (shared ??= createQueries(getDatabase()));
}

// --- Row mapping -------------------------------------------------------------------------------

function toBookSummary(row: BookSummaryRow): BookSummary {
  return {
    id: row.id,
    isbn: row.isbn,
    title: row.title,
    year: row.year,
    genre: { slug: row.genre_slug, name: row.genre_name },
    authors: row.authors_json === null ? [] : (JSON.parse(row.authors_json) as AuthorRef[]),
    rating: ratingSummary(row.average, row.review_count),
    coverHue: row.cover_hue,
  };
}

function ratingSummary(average: number | null, count: number): RatingSummary {
  return { average: average === null ? null : Math.round(average * 100) / 100, count };
}

function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    bookId: row.book_id,
    user: { id: row.user_id, name: row.user_name },
    rating: row.rating as Rating,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toUser(row: UserRow): User {
  return { id: row.id, email: row.email, name: row.name, createdAt: row.created_at };
}
