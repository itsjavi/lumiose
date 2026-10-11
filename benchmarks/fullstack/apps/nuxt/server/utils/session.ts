import { SESSION_COOKIE, sessionUser, type User } from "@bench/data";
import type { H3Event } from "h3";

/** The user of the unsigned `uid` session cookie (doc-4 §2), if any. */
export const currentUser = (event: H3Event): User | undefined =>
  sessionUser(getCookie(event, SESSION_COOKIE));

/** The signed-in user; a 401 without a session (the page then goes to /login). */
export function requireUser(event: H3Event): User {
  const user = currentUser(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  return user;
}

// Same cookie as the other apps: not `Secure`, since the benchmark serves plain http.
const OPTIONS = { path: "/", httpOnly: true, sameSite: "lax", secure: false } as const;

export const startSession = (event: H3Event, user: User) =>
  setCookie(event, SESSION_COOKIE, String(user.id), OPTIONS);

export const endSession = (event: H3Event) => deleteCookie(event, SESSION_COOKIE, OPTIONS);

/** A numeric route parameter, or a 404. */
export function idParam(event: H3Event, name = "id"): number {
  const value = getRouterParam(event, name) ?? "";
  if (!/^\d+$/.test(value)) throw createError({ statusCode: 404, statusMessage: "Not Found" });
  return Number(value);
}
