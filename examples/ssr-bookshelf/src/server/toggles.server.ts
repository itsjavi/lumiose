// Reading-list toggle state for a page of books: one query for every card on the page.
import { locals, url } from "lumen";
import type { ToggleState } from "../components/BookCard.stsx";
import type { BookSummary } from "../types.ts";
import { queries } from "./queries.server.ts";

/** The signed-in reader's toggle state for `books`; `undefined` (no toggles) when signed out. */
export function readingListToggles(books: readonly BookSummary[]): ToggleState | undefined {
  const user = locals().user;
  if (user == null) return undefined;
  const ids = new Set(
    queries().readingListIds(
      user.id,
      books.map((book) => book.id),
    ),
  );
  const current = url();
  return { onList: (bookId) => ids.has(bookId), next: current.pathname + current.search };
}
