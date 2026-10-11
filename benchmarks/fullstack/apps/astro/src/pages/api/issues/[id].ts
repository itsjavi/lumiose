import { getIssue } from "@bench/data";
import type { APIRoute } from "astro";

export const GET: APIRoute = ({ params }) => {
  const issue = /^\d+$/.test(params.id ?? "") ? getIssue(Number(params.id)) : undefined;
  if (!issue) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(issue);
};
