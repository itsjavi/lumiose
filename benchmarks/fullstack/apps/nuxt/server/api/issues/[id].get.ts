import { getIssue } from "@bench/data";

// The JSON endpoint of doc-4 §2 (`getIssue(id)`), also the issue page's data.
export default defineEventHandler((event) => {
  const issue = getIssue(idParam(event));
  if (!issue) throw createError({ statusCode: 404, statusMessage: "Not Found" });
  return issue;
});
