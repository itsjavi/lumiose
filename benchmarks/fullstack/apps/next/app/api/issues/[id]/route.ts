import { getIssue } from "@bench/data";

export async function GET(_request: Request, { params }: RouteContext<"/api/issues/[id]">) {
  const { id } = await params;
  const issue = /^\d+$/.test(id) ? getIssue(Number(id)) : undefined;
  if (!issue) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(issue);
}
