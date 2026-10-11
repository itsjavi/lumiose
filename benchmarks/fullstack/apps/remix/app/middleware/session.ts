import { SESSION_COOKIE, sessionUser, type User } from "@bench/data";
import { createCookie } from "remix/cookie";
import { redirect } from "remix/response/redirect";
import { createContextKey, type Middleware } from "remix/router";

/**
 * The session cookie of doc-4 §2, unsigned (this is a benchmark). Same attributes as the other
 * apps: not `Secure`, since the benchmark serves plain http. `remix/cookie` stores the value
 * base64-encoded (`uid=MTI=` for user 12).
 */
export const sessionCookie = createCookie(SESSION_COOKIE, {
  httpOnly: true,
  sameSite: "Lax",
  path: "/",
});

/** The signed-in user, or null. */
export const CurrentUser = createContextKey<User | null>(null);

export function loadCurrentUser(): Middleware<{
  key: typeof CurrentUser;
  value: User | null;
  property: "currentUser";
}> {
  return async (context, next) => {
    const uid = await sessionCookie.parse(context.request.headers.get("Cookie"));
    context.set(CurrentUser, sessionUser(uid) ?? null, { property: "currentUser" });
    return next();
  };
}

/** Mutating actions need a session; without one they redirect to /login (doc-4 §2). */
export function requireUser(): Middleware {
  return (context, next) => (context.get(CurrentUser) ? next() : redirect("/login", 303));
}
