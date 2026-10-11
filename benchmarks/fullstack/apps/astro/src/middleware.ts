import { SESSION_COOKIE, sessionUser } from "@bench/data";
import { defineMiddleware } from "astro:middleware";

/** Reads the session cookie of doc-4 §2 into `Astro.locals.user`. */
export const onRequest = defineMiddleware((context, next) => {
  context.locals.user = sessionUser(context.cookies.get(SESSION_COOKIE)?.value);
  return next();
});
