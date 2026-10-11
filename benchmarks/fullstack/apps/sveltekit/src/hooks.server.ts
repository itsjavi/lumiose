import { SESSION_COOKIE, sessionUser } from "@bench/data";
import type { Handle } from "@sveltejs/kit/hooks";

/** Resolves the unsigned `uid` session cookie (doc-4 §2) once per request. */
export const handle: Handle = ({ event, resolve }) => {
  event.locals.user = sessionUser(event.cookies.get(SESSION_COOKIE));
  return resolve(event);
};
