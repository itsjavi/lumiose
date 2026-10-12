// Better Auth's HTTP API under /api/auth/* (sessions, sign-in, sign-out, …), which its browser
// client calls.
import type { Endpoint } from "lumiose";
import { auth } from "../../../../server/auth.server.ts";

export const GET: Endpoint<"/api/auth/[...all]"> = (ctx) => auth().handler(ctx.request);
export const POST: Endpoint<"/api/auth/[...all]"> = (ctx) => auth().handler(ctx.request);
