import { SESSION_COOKIE, type User } from "@bench/data";
import { redirect, type RequestContext } from "lumen";

/** The signed-in user; mutating actions without a session redirect to /login (doc-4 §2). */
export function requireUser(ctx: RequestContext): User {
  return ctx.locals.user ?? redirect("/login");
}

export function login(ctx: RequestContext, user: User): void {
  ctx.cookies.set(SESSION_COOKIE, String(user.id), { secure: false });
}

export function logout(ctx: RequestContext): void {
  ctx.cookies.delete(SESSION_COOKIE, { secure: false });
}
