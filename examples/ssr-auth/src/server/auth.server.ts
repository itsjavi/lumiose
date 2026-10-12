// Better Auth with email and password accounts, stored by Prisma. Created on first use inside a
// request, so `env()` reads the request's environment (the `.env` files in dev).
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { env, href, locals, redirect, url, type RequestContext } from "lumiose";
import { forwardedFor, parseTrustedProxies } from "./client-address.server.ts";
import { prisma } from "./db.server.ts";

function createAuth(trustedProxies: string[]) {
  return betterAuth({
    // Required in production: a random value of at least 32 bytes (openssl rand -base64 32).
    secret: env("BETTER_AUTH_SECRET"),
    // The public URL, such as https://example.com: Better Auth checks request origins against it.
    baseURL: env("BETTER_AUTH_URL"),
    database: prismaAdapter(prisma(), { provider: "sqlite" }),
    emailAndPassword: { enabled: true },
    // The rate limiter (on in production) keys requests by client address: see authHandler().
    advanced: { ipAddress: { trustedProxies } },
  });
}

let instance: { auth: ReturnType<typeof createAuth>; trustedProxies: string[] } | undefined;

function setup() {
  if (instance === undefined) {
    // Proxies in front of the app whose X-Forwarded-For to believe, such as 127.0.0.1 for an
    // nginx on the same machine. Without them, the address the host saw is the client's.
    const trustedProxies = parseTrustedProxies(env("TRUSTED_PROXIES"));
    instance = { auth: createAuth(trustedProxies), trustedProxies };
  }
  return instance;
}

export function auth(): ReturnType<typeof createAuth> {
  return setup().auth;
}

type AuthContext = Pick<RequestContext, "request" | "url" | "platform">;

function clientHeaders(ctx: AuthContext, headers: Headers): Headers {
  const forwarded = forwardedFor(
    ctx.request.headers,
    ctx.platform.clientAddress,
    setup().trustedProxies,
  );
  if (forwarded === undefined) headers.delete("x-forwarded-for");
  else headers.set("x-forwarded-for", forwarded);
  return headers;
}

/** Better Auth's HTTP API for a request, with the client's address for its rate limiter. */
export function authHandler(ctx: AuthContext): Promise<Response> {
  const headers = clientHeaders(ctx, new Headers(ctx.request.headers));
  return auth().handler(new Request(ctx.request, { headers }));
}

/**
 * Posts `body` to one of Better Auth's endpoints (`/sign-in/email`) from a form action, through its
 * HTTP handler as its browser client would, so its rate limiter counts the attempt: the limiter
 * runs on HTTP requests only, never on calls through `auth.api`.
 */
export function authRequest(
  ctx: AuthContext,
  path: `/${string}`,
  body: unknown,
): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json" });
  for (const name of ["cookie", "origin", "referer", "user-agent"]) {
    const value = ctx.request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const request = new Request(new URL(`/api/auth${path}`, ctx.url), {
    method: "POST",
    headers: clientHeaders(ctx, headers),
    body: JSON.stringify(body),
  });
  return auth().handler(request);
}

/** The message of a failed Better Auth response: "Invalid email or password", "Too many requests…". */
export async function authError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { message?: unknown } | null;
  return typeof body?.message === "string" ? body.message : response.statusText;
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

/** A 303 redirect that sets the cookies of a Better Auth response (or `returnHeaders`). */
export function redirectWithCookies(location: string, headers: Headers): Response {
  const response = new Response(null, { status: 303, headers: { location } });
  for (const cookie of headers.getSetCookie()) response.headers.append("set-cookie", cookie);
  return response;
}

/** `next` when it is a path on this site, else `fallback`: never a redirect to another site. */
export function safeNext(next: string | null, fallback: string = href("/dashboard")): string {
  return next !== null && /^\/(?![/\\])/.test(next) ? next : fallback;
}
