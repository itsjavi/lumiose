// GET /api/search?q=: the search box's suggestions, the JSON of searchIssues(q, 8).
import type { Endpoint } from "lumiose";
import { searchIssues } from "../../../server/data.ts";

export const GET: Endpoint<"/api/search"> = (ctx) => {
  const q = ctx.url.searchParams.get("q")?.trim() ?? "";
  return Response.json(q === "" ? [] : searchIssues(q, 8));
};
