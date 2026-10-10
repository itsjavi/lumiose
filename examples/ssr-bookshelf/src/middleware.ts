// Resolves the signed-in user once per request, before any page renders: `currentUser` may write
// the session cookie, which must happen before the response starts (LUM5004).
import type { Middleware } from "lumiose";
import { auth } from "./server/auth.server.ts";

const middleware: Middleware = async (ctx, next) => {
  ctx.locals.user = await auth().currentUser(ctx.cookies);
  return next();
};

export default middleware;
