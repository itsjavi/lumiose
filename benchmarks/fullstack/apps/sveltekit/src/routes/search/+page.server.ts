import { searchIssues } from "@bench/data";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ url }) => {
  const q = url.searchParams.get("q")?.trim() ?? "";
  return { q, hits: searchIssues(q) };
};
