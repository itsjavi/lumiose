import { SESSION_COOKIE, type User } from "@bench/data";
import { redirect, type Cookies } from "@sveltejs/kit";

/** The signed-in user; redirects to /login without a session. */
export function requireUser(locals: App.Locals): User {
  if (!locals.user) redirect(303, "/login");
  return locals.user;
}

// Same cookie as the other apps: not `Secure`, since the benchmark serves plain http.
const OPTIONS = { path: "/", httpOnly: true, sameSite: "lax", secure: false } as const;

export const startSession = (cookies: Cookies, user: User) =>
  cookies.set(SESSION_COOKIE, String(user.id), OPTIONS);

export const endSession = (cookies: Cookies) => cookies.delete(SESSION_COOKIE, OPTIONS);
