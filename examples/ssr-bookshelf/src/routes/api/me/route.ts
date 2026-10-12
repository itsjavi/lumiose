// The signed-in reader for the account menu island of prerendered pages: `{ user }` or
// `{ user: null }`. Private and never cached, since it depends on the session cookie.
import type { Endpoint } from "lumiose";

export const mode = "server";

export const GET: Endpoint<"/api/me"> = (ctx) =>
  Response.json(
    { user: ctx.locals.user ?? null },
    { headers: { "cache-control": "private, no-store" } },
  );
