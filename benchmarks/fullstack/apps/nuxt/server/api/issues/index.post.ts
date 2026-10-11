import { createIssue, validateIssue, type IssueInput } from "@bench/data";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const result = validateIssue(await readBody<IssueInput>(event));
  if (!result.ok) {
    setResponseStatus(event, 400);
    return { errors: result.errors };
  }
  return { id: createIssue(result.value, user.id) };
});
