import { isStatus, updateIssueStatus } from "@bench/data";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const { status } = await readBody<{ status?: unknown }>(event);
  if (!isStatus(status)) throw createError({ statusCode: 400, statusMessage: "Unknown status" });
  if (!updateIssueStatus(idParam(event), status, user.id)) {
    throw createError({ statusCode: 404, statusMessage: "Not Found" });
  }
  return { ok: true };
});
