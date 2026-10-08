// Domain types shared by pages, islands and server modules. Type-only and free of server imports,
// so client code (islands) can import it. Every value is plain, serializable data: dates are
// ISO-8601 strings and ids are numbers, so these objects can cross the island boundary as props.

export interface Genre {
  id: number;
  slug: string;
  name: string;
  bookCount: number;
}

export interface AuthorRef {
  slug: string;
  name: string;
}

export interface AuthorSummary extends AuthorRef {
  id: number;
  bookCount: number;
}

export interface Author extends AuthorSummary {
  bio: string;
  country: string;
  birthYear: number;
  /** Across every review of the author's books. */
  rating: RatingSummary;
}

export interface RatingSummary {
  /** Rounded to 2 decimals; `null` when the book has no reviews. */
  average: number | null;
  count: number;
}

/** A book as shown in lists and cards. */
export interface BookSummary {
  id: number;
  /** ISBN-13 (valid check digit); the book's public id in URLs (`/books/:isbn`). */
  isbn: string;
  title: string;
  year: number;
  genre: { slug: string; name: string };
  authors: AuthorRef[];
  rating: RatingSummary;
  /** Hue (0-359) for the generated cover. */
  coverHue: number;
}

export interface Book extends BookSummary {
  subtitle: string | null;
  description: string;
  pages: number;
  /** Review counts per star: index 0 holds 1-star reviews, index 4 holds 5-star reviews. */
  ratingHistogram: [number, number, number, number, number];
}

export type Rating = 1 | 2 | 3 | 4 | 5;

export interface Review {
  id: number;
  bookId: number;
  user: { id: number; name: string };
  rating: Rating;
  title: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/** A review listed on a user's profile, with the reviewed book. */
export interface UserReview extends Review {
  book: { isbn: string; title: string };
}

/** The public view of a user. Never carries the password hash. */
export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

export interface ReadingListEntry {
  book: BookSummary;
  addedAt: string;
}

/** `relevance` only applies with a search query; without one it falls back to `title`. */
export type BookSort = "title" | "newest" | "oldest" | "rating" | "relevance";

/** Filters of the book list (`/books?q=&genre=&sort=&page=`). */
export interface BookFilters {
  /** Full-text search over title, authors and description (prefix match per word). */
  q?: string;
  /** Genre slug. */
  genre?: string;
  /** Author slug. */
  author?: string;
  /** Default: `relevance` with a query, otherwise `title`. */
  sort?: BookSort;
  page?: number;
  pageSize?: number;
}

export interface PageInfo {
  /** 1-based; may exceed `pageCount` when the request asked for a page past the end. */
  page: number;
  pageSize: number;
  total: number;
  /** At least 1, so an empty result still has one (empty) page. */
  pageCount: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface Page<T> extends PageInfo {
  items: T[];
}

export type FieldErrors<Field extends string> = Partial<Record<Field, string>>;

/** Outcome of a mutation that checks existence and ownership. */
export type MutationResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "not-found" | "forbidden" | "conflict" };
