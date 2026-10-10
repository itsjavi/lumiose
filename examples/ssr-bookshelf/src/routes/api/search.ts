// Live search suggestions for the search island (TASK-36): the top 8 matches for `?q=`.
import type { Endpoint } from "lumiose";
import { queries } from "../../server/queries.server.ts";

export const mode = "server";

export const GET: Endpoint<"/api/search"> = (ctx) => {
  const q = ctx.url.searchParams.get("q")?.trim() ?? "";
  if (q === "") return Response.json({ results: [] });
  const { items } = queries().listBooks({ q, pageSize: 8 });
  return Response.json({
    results: items.map((book) => ({
      isbn: book.isbn,
      title: book.title,
      authors: book.authors.map((author) => author.name),
    })),
  });
};
