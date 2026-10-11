import { searchIssues } from "@bench/data";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ url }) =>
  json(searchIssues(url.searchParams.get("q") ?? "", 8));
