import { validateLogin } from "@bench/data";

export default defineEventHandler(async (event) => {
  const { username } = await readBody<{ username?: unknown }>(event);
  const result = validateLogin(username);
  if (!result.ok) {
    setResponseStatus(event, 400);
    return { errors: result.errors };
  }
  startSession(event, result.value);
  return { ok: true };
});
