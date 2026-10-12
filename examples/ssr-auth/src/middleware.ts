// Puts the session on `ctx.locals` for every page, endpoint and action.
import { getSessionCookie } from "better-auth/cookies";
import type { Middleware } from "lumiose";
import { auth } from "./server/auth.server.ts";

const middleware: Middleware = async (ctx, next) => {
  ctx.locals.session = null;
  // Without a session cookie the visitor is signed out: no database query. (This is also the case
  // while prerendering.) Better Auth's own routes read the session themselves.
  if (getSessionCookie(ctx.request) === null || ctx.url.pathname.startsWith("/api/auth/")) {
    return next();
  }
  const { response: session, headers } = await auth().api.getSession({
    headers: ctx.request.headers,
    returnHeaders: true,
  });
  ctx.locals.session = session;
  const response = await next();
  // Better Auth extends a session that passed its update age: send the renewed cookie along.
  const cookies = headers.getSetCookie();
  if (cookies.length === 0) return response;
  const renewed = new Response(response.body, response);
  for (const cookie of cookies) renewed.headers.append("set-cookie", cookie);
  return renewed;
};

export default middleware;
