import { addComment, getIssue, validateComment } from "@bench/data";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const id = idParam(event);
  const result = validateComment((await readBody<{ body?: unknown }>(event)).body);
  if (!result.ok) {
    setResponseStatus(event, 400);
    return { errors: result.errors };
  }
  if (!getIssue(id)) throw createError({ statusCode: 404, statusMessage: "Not Found" });
  return addComment(id, result.value, user.id);
});
