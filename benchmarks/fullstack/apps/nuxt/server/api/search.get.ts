import { searchIssues } from "@bench/data";

// The JSON endpoint of doc-4 §2: `searchIssues(q, 8)`. The search page asks for its 20 results
// with `limit=20`.
export default defineEventHandler((event) => {
  const query = getQuery(event);
  const limit = query.limit === "20" ? 20 : 8;
  return searchIssues(String(query.q ?? ""), limit);
});
