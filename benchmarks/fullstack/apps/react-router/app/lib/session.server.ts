import { SESSION_COOKIE, sessionUser, type User } from "@bench/data";
import { redirect } from "react-router";

const COOKIE = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`);

/** The signed-in user, from the unsigned `uid` cookie (doc-4 §2). */
export function getUser(request: Request): User | undefined {
  return sessionUser(COOKIE.exec(request.headers.get("Cookie") ?? "")?.[1]);
}

/** The signed-in user; redirects to /login without a session. */
export function requireUser(request: Request): User {
  const user = getUser(request);
  if (!user) throw redirect("/login");
  return user;
}

export const sessionCookie = (user: User) =>
  `${SESSION_COOKIE}=${user.id}; Path=/; HttpOnly; SameSite=Lax`;

export const clearedSessionCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
