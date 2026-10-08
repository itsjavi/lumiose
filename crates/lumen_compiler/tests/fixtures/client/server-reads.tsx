// LUM2001 in server pages (TASK-86): calls of `lumen`'s request APIs and of imports from
// server-only modules (`*.server.*`, `src/server/**`) are not reactive reads. Signals, props and
// `lumen/router`'s accessors still are.
import { locals, url as requestUrl, signal } from "lumen";
import { url } from "lumen/router";
import { queries } from "../server/queries.server.ts";
import { session } from "./server/session.ts";

export default function BookPage(props: { isbn: string }) {
  const book = queries().getBook("0-00");
  const featured = queries().featuredBooks(6);
  const user = locals().user ?? null;
  const next = requestUrl().searchParams.get("next");
  const search = requestUrl().searchParams;
  const theme = session().theme;
  if (!locals().user) {
    return null;
  }
  return (
    <main data-user={user} data-next={next} data-search={search} data-theme={theme}>
      {book.title}
      {featured.length}
    </main>
  );
}

export function Island(props: { isbn: string }) {
  const count = signal(0);
  const doubled = count() * 2;
  const upper = props.isbn.toUpperCase();
  const query = url().searchParams.get("q");
  return (
    <p data-isbn={upper} data-query={query}>
      {doubled}
    </p>
  );
}
