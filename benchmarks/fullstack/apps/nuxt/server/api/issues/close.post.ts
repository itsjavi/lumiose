import { closeIssues } from "@bench/data";

/** Bulk close: the project page posts the checked issue ids. */
export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const { ids } = await readBody<{ ids?: unknown }>(event);
  const valid = Array.isArray(ids) ? ids.map(Number).filter(Number.isInteger) : [];
  return { closed: closeIssues(valid, user.id) };
});
