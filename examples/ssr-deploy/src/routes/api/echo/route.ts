// What the platform passes to the app: ctx.platform and ctx.env.
import type { Endpoint } from "lumiose";
// An npm package: the platforms' bundlers (or @vercel/nft) must ship it with the server.
import { stringify } from "yaml";

declare module "lumiose" {
  interface PlatformEnv {
    /** A Cloudflare variable (wrangler.jsonc `vars`). */
    GREETING?: string;
  }
}

export const mode = "server";

export const GET: Endpoint<"/api/echo"> = (ctx) =>
  Response.json({
    clientAddress: ctx.platform.clientAddress ?? null,
    greeting: ctx.platform.env.GREETING ?? ctx.env.GREETING ?? null,
    waitUntil: typeof ctx.platform.waitUntil,
    url: ctx.url.href,
    yaml: stringify({ ok: true }).trim(),
  });

export const POST: Endpoint<"/api/echo"> = async (ctx) =>
  new Response(`posted ${await ctx.request.text()}`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
