// GET /api/issues/:id: the JSON of getIssue(id); 404 when there is no such issue.
import type { Endpoint, RequestContext } from "lumen";
import { getIssue } from "../../../server/data.ts";

export const GET: Endpoint<{ id: string }> = (ctx: RequestContext<{ id: string }>) => {
  const issue = /^\d+$/.test(ctx.params.id) ? getIssue(Number(ctx.params.id)) : undefined;
  return issue === undefined
    ? Response.json({ error: "Not found" }, { status: 404 })
    : Response.json(issue);
};
