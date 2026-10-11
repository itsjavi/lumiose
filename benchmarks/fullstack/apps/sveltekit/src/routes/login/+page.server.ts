import { validateLogin } from "@bench/data";
import { fail, redirect } from "@sveltejs/kit";
import { startSession } from "#lib/server/session.ts";
import type { Actions } from "./$types";

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const username = (await request.formData()).get("username");
    const result = validateLogin(username);
    if (!result.ok) {
      return fail(400, { username: String(username ?? ""), error: result.errors.username });
    }
    startSession(cookies, result.value);
    redirect(303, "/");
  },
};
