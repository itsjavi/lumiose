// Deterministic seed: the same PRNG seed always yields the same catalog, users, reviews and
// reading lists (only password salts are random). Run it with Node's type stripping:
//
//   node src/server/seed.server.ts             # recreate data/bookshelf.db (or $BOOKSHELF_DB)
//   node src/server/seed.server.ts --if-empty  # keep an already seeded database

import { existsSync, rmSync } from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { defaultDatabasePath, openDatabase, statement, transaction } from "./db.server.ts";
import { DEFAULT_SCRYPT, hashPassword, type ScryptParams } from "./password.server.ts";
import {
  AUTHOR_BIO,
  FIRST_NAMES,
  GENRES,
  LAST_NAMES,
  PLACES,
  REVIEW_TEXT,
  type GenreSpec,
} from "./seed-data.server.ts";

/** Every seeded user signs in with this password. */
export const DEMO_PASSWORD = "bookshelf";
/** A seeded user with reviews and a reading list, for trying the app. */
export const DEMO_EMAIL = "reader@example.com";

const DEFAULT_SEED = 0xb00c5;
const DAY = 86_400_000;
/** Seeded activity ends here, so the data does not depend on when the seed runs. */
const SEED_END = Date.UTC(2026, 8, 30, 18, 0, 0);
const ACCOUNTS_START = Date.UTC(2023, 0, 1);
const ACCOUNTS_END = Date.UTC(2025, 5, 30);

export interface SeedOptions {
  seed?: number;
  books?: number;
  authors?: number;
  users?: number;
  reviews?: number;
  /** Cost of the seeded password hashes; tests pass a cheap one. */
  scrypt?: ScryptParams;
}

export interface SeedSummary {
  genres: number;
  authors: number;
  books: number;
  users: number;
  reviews: number;
  readingList: number;
}

// --- Randomness --------------------------------------------------------------------------------

export type Random = ReturnType<typeof createRandom>;

/** mulberry32: a small, fast, seedable PRNG. */
export function createRandom(seedValue: number) {
  let state = seedValue >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const random = {
    next,
    /** Integer in [min, max]. */
    int: (min: number, max: number): number => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new RangeError("pick() from an empty list");
      return items[Math.floor(next() * items.length)]!;
    },
    chance: (probability: number): boolean => next() < probability,
    /** Standard normal (Box-Muller). */
    normal: (): number => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next()),
    weighted: <T>(items: readonly T[], weight: (item: T) => number): T => {
      const total = items.reduce((sum, item) => sum + weight(item), 0);
      let target = next() * total;
      for (const item of items) {
        target -= weight(item);
        if (target < 0) return item;
      }
      return items[items.length - 1]!;
    },
    /** A time between `start` and `end`, denser towards `end` (recent activity). */
    recentTime: (start: number, end: number): number =>
      Math.round(start + (end - start) * (1 - next() ** 2)),
  };
  return random;
}

// --- Identifiers -------------------------------------------------------------------------------

/** Appends the ISBN-13 check digit to 12 digits. */
export function isbn13(first12: string): string {
  if (!/^\d{12}$/.test(first12)) throw new RangeError(`isbn13() needs 12 digits, got "${first12}"`);
  let sum = 0;
  for (let index = 0; index < 12; index++)
    sum += Number(first12[index]) * (index % 2 === 0 ? 1 : 3);
  return `${first12}${(10 - (sum % 10)) % 10}`;
}

export function isValidIsbn13(isbn: string): boolean {
  return /^\d{13}$/.test(isbn) && isbn13(isbn.slice(0, 12)) === isbn;
}

const TRANSLITERATIONS: Record<string, string> = { ø: "o", æ: "ae", ß: "ss", ł: "l", đ: "d" };

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[øæßłđ]/g, (char) => TRANSLITERATIONS[char]!)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// --- Generation --------------------------------------------------------------------------------

export interface SeedAuthor {
  id: number;
  slug: string;
  name: string;
  bio: string;
  country: string;
  birthYear: number;
  genres: GenreSpec[];
  prolific: number;
  quality: number;
}

export interface SeedBook {
  id: number;
  isbn: string;
  title: string;
  subtitle: string | null;
  description: string;
  year: number;
  pages: number;
  genreId: number;
  coverHue: number;
  authorIds: number[];
  quality: number;
  popularity: number;
}

export interface SeedUser {
  id: number;
  email: string;
  name: string;
  createdAt: number;
}

export interface SeedReview {
  bookId: number;
  userId: number;
  rating: number;
  title: string | null;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface SeedReadingListEntry {
  userId: number;
  bookId: number;
  addedAt: number;
}

export interface Catalog {
  genres: Array<{ id: number; slug: string; name: string }>;
  authors: SeedAuthor[];
  books: SeedBook[];
  users: SeedUser[];
  reviews: SeedReview[];
  readingList: SeedReadingListEntry[];
}

/** Builds the whole data set in memory; pure and deterministic for a given seed. */
export function generateCatalog(options: SeedOptions = {}): Catalog {
  const random = createRandom(options.seed ?? DEFAULT_SEED);
  const genres = GENRES.map((genre, index) => ({
    id: index + 1,
    slug: genre.slug,
    name: genre.name,
  }));
  const genreId = new Map(GENRES.map((genre, index) => [genre, index + 1]));
  const authors = generateAuthors(random, options.authors ?? 60);
  const books = generateBooks(random, options.books ?? 200, authors, genreId);
  const users = generateUsers(random, options.users ?? 40);
  const reviews = generateReviews(random, options.reviews ?? 600, books, users);
  const readingList = generateReadingLists(random, users, books, reviews);
  return { genres, authors, books, users, reviews, readingList };
}

function generateAuthors(random: Random, count: number): SeedAuthor[] {
  const authors: SeedAuthor[] = [];
  const names = new Set<string>();
  while (authors.length < count) {
    const first = random.pick(FIRST_NAMES);
    const last = random.pick(LAST_NAMES);
    const name = `${first} ${last}`;
    if (names.has(name)) continue;
    names.add(name);
    const primary = random.weighted(GENRES, (genre) => genre.weight);
    const secondary = random.chance(0.3) ? random.pick(GENRES) : primary;
    const birthYear = random.int(1922, 1994);
    const place = random.pick(PLACES);
    const elsewhere = random.pick(PLACES.filter((other) => other !== place));
    const themes = [random.pick(AUTHOR_BIO.words.Theme), random.pick(AUTHOR_BIO.words.Theme)];
    const slots: Record<string, string> = {
      First: first,
      Last: last,
      City: place.city,
      Country: place.country,
      City2: elsewhere.city,
      Year: String(birthYear),
      Age: String(random.int(24, 58)),
      Languages: String(random.int(3, 30)),
      Theme: themes[0]!,
      Theme2: themes[1] === themes[0] ? "the places we leave behind" : themes[1]!,
    };
    const bio = [AUTHOR_BIO.origins, AUTHOR_BIO.careers, AUTHOR_BIO.themes, AUTHOR_BIO.endings]
      .map((sentences) => fill(random.pick(sentences), random, AUTHOR_BIO.words, slots))
      .join(" ");
    authors.push({
      id: authors.length + 1,
      slug: slugify(name),
      name,
      bio,
      country: place.country,
      birthYear,
      genres: primary === secondary ? [primary] : [primary, secondary],
      prolific: random.pick([1, 1, 2, 2, 3, 4, 6]),
      quality: 2.7 + random.next() * 1.8,
    });
  }
  return authors;
}

function generateBooks(
  random: Random,
  count: number,
  authors: SeedAuthor[],
  genreId: Map<GenreSpec, number>,
): SeedBook[] {
  const books: SeedBook[] = [];
  const titles = new Set<string>();
  const isbns = new Set<string>();
  while (books.length < count) {
    // Every author gets at least one book; prolific authors get more.
    const author =
      books.length < authors.length
        ? authors[books.length]!
        : random.weighted(authors, (candidate) => candidate.prolific);
    const genre = random.pick(author.genres);
    const authorIds = [author.id];
    if (random.chance(0.07)) {
      const coauthor = random.pick(authors);
      if (coauthor !== author) authorIds.push(coauthor.id);
    }
    const slots = narrativeSlots(random, genre);
    let title = "";
    for (let attempt = 0; attempt < 50 && (title === "" || titles.has(title)); attempt++) {
      title = fill(random.pick(genre.titles), random, genre.words, slots, "title");
    }
    if (titles.has(title)) continue;
    titles.add(title);
    let isbn: string;
    do {
      isbn = isbn13(`978${String(random.int(0, 999_999_999)).padStart(9, "0")}`);
    } while (isbns.has(isbn));
    isbns.add(isbn);
    const description = [random.pick(genre.premises), random.pick(genre.closers)]
      .map((sentence) => fill(sentence, random, genre.words, slots))
      .join(" ");
    const earliest = Math.max(author.birthYear + 24, 1950);
    const latest = Math.min(2026, author.birthYear + 80);
    books.push({
      id: books.length + 1,
      isbn,
      title,
      subtitle: random.chance(0.3)
        ? fill(random.pick(genre.subtitles), random, genre.words, slots, "title")
        : null,
      description,
      year: random.int(Math.min(earliest, latest), latest),
      pages: Math.round(random.int(genre.pages[0], genre.pages[1]) / 8) * 8,
      genreId: genreId.get(genre)!,
      coverHue: random.int(0, 359),
      authorIds,
      quality: clamp(author.quality + random.normal() * 0.45, 1.6, 4.9),
      // A few books are much more popular than the rest.
      popularity: 0.3 + random.next() ** 3 * 12,
    });
  }
  return books;
}

function generateUsers(random: Random, count: number): SeedUser[] {
  const users: SeedUser[] = [
    { id: 1, email: DEMO_EMAIL, name: "Demo Reader", createdAt: ACCOUNTS_START },
  ];
  const emails = new Set([DEMO_EMAIL]);
  while (users.length < count) {
    const first = random.pick(FIRST_NAMES);
    const last = random.pick(LAST_NAMES);
    const email = `${slugify(first)}.${slugify(last).replace(/-/g, "")}@example.com`;
    if (emails.has(email)) continue;
    emails.add(email);
    users.push({
      id: users.length + 1,
      email,
      name: `${first} ${last[0]}.`,
      createdAt: random.int(ACCOUNTS_START, ACCOUNTS_END),
    });
  }
  return users;
}

function generateReviews(
  random: Random,
  count: number,
  books: SeedBook[],
  users: SeedUser[],
): SeedReview[] {
  const reviews: SeedReview[] = [];
  const reviewed = new Set<string>();
  const capacity = books.length * users.length;
  while (reviews.length < Math.min(count, capacity)) {
    const book = random.weighted(books, (candidate) => candidate.popularity);
    const user = random.pick(users);
    const key = `${book.id}:${user.id}`;
    if (reviewed.has(key)) continue;
    reviewed.add(key);
    const rating = clamp(Math.round(book.quality + random.normal() * 0.85), 1, 5);
    const tone = rating <= 2 ? "low" : rating === 3 ? "mid" : "high";
    const aspect = random.pick(REVIEW_TEXT.aspects);
    const sentences = [
      random.pick(REVIEW_TEXT.openers[tone]),
      random.pick(REVIEW_TEXT.details[tone]),
      ...(random.chance(0.5) ? [random.pick(REVIEW_TEXT.details[tone])] : []),
      random.pick(REVIEW_TEXT.closers[tone]),
    ];
    const body = [...new Set(sentences)]
      .join(" ")
      .replaceAll("{aspect}", aspect)
      .replaceAll("{Aspect}", aspect[0]!.toUpperCase() + aspect.slice(1));
    const start = Math.max(user.createdAt, Date.UTC(book.year, 0, 1));
    const createdAt = random.recentTime(start, SEED_END);
    const edited = random.chance(0.1);
    reviews.push({
      bookId: book.id,
      userId: user.id,
      rating,
      title: random.chance(0.75) ? random.pick(REVIEW_TEXT.titles[tone]) : null,
      body,
      createdAt,
      updatedAt: edited ? Math.min(SEED_END, createdAt + random.int(1, 30) * DAY) : createdAt,
    });
  }
  // Insert in chronological order so review ids grow with time.
  return reviews.toSorted((a, b) => a.createdAt - b.createdAt || a.bookId - b.bookId);
}

function generateReadingLists(
  random: Random,
  users: SeedUser[],
  books: SeedBook[],
  reviews: SeedReview[],
): SeedReadingListEntry[] {
  const reviewed = new Set(reviews.map((review) => `${review.bookId}:${review.userId}`));
  const entries: SeedReadingListEntry[] = [];
  for (const user of users) {
    const wanted = random.int(user.email === DEMO_EMAIL ? 6 : 0, 12);
    const chosen = new Set<number>();
    for (let attempt = 0; chosen.size < wanted && attempt < wanted * 10; attempt++) {
      const book = random.weighted(books, (candidate) => candidate.popularity);
      if (chosen.has(book.id) || reviewed.has(`${book.id}:${user.id}`)) continue;
      chosen.add(book.id);
      entries.push({
        userId: user.id,
        bookId: book.id,
        addedAt: random.recentTime(user.createdAt, SEED_END),
      });
    }
  }
  return entries;
}

/** Per-book picks, so a title and its description talk about the same hero, place and object. */
function narrativeSlots(random: Random, genre: GenreSpec): Record<string, string> {
  const slots: Record<string, string> = {
    Hero: random.pick(FIRST_NAMES),
    Name: random.pick(FIRST_NAMES),
    Surname: random.pick(LAST_NAMES),
  };
  for (const key of ["Place", "Role", "Object", "Threat", "Goal", "Topic"]) {
    const words = genre.words[key];
    if (words !== undefined && words.length > 0) slots[key] = random.pick(words);
  }
  return slots;
}

const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "the",
  "to",
]);
/** Title words that read as common nouns inside a sentence ("the price of ember"). */
const TITLE_WORD_KEYS = new Set(["Adj", "Noun", "Nouns"]);

/**
 * Replaces `{Key}` with a fixed slot value, or else a random word from `words[Key]`. Titles are
 * title-cased; prose starts with a capital and keeps title words lowercase.
 */
function fill(
  template: string,
  random: Random,
  words: Record<string, string[]>,
  slots: Record<string, string>,
  style: "title" | "prose" = "prose",
): string {
  const text = template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const fixed = slots[key];
    if (fixed !== undefined) return fixed;
    const list = words[key];
    if (list === undefined || list.length === 0) {
      throw new Error(`Seed template "${template}" has no words for {${key}}.`);
    }
    const word = random.pick(list);
    return style === "prose" && TITLE_WORD_KEYS.has(key) ? word.toLowerCase() : word;
  });
  // "a" before a vowel sound reads as "an" ("An Inheritance", "an AI auditor"; not "a User's").
  const agreed = text.replace(/\b([Aa]) (?=[AEIOaeio])/g, "$1n ");
  if (style === "prose") return agreed[0]!.toUpperCase() + agreed.slice(1);
  return agreed
    .split(" ")
    .map((word, index, all) =>
      index > 0 && !all[index - 1]!.endsWith(":") && SMALL_WORDS.has(word.toLowerCase())
        ? word.toLowerCase()
        : word[0]!.toUpperCase() + word.slice(1),
    )
    .join(" ");
}

function iso(time: number): string {
  return new Date(time).toISOString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// --- Writing -----------------------------------------------------------------------------------

/** Seeds an empty, migrated database. Hashing the users' passwords dominates the run time. */
export async function seed(db: DatabaseSync, options: SeedOptions = {}): Promise<SeedSummary> {
  const existing = statement(db, "SELECT count(*) AS n FROM books").get() as { n: number };
  if (existing.n > 0) throw new Error("The database already has books; seed an empty database.");
  const catalog = generateCatalog(options);
  const params = options.scrypt ?? DEFAULT_SCRYPT;
  const hashes = await Promise.all(catalog.users.map(() => hashPassword(DEMO_PASSWORD, params)));

  transaction(db, () => {
    const insertGenre = db.prepare("INSERT INTO genres (id, slug, name) VALUES (?, ?, ?)");
    for (const genre of catalog.genres) insertGenre.run(genre.id, genre.slug, genre.name);

    const insertAuthor = db.prepare(
      "INSERT INTO authors (id, slug, name, bio, country, birth_year) VALUES (?, ?, ?, ?, ?, ?)",
    );
    for (const author of catalog.authors) {
      insertAuthor.run(
        author.id,
        author.slug,
        author.name,
        author.bio,
        author.country,
        author.birthYear,
      );
    }

    const insertBook = db.prepare(
      `INSERT INTO books (id, isbn, title, subtitle, description, year, pages, genre_id, cover_hue)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertBookAuthor = db.prepare(
      "INSERT INTO book_authors (book_id, author_id, position) VALUES (?, ?, ?)",
    );
    for (const book of catalog.books) {
      insertBook.run(
        book.id,
        book.isbn,
        book.title,
        book.subtitle,
        book.description,
        book.year,
        book.pages,
        book.genreId,
        book.coverHue,
      );
      book.authorIds.forEach((authorId, position) =>
        insertBookAuthor.run(book.id, authorId, position),
      );
    }

    const insertUser = db.prepare(
      "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
    );
    catalog.users.forEach((user, index) =>
      insertUser.run(user.id, user.email, user.name, hashes[index]!, iso(user.createdAt)),
    );

    const insertReview = db.prepare(
      `INSERT INTO reviews (book_id, user_id, rating, title, body, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const review of catalog.reviews) {
      insertReview.run(
        review.bookId,
        review.userId,
        review.rating,
        review.title,
        review.body,
        iso(review.createdAt),
        iso(review.updatedAt),
      );
    }

    const insertEntry = db.prepare(
      "INSERT INTO reading_list (user_id, book_id, added_at) VALUES (?, ?, ?)",
    );
    for (const entry of catalog.readingList) {
      insertEntry.run(entry.userId, entry.bookId, iso(entry.addedAt));
    }
  });

  return {
    genres: catalog.genres.length,
    authors: catalog.authors.length,
    books: catalog.books.length,
    users: catalog.users.length,
    reviews: catalog.reviews.length,
    readingList: catalog.readingList.length,
  };
}

// --- CLI ---------------------------------------------------------------------------------------

async function main(args: readonly string[]): Promise<void> {
  const file = defaultDatabasePath();
  if (args.includes("--if-empty") && existsSync(file)) {
    const db = openDatabase(file);
    const { n } = statement(db, "SELECT count(*) AS n FROM books").get() as { n: number };
    db.close();
    if (n > 0) {
      console.log(`${file} already has ${n} books; skipping the seed.`);
      return;
    }
  }
  for (const suffix of ["", "-wal", "-shm"]) rmSync(`${file}${suffix}`, { force: true });
  const started = performance.now();
  const db = openDatabase(file);
  const summary = await seed(db);
  db.close();
  const counts = Object.entries(summary)
    .map(([table, count]) => `${count} ${table}`)
    .join(", ");
  console.log(`Seeded ${file} in ${Math.round(performance.now() - started)} ms: ${counts}.`);
  console.log(`Sign in as ${DEMO_EMAIL} with password "${DEMO_PASSWORD}" (shared by all users).`);
}

if (import.meta.main) await main(process.argv.slice(2));
