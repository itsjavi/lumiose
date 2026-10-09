import { searchIssues } from "@bench/data";
import type { NextRequest } from "next/server";

export function GET(request: NextRequest) {
  return Response.json(searchIssues(request.nextUrl.searchParams.get("q") ?? "", 8));
}
