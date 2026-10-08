import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIGRATIONS, migrate, openDatabase, schemaVersion, transaction } from "./db.server.ts";
import {
  generateCatalog,
  isValidIsbn13,
  isbn13,
  seed,
  slugify,
  type Catalog,
} from "./seed.server.ts";
import { TEST_SCRYPT } from "./test-helpers.ts";

const unique = (values: string[]) => new Set(values).size === values.length;

const count = (db: ReturnType<typeof openDatabase>, table: string) =>
  (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;

describe("migrations", () => {
  it("migrates a new database to the latest version once", () => {
    const db = openDatabase(":memory:");
    expect(schemaVersion(db)).toBe(MIGRATIONS.at(-1)!.version);
    expect(migrate(db)).toBe(0);
    db.close();
  });

  it("uses WAL and foreign keys for file databases", () => {
    const dir = mkdtempSync(join(tmpdir(), "bookshelf-"));
    try {
      const db = openDatabase(join(dir, "nested", "test.db"));
      expect(db.prepare("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" });
      expect(db.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rolls back a failed transaction, including nested ones", () => {
    const db = openDatabase(":memory:");
    expect(() =>
      transaction(db, () => {
        db.prepare("INSERT INTO genres (slug, name) VALUES ('a', 'A')").run();
        transaction(db, () =>
          db.prepare("INSERT INTO genres (slug, name) VALUES ('b', 'B')").run(),
        );
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(count(db, "genres")).toBe(0);

    transaction(db, () => {
      db.prepare("INSERT INTO genres (slug, name) VALUES ('a', 'A')").run();
      expect(() =>
        transaction(db, () => {
          db.prepare("INSERT INTO genres (slug, name) VALUES ('b', 'B')").run();
          throw new Error("inner");
        }),
      ).toThrow("inner");
    });
    expect(count(db, "genres")).toBe(1);
    db.close();
  });
});

describe("generated catalog", () => {
  const catalog: Catalog = generateCatalog();

  it("is deterministic for a seed", () => {
    expect(generateCatalog()).toEqual(catalog);
    expect(generateCatalog({ seed: 7 }).books[0]!.title).not.toBe(catalog.books[0]!.title);
  });

  it("has the planned size and every author has a book", () => {
    expect(catalog.genres).toHaveLength(12);
    expect(catalog.authors).toHaveLength(60);
    expect(catalog.books).toHaveLength(200);
    expect(catalog.users).toHaveLength(40);
    expect(catalog.reviews).toHaveLength(600);
    const authorsWithBooks = new Set(catalog.books.flatMap((book) => book.authorIds));
    expect(authorsWithBooks.size).toBe(60);
  });

  it("has unique, valid identifiers", () => {
    expect(catalog.books.every((book) => isValidIsbn13(book.isbn))).toBe(true);
    expect(unique(catalog.books.map((book) => book.isbn))).toBe(true);
    expect(unique(catalog.books.map((book) => book.title))).toBe(true);
    expect(unique(catalog.authors.map((author) => author.slug))).toBe(true);
    expect(unique(catalog.users.map((user) => user.email))).toBe(true);
    expect(unique(catalog.reviews.map((review) => `${review.bookId}:${review.userId}`))).toBe(true);
  });

  it("has plausible values", () => {
    for (const book of catalog.books) {
      expect(book.year).toBeGreaterThanOrEqual(1950);
      expect(book.year).toBeLessThanOrEqual(2026);
      expect(book.pages).toBeGreaterThan(0);
      expect(book.title).not.toMatch(/\{|\}|\bA [AEIO]/);
      expect(book.description).not.toMatch(/\{|\}/);
    }
    const ratings = new Set(catalog.reviews.map((review) => review.rating));
    expect([...ratings].toSorted()).toEqual([1, 2, 3, 4, 5]);
    for (const review of catalog.reviews) {
      const book = catalog.books[review.bookId - 1]!;
      expect(review.createdAt).toBeGreaterThanOrEqual(Date.UTC(book.year, 0, 1));
      expect(review.updatedAt).toBeGreaterThanOrEqual(review.createdAt);
    }
    const reviewed = new Set(catalog.reviews.map((r) => `${r.bookId}:${r.userId}`));
    expect(catalog.readingList.some((e) => reviewed.has(`${e.bookId}:${e.userId}`))).toBe(false);
  });
});

describe("seed", () => {
  it("writes the catalog and indexes it for search", async () => {
    const db = openDatabase(":memory:");
    const summary = await seed(db, { scrypt: TEST_SCRYPT });
    expect(summary).toMatchObject({ genres: 12, authors: 60, books: 200, users: 40, reviews: 600 });
    expect(count(db, "reading_list")).toBe(summary.readingList);
    expect(count(db, "book_search")).toBe(200);
    expect(count(db, "book_search WHERE authors = ''")).toBe(0);
    await expect(seed(db, { scrypt: TEST_SCRYPT })).rejects.toThrow("already has books");
    db.close();
  });
});

describe("identifiers", () => {
  it("computes ISBN-13 check digits", () => {
    expect(isbn13("978030640615")).toBe("9780306406157");
    expect(isValidIsbn13("9780306406157")).toBe(true);
    expect(isValidIsbn13("9780306406158")).toBe(false);
    expect(() => isbn13("123")).toThrow(RangeError);
  });

  it("slugifies names with diacritics and punctuation", () => {
    expect(slugify("Inés García")).toBe("ines-garcia");
    expect(slugify("Mireille Ødegaard")).toBe("mireille-odegaard");
    expect(slugify("Niall O'Sullivan")).toBe("niall-osullivan");
    expect(slugify("  Kaito  Wójcik! ")).toBe("kaito-wojcik");
  });
});
