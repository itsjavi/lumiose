// Better Auth's HTTP API under /api/auth/* (sessions, sign-in, sign-out, …), which its browser
// client calls.
import type { Endpoint } from "lumiose";
import { authHandler } from "../../../../server/auth.server.ts";

export const GET: Endpoint<"/api/auth/[...all]"> = (ctx) => authHandler(ctx);
export const POST: Endpoint<"/api/auth/[...all]"> = (ctx) => authHandler(ctx);
