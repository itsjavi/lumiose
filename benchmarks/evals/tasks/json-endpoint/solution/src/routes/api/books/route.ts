import type { Endpoint } from "lumiose";
import { books } from "../../../lib/books.ts";

export const GET: Endpoint<"/api/books"> = ({ url }) => {
  const q = url.searchParams.get("q")?.toLowerCase() ?? "";
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit === null ? 10 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || rawLimit === "") {
    return Response.json({ error: "limit must be an integer from 1 to 50" }, { status: 400 });
  }
  const found = books
    .filter((book) => book.title.toLowerCase().includes(q) || book.author.toLowerCase().includes(q))
    .toSorted((a, b) => a.year - b.year || a.id - b.id)
    .slice(0, limit);
  return Response.json(found);
};
