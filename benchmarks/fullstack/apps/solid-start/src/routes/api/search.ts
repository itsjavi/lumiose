import { searchIssues } from "@bench/data";
import type { APIEvent } from "@solidjs/start/server";

export function GET({ request }: APIEvent) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return Response.json(searchIssues(q, 8));
}
