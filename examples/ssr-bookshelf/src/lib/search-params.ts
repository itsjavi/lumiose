// URL search params <-> book filters, shared by the books page, its pager links and the live
// search island. No server imports.

import type { BookFilters, BookSort } from "../types.ts";

export const BOOK_SORTS: readonly BookSort[] = ["title", "newest", "oldest", "rating", "relevance"];

/** Parses a `?page=` value; anything that is not a positive integer becomes 1. */
export function parsePageParam(value: string | null | undefined): number {
  if (value == null || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export function parseBookSort(value: string | null | undefined): BookSort | undefined {
  return BOOK_SORTS.find((sort) => sort === value);
}

/** Reads `q`, `genre`, `author`, `sort` and `page`; unknown or empty values are dropped. */
export function parseBookFilters(params: URLSearchParams): BookFilters {
  const filters: BookFilters = { page: parsePageParam(params.get("page")) };
  const q = params.get("q")?.trim();
  if (q) filters.q = q;
  const genre = params.get("genre");
  if (genre) filters.genre = genre;
  const author = params.get("author");
  if (author) filters.author = author;
  const sort = parseBookSort(params.get("sort"));
  if (sort) filters.sort = sort;
  return filters;
}

/** The inverse of `parseBookFilters`, omitting defaults (page 1, no sort) for clean URLs. */
export function bookFiltersToParams(filters: BookFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.author) params.set("author", filters.author);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.page !== undefined && filters.page > 1) params.set("page", String(filters.page));
  return params;
}
