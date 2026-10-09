import { getIssue } from "@bench/data";
import type { Route } from "./+types/api.issue";

export function loader({ params }: Route.LoaderArgs) {
  const issue = /^\d+$/.test(params.id) ? getIssue(Number(params.id)) : undefined;
  if (!issue) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(issue);
}
