// Better Auth with email and password accounts, stored by Prisma. Created on first use inside a
// request, so `env()` reads the request's environment (the `.env` files in dev).
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { env, href, locals, redirect, url } from "lumiose";
import { prisma } from "./db.server.ts";

function createAuth() {
  return betterAuth({
    // Required in production: a random value of at least 32 bytes (openssl rand -base64 32).
    secret: env("BETTER_AUTH_SECRET"),
    // The public URL, such as https://example.com: Better Auth checks request origins against it.
    baseURL: env("BETTER_AUTH_URL"),
    database: prismaAdapter(prisma(), { provider: "sqlite" }),
    emailAndPassword: { enabled: true },
  });
}

let instance: ReturnType<typeof createAuth> | undefined;

export function auth(): ReturnType<typeof createAuth> {
  instance ??= createAuth();
  return instance;
}

/** `{ user, session }` of a signed-in request. */
export type AuthSession = ReturnType<typeof createAuth>["$Infer"]["Session"];

declare module "lumiose" {
  interface Locals {
    /** Set by src/middleware.ts: the signed-in user and session, or `null`. */
    session: AuthSession | null;
  }
}

/** The session of a page that needs one; without one, redirects to the sign-in page and back. */
export function requireSession(): AuthSession {
  const session = locals().session;
  if (session === null) {
    const { pathname, search } = url();
    redirect(`${href("/sign-in")}?next=${encodeURIComponent(pathname + search)}`);
  }
  return session;
}

/** A 303 redirect that sets the cookies Better Auth returned (`returnHeaders: true`). */
export function redirectWithCookies(location: string, headers: Headers): Response {
  const response = new Response(null, { status: 303, headers: { location } });
  for (const cookie of headers.getSetCookie()) response.headers.append("set-cookie", cookie);
  return response;
}

/** `next` when it is a path on this site, else `fallback`: never a redirect to another site. */
export function safeNext(next: string | null, fallback: string = href("/dashboard")): string {
  return next !== null && /^\/(?![/\\])/.test(next) ? next : fallback;
}
