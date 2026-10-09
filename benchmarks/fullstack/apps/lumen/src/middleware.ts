// Resolves the session user from the `uid` cookie once per request (doc-4 §2: unsigned, this is a
// benchmark).
import { SESSION_COOKIE, sessionUser, type User } from "@bench/data";
import type { Middleware } from "lumen";

declare module "lumen" {
  interface Locals {
    user: User | undefined;
  }
}

const middleware: Middleware = (ctx, next) => {
  ctx.locals.user = sessionUser(ctx.cookies.get(SESSION_COOKIE));
  return next();
};

export default middleware;
