// Server only: imported by the server functions of api.ts.
import { SESSION_COOKIE, sessionUser, type User } from "@bench/data";
import { redirect } from "@solidjs/router";
import { deleteCookie, setCookie } from "@solidjs/start/http";
import { getRequestEvent } from "solid-js/web";

const COOKIE = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`);

/**
 * The signed-in user, from the unsigned `uid` cookie (doc-4 §2). Read from the request event, not
 * the HTTP event: after an action, the single-flight render of the next page gets a request whose
 * cookie header already carries the action's `Set-Cookie`.
 */
export function currentUser(): User | undefined {
  return sessionUser(COOKIE.exec(getRequestEvent()?.request.headers.get("cookie") ?? "")?.[1]);
}

/** The signed-in user; redirects to /login without a session. */
export function requireUser(): User {
  const user = currentUser();
  if (!user) throw redirect("/login");
  return user;
}

export const startSession = (user: User) =>
  setCookie(SESSION_COOKIE, String(user.id), { path: "/", httpOnly: true, sameSite: "lax" });

export const endSession = () =>
  deleteCookie(SESSION_COOKIE, { path: "/", httpOnly: true, sameSite: "lax" });
