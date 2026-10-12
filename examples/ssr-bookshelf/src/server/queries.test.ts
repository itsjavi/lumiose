import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ReviewInput } from "../lib/validation.ts";
import type { BookSummary } from "../types.ts";
import type { DatabaseSync } from "./db.server.ts";
import { createQueries, toFtsQuery, type Queries } from "./queries.server.ts";
import { rollbackEach, seededDatabase } from "./test-helpers.ts";

let db: DatabaseSync;
let q: Queries;
const tx = rollbackEach(() => db);

beforeAll(async () => {
  db = await seededDatabase();
  q = createQueries(db, { recommendationDelayMs: 0 });
});
afterAll(() => db.close());
beforeEach(tx.begin);
afterEach(tx.rollback);

const rows = <T>(sql: string, ...params: Array<string | number>) =>
  db.prepare(sql).all(...params) as unknown as T[];
const nocase = (text: string) => text.replace(/[A-Z]/g, (char) => char.toLowerCase());
const review: ReviewInput = { rating: 4, title: "Good", body: "A thoroughly decent read." };

/** Reviewed book ids by user, to pick users who have or have not reviewed a book. */
function reviewers(bookId: number): Set<number> {
  return new Set(
    rows<{ user_id: number }>("SELECT user_id FROM reviews WHERE book_id = ?", bookId).map(
      (row) => row.user_id,
    ),
  );
}

function firstNonReviewer(bookId: number): number {
  const taken = reviewers(bookId);
  return rows<{ id: number }>("SELECT id FROM users ORDER BY id").find((u) => !taken.has(u.id))!.id;
}

describe("listBooks pagination", () => {
  it("reports totals and page counts and splits the catalog into disjoint pages", () => {
    const first = q.listBooks({ pageSize: 24 });
    expect(first).toMatchObject({ page: 1, pageSize: 24, total: 200, pageCount: 9 });
    expect(first.hasPrevious).toBe(false);
    expect(first.hasNext).toBe(true);
    expect(first.items).toHaveLength(24);

    const last = q.listBooks({ pageSize: 24, page: 9 });
    expect(last.items).toHaveLength(200 - 8 * 24);
    expect(last.hasNext).toBe(false);
    expect(last.hasPrevious).toBe(true);

    const ids = new Set<number>();
    for (let page = 1; page <= first.pageCount; page++) {
      for (const book of q.listBooks({ pageSize: 24, page }).items) ids.add(book.id);
    }
    expect(ids.size).toBe(200);
  });

  it("returns an empty page past the end and normalizes bad paging input", () => {
    const beyond = q.listBooks({ pageSize: 50, page: 7 });
    expect(beyond).toMatchObject({ page: 7, total: 200, pageCount: 4, hasNext: false });
    expect(beyond.items).toEqual([]);

    expect(q.listBooks({ page: 0, pageSize: 10 }).page).toBe(1);
    expect(q.listBooks({ page: -3, pageSize: 10 }).page).toBe(1);
    expect(q.listBooks({ pageSize: 1000 }).pageSize).toBe(100);
    expect(q.listBooks({ pageSize: 0 }).pageSize).toBe(1);
    expect(q.listBooks({ pageSize: Number.NaN }).pageSize).toBe(24);
  });

  it("counts filtered results, not the whole catalog", () => {
    const genre = q.listGenres().find((g) => g.bookCount > 12)!;
    const page = q.listBooks({ genre: genre.slug, pageSize: 5 });
    expect(page.total).toBe(genre.bookCount);
    expect(page.pageCount).toBe(Math.ceil(genre.bookCount / 5));
  });
});

/** The whole catalog (200 books) in one sort order. */
const all = (sort: "title" | "newest" | "oldest" | "rating") =>
  q
    .listBooks({ sort, pageSize: 100 })
    .items.concat(q.listBooks({ sort, pageSize: 100, page: 2 }).items);

const words = (text: string) => new Set(text.toLowerCase().match(/\p{L}{5,}/gu) ?? []);

describe("listBooks sorting and filters", () => {
  it("sorts by title, case-insensitively, by default", () => {
    const titles = all("title").map((book) => nocase(book.title));
    expect(titles).toEqual(titles.toSorted());
    expect(q.listBooks({ pageSize: 5 }).items).toEqual(all("title").slice(0, 5));
  });

  it("sorts by year both ways", () => {
    const newest = all("newest").map((book) => book.year);
    const oldest = all("oldest").map((book) => book.year);
    expect(newest).toEqual(newest.toSorted((a, b) => b - a));
    expect(oldest).toEqual(oldest.toSorted((a, b) => a - b));
  });

  it("sorts by Bayesian rating with unreviewed books last", () => {
    const books = all("rating");
    const mean = rows<{ mean: number }>("SELECT avg(rating) AS mean FROM reviews")[0]!.mean;
    const score = (book: BookSummary) =>
      book.rating.average === null
        ? -Infinity
        : (5 * mean + book.rating.average * book.rating.count) / (5 + book.rating.count);
    const scores = books.map(score);
    for (let index = 1; index < scores.length; index++) {
      // Averages are rounded to 2 decimals in the result, so allow for that.
      expect(scores[index]!).toBeLessThanOrEqual(scores[index - 1]! + 0.01);
    }
    const firstUnreviewed = books.findIndex((book) => book.rating.count === 0);
    if (firstUnreviewed !== -1) {
      expect(books.slice(firstUnreviewed).every((book) => book.rating.count === 0)).toBe(true);
    }
  });

  it("filters by genre and by author", () => {
    const genre = q.listGenres()[0]!;
    const byGenre = q.listBooks({ genre: genre.slug, pageSize: 100 });
    expect(byGenre.items.every((book) => book.genre.slug === genre.slug)).toBe(true);

    const author = q.listAuthors({ pageSize: 100 }).items.find((a) => a.bookCount > 1)!;
    const byAuthor = q.listBooks({ author: author.slug, pageSize: 100 });
    expect(byAuthor.total).toBe(author.bookCount);
    expect(byAuthor.items.every((book) => book.authors.some((a) => a.slug === author.slug))).toBe(
      true,
    );
    expect(q.listBooks({ genre: "no-such-genre" }).total).toBe(0);
  });
});

describe("listBooks search", () => {
  it("finds a book by its title", () => {
    const target = q.listBooks({ pageSize: 1, page: 37 }).items[0]!;
    const result = q.listBooks({ q: target.title });
    expect(result.items.slice(0, 3).map((book) => book.id)).toContain(target.id);
  });

  it("ranks title matches above description-only matches", () => {
    const books = rows<{ title: string; description: string }>(
      "SELECT title, description FROM books",
    );
    // A word that is in some title and, for another book, only in the description.
    const word = [...new Set(books.flatMap((book) => [...words(book.title)]))].find((candidate) =>
      books.some(
        (book) => !words(book.title).has(candidate) && words(book.description).has(candidate),
      ),
    )!;
    const result = q.listBooks({ q: word, pageSize: 100 }).items;
    const inTitle = result.map((book) => new RegExp(`\\b${word}`, "i").test(book.title));
    expect(inTitle).toContain(true);
    expect(inTitle).toContain(false);
    expect(inTitle).toEqual(inTitle.toSorted((a, b) => Number(b) - Number(a)));
  });

  it("matches word prefixes, author names without diacritics, and descriptions", () => {
    const author = rows<{ name: string; slug: string }>("SELECT name, slug FROM authors").find(
      (candidate) => candidate.name.normalize("NFKD") !== candidate.name,
    )!;
    const ascii = author.name.normalize("NFKD").replace(/\p{M}/gu, "");
    const authorBooks = q.listBooks({ author: author.slug, pageSize: 100 }).items;
    const byName = q.listBooks({ q: ascii, pageSize: 100 }).items;
    expect(authorBooks.length).toBeGreaterThan(0);
    expect(byName.map((b) => b.id)).toEqual(expect.arrayContaining(authorBooks.map((b) => b.id)));

    const book = q.getBook(q.listBooks({ pageSize: 1 }).items[0]!.isbn)!;
    const word = book.description.match(/[A-Za-z]{7,}/)![0];
    const byPrefix = q.listBooks({ q: word.slice(0, 5), pageSize: 100 });
    expect(byPrefix.items.map((b) => b.id)).toContain(book.id);
  });

  it("requires every word to match", () => {
    const one = q.listBooks({ q: "tower" }).total;
    const both = q.listBooks({ q: "tower ninth" }).total;
    expect(one).toBeGreaterThan(0);
    expect(both).toBeLessThanOrEqual(one);
  });

  it("treats FTS syntax as plain words and ignores word-less queries", () => {
    expect(() => q.listBooks({ q: '"unbalanced OR NOT * (' })).not.toThrow();
    expect(q.listBooks({ q: "!!! ..." }).total).toBe(200);
    expect(toFtsQuery('tower" OR x')).toBe('"tower"* "or"* "x"*');
    expect(toFtsQuery("  ")).toBeNull();
  });

  it("falls back to title order for relevance without a query", () => {
    expect(q.listBooks({ sort: "relevance", pageSize: 5 }).items).toEqual(
      q.listBooks({ sort: "title", pageSize: 5 }).items,
    );
  });

  it("keeps the search index in sync with books and authors", () => {
    const book = q.listBooks({ pageSize: 1 }).items[0]!;
    db.prepare("UPDATE books SET title = 'Zyzzyva Quarterly' WHERE id = ?").run(book.id);
    expect(q.listBooks({ q: "zyzzyva" }).items.map((b) => b.id)).toEqual([book.id]);

    const author = book.authors[0]!;
    db.prepare("UPDATE authors SET name = 'Quillon Vexmoor' WHERE slug = ?").run(author.slug);
    expect(q.listBooks({ q: "vexmoor" }).total).toBe(q.getAuthor(author.slug)!.bookCount);

    db.prepare("DELETE FROM books WHERE id = ?").run(book.id);
    expect(q.listBooks({ q: "zyzzyva" }).total).toBe(0);
  });
});

describe("book details and ratings", () => {
  it("aggregates the rating average, count and histogram from the reviews", () => {
    const books = q.listBooks({ sort: "rating", pageSize: 20 }).items;
    for (const summary of books) {
      const ratings = rows<{ rating: number }>(
        "SELECT rating FROM reviews WHERE book_id = ?",
        summary.id,
      ).map((row) => row.rating);
      const { summary: rating, histogram } = q.getBookRatings(summary.id);
      const mean = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      expect(rating).toEqual({ average: Math.round(mean * 100) / 100, count: ratings.length });
      // The same summary as the book cards, which read the book_ratings view.
      expect(rating).toEqual(summary.rating);
      expect(histogram.reduce((sum, n) => sum + n, 0)).toBe(ratings.length);
      expect(histogram[4]).toBe(ratings.filter((r) => r === 5).length);
    }
  });

  it("returns authors in order with the book and null for unknown ISBNs", () => {
    const [coauthored] = rows<{ book_id: number }>(
      "SELECT book_id FROM book_authors GROUP BY book_id HAVING count(*) > 1 LIMIT 1",
    );
    const isbn = rows<{ isbn: string }>(
      "SELECT isbn FROM books WHERE id = ?",
      coauthored!.book_id,
    )[0]!.isbn;
    const book = q.getBook(isbn)!;
    const expected = rows<{ slug: string }>(
      `SELECT a.slug FROM book_authors ba JOIN authors a ON a.id = ba.author_id
       WHERE ba.book_id = ? ORDER BY ba.position`,
      book.id,
    ).map((row) => row.slug);
    expect(book.authors.map((a) => a.slug)).toEqual(expected);
    expect(book.description.length).toBeGreaterThan(40);
    // The catalog record only: the book page renders its ratings in holes of their own.
    expect(book).not.toHaveProperty("rating");
    expect(q.getBook("0000000000000")).toBeNull();
  });

  it("reports an unreviewed book with a null average", () => {
    const book = q.listBooks({ pageSize: 1 }).items[0]!;
    db.prepare("DELETE FROM reviews WHERE book_id = ?").run(book.id);
    expect(q.getBookRatings(book.id)).toEqual({
      summary: { average: null, count: 0 },
      histogram: [0, 0, 0, 0, 0],
    });
  });

  it("lists a book's reviews newest first, paginated", () => {
    const book = q.listBooks({ sort: "rating", pageSize: 1 }).items[0]!;
    const page = q.listReviews(book.id, { pageSize: 3 });
    expect(page.total).toBe(book.rating.count);
    const reviews = q.listReviews(book.id, { pageSize: 100 }).items;
    const dates = reviews.map((r) => r.createdAt);
    expect(dates).toEqual(dates.toSorted().toReversed());
    expect(page.items).toEqual(reviews.slice(0, 3));
    expect(reviews.every((r) => r.bookId === book.id && r.user.name.length > 0)).toBe(true);
  });
});

describe("reviews are owned by their author", () => {
  const now = new Date("2026-10-01T12:00:00Z");

  it("creates one review per user and book", () => {
    const book = q.listBooks({ pageSize: 1 }).items[0]!;
    const userId = firstNonReviewer(book.id);
    const created = q.createReview(userId, book.id, review, now);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value).toMatchObject({
      bookId: book.id,
      user: { id: userId },
      rating: 4,
      createdAt: now.toISOString(),
    });
    expect(q.getUserReview(userId, book.id)).toEqual(created.value);
    expect(q.getBookRatings(book.id).summary.count).toBe(book.rating.count + 1);

    expect(q.createReview(userId, book.id, review)).toEqual({ ok: false, reason: "conflict" });
    expect(q.createReview(userId, 999_999, review)).toEqual({ ok: false, reason: "not-found" });
  });

  it("lets only the author update a review, and updates the aggregates", () => {
    const book = q.listBooks({ sort: "rating", pageSize: 1 }).items[0]!;
    const target = q.listReviews(book.id).items[0]!;
    const intruder = firstNonReviewer(book.id);

    const denied = q.updateReview(intruder, target.id, { ...review, rating: 1 });
    expect(denied).toEqual({ ok: false, reason: "forbidden" });
    expect(q.getReview(target.id)).toEqual(target);

    const updated = q.updateReview(target.user.id, target.id, { ...review, rating: 1 }, now);
    expect(updated.ok && updated.value).toMatchObject({
      rating: 1,
      body: review.body,
      createdAt: target.createdAt,
      updatedAt: now.toISOString(),
    });
    const after = q.getBookRatings(book.id).summary;
    expect(after.count).toBe(book.rating.count);
    expect(after.average!).toBeLessThan(book.rating.average!);
    expect(q.updateReview(target.user.id, 999_999, review)).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("lets only the author delete a review", () => {
    const book = q.listBooks({ sort: "rating", pageSize: 1 }).items[0]!;
    const target = q.listReviews(book.id).items[0]!;
    const intruder = firstNonReviewer(book.id);

    expect(q.deleteReview(intruder, target.id)).toEqual({ ok: false, reason: "forbidden" });
    expect(q.getReview(target.id)).not.toBeNull();
    expect(q.deleteReview(target.user.id, target.id)).toEqual({
      ok: true,
      value: { id: target.id, bookId: book.id },
    });
    expect(q.getReview(target.id)).toBeNull();
    expect(q.deleteReview(target.user.id, target.id)).toEqual({ ok: false, reason: "not-found" });
    expect(q.getBookRatings(book.id).summary.count).toBe(book.rating.count - 1);
  });

  it("lists a user's reviews with their books", () => {
    const page = q.listUserReviews(1, { pageSize: 5 });
    const total = rows<{ n: number }>("SELECT count(*) AS n FROM reviews WHERE user_id = 1")[0]!.n;
    expect(page.total).toBe(total);
    expect(page.items.every((r) => r.user.id === 1 && r.book.title.length > 0)).toBe(true);
  });
});

describe("reading list", () => {
  it("adds idempotently, lists newest first and removes", () => {
    const books = q.listBooks({ pageSize: 3, sort: "oldest" }).items;
    const userId = 2;
    for (const book of books) q.removeFromReadingList(userId, book.id);
    const before = q.readingList(userId, { pageSize: 100 }).total;

    books.forEach((book, index) => {
      const added = q.addToReadingList(userId, book.id, new Date(Date.UTC(2027, 0, index + 1)));
      expect(added).toEqual({ ok: true, value: { added: true } });
    });
    expect(q.addToReadingList(userId, books[0]!.id)).toEqual({ ok: true, value: { added: false } });
    expect(q.addToReadingList(userId, 999_999)).toEqual({ ok: false, reason: "not-found" });

    const list = q.readingList(userId, { pageSize: 3 });
    expect(list.total).toBe(before + 3);
    expect(list.items.map((entry) => entry.book.id)).toEqual(books.map((b) => b.id).toReversed());
    expect(q.isOnReadingList(userId, books[1]!.id)).toBe(true);
    expect(q.readingListIds(userId, [books[1]!.id, 999_999])).toEqual([books[1]!.id]);
    expect(q.readingListIds(userId, [])).toEqual([]);

    expect(q.removeFromReadingList(userId, books[1]!.id)).toBe(true);
    expect(q.removeFromReadingList(userId, books[1]!.id)).toBe(false);
    expect(q.isOnReadingList(userId, books[1]!.id)).toBe(false);
  });
});

describe("featured, trending and recommendations", () => {
  it("features reviewed books, best weighted rating first", () => {
    const featured = q.featuredBooks(5);
    expect(featured).toHaveLength(5);
    expect(featured.every((book) => book.rating.count > 0)).toBe(true);
    expect(q.listBooks({ sort: "rating", pageSize: 5 }).items).toEqual(featured);
  });

  it("ranks trending books by reviews inside the window", () => {
    const now = new Date("2026-09-30T18:00:00Z");
    const trending = q.trendingBooks({ days: 30, limit: 3, now });
    const counts = rows<{ book_id: number; n: number }>(
      `SELECT book_id, count(*) AS n FROM reviews
       WHERE created_at > ? AND created_at <= ? GROUP BY book_id ORDER BY n DESC`,
      new Date(now.getTime() - 30 * 86_400_000).toISOString(),
      now.toISOString(),
    );
    expect(trending).toHaveLength(3);
    expect(trending.map((b) => counts.find((c) => c.book_id === b.id)!.n)).toEqual(
      counts.slice(0, 3).map((c) => c.n),
    );
    expect(q.trendingBooks({ now: new Date("2000-01-01T00:00:00Z") })).toEqual([]);
    expect(q.trendingBooks({ limit: 2 })).toHaveLength(2);
  });

  it("recommends unread books from the user's favorite genres after a delay", async () => {
    const userId = 1;
    const seen = new Set(
      rows<{ book_id: number }>(
        "SELECT book_id FROM reviews WHERE user_id = ? UNION SELECT book_id FROM reading_list WHERE user_id = ?",
        userId,
        userId,
      ).map((row) => row.book_id),
    );
    const liked = new Set(
      rows<{ slug: string }>(
        `SELECT DISTINCT g.slug FROM reviews rv JOIN books b ON b.id = rv.book_id
         JOIN genres g ON g.id = b.genre_id WHERE rv.user_id = ? AND rv.rating >= 4
         UNION SELECT g.slug FROM reading_list rl JOIN books b ON b.id = rl.book_id
         JOIN genres g ON g.id = b.genre_id WHERE rl.user_id = ?`,
        userId,
        userId,
      ).map((row) => row.slug),
    );
    const started = performance.now();
    const picks = await q.recommendationsFor(userId, { limit: 4, delayMs: 30 });
    expect(performance.now() - started).toBeGreaterThanOrEqual(25);
    expect(picks).toHaveLength(4);
    expect(picks.every((book) => !seen.has(book.id) && liked.has(book.genre.slug))).toBe(true);

    expect(await q.recommendationsFor(null, { limit: 3 })).toEqual(q.featuredBooks(3));
  });

  it("stops waiting when aborted", async () => {
    const controller = new AbortController();
    const pending = q.recommendationsFor(1, { delayMs: 10_000, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("authors, genres and users", () => {
  it("pages authors by name and filters by a literal substring", () => {
    const page = q.listAuthors({ pageSize: 10 });
    expect(page.total).toBe(60);
    const names = page.items.map((a) => nocase(a.name));
    expect(names).toEqual(names.toSorted());
    const author = page.items[3]!;
    const fragment = author.name.slice(1, 4).toUpperCase();
    const filtered = q.listAuthors({ q: fragment, pageSize: 100 });
    expect(filtered.items.map((a) => a.id)).toContain(author.id);
    expect(q.listAuthors({ q: "%" }).total).toBe(0);
    expect(q.listAuthors({ q: "_" }).total).toBe(0);
  });

  it("returns an author with a rating across their books", () => {
    const summary = q.listAuthors({ pageSize: 1 }).items[0]!;
    const author = q.getAuthor(summary.slug)!;
    const ratings = rows<{ rating: number }>(
      `SELECT rv.rating FROM reviews rv JOIN book_authors ba ON ba.book_id = rv.book_id
       WHERE ba.author_id = ?`,
      author.id,
    ).map((row) => row.rating);
    expect(author).toMatchObject({ slug: summary.slug, bookCount: summary.bookCount });
    expect(author.bio.length).toBeGreaterThan(80);
    expect(author.rating.count).toBe(ratings.length);
    expect(q.getAuthor("nobody")).toBeNull();
  });

  it("counts books per genre", () => {
    const genres = q.listGenres();
    expect(genres).toHaveLength(12);
    expect(genres.reduce((sum, g) => sum + g.bookCount, 0)).toBe(200);
    expect(q.getGenre(genres[0]!.slug)).toEqual(genres[0]);
    expect(q.getGenre("nope")).toBeNull();
  });

  it("finds users by id or email (case-insensitive) without exposing the password hash", () => {
    const user = q.getUserByEmail(" Reader@Example.com ")!;
    expect(user).toEqual({
      id: 1,
      email: "reader@example.com",
      name: "Demo Reader",
      createdAt: expect.any(String),
    });
    expect(q.getUserById(1)).toEqual(user);
    expect(q.getUserByEmail("ghost@example.com")).toBeNull();
  });
});
