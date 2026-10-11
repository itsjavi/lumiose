import { searchIssues } from "@bench/data";
import type { APIRoute } from "astro";

export const GET: APIRoute = ({ url }) =>
  Response.json(searchIssues(url.searchParams.get("q") ?? "", 8));
