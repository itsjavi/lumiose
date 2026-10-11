import { getIssue } from "@bench/data";
import type { APIEvent } from "@solidjs/start/server";

export function GET({ params }: APIEvent) {
  const issue = /^\d+$/.test(params.id!) ? getIssue(Number(params.id)) : undefined;
  if (!issue) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(issue);
}
