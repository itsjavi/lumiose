import { getIssue } from "@bench/data";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ params }) => {
  const issue = /^\d+$/.test(params.id) ? getIssue(Number(params.id)) : undefined;
  if (!issue) return json({ error: "Not found" }, { status: 404 });
  return json(issue);
};
