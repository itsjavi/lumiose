// GET /api/issues/:id: the JSON of getIssue(id); 404 when there is no such issue.
import type { Endpoint } from "lumiose";
import { getIssue } from "../../../server/data.ts";

export const GET: Endpoint<"/api/issues/[id]"> = (ctx) => {
  const issue = /^\d+$/.test(ctx.params.id) ? getIssue(Number(ctx.params.id)) : undefined;
  return issue === undefined
    ? Response.json({ error: "Not found" }, { status: 404 })
    : Response.json(issue);
};
