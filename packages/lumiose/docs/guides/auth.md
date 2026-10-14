# Authentication with Better Auth

> Email and password accounts with Better Auth and Prisma: sign-up, sign-in and sign-out, the session in middleware and protected pages.

Lumiose has no auth module of its own: [Better Auth](https://www.better-auth.com) runs on any
server that hands it a web `Request`, and that is what endpoints, middleware and actions have. This
guide stores accounts with [Prisma](https://www.prisma.io) on a SQLite file. Every piece is in the
[ssr-auth sample](https://github.com/itsjavi/lumiose/tree/main/examples/ssr-auth), with an e2e test.

| File                                    | Role                                                                |
| --------------------------------------- | ------------------------------------------------------------------- |
| `prisma/schema.prisma`                  | Better Auth's tables.                                               |
| `src/server/db.server.ts`               | The Prisma client. Server-only.                                     |
| `src/server/auth.server.ts`             | The Better Auth instance and helpers for pages and actions.         |
| `src/server/client-address.server.ts`   | The client's address for Better Auth's rate limiter.                |
| `src/routes/api/auth/[...all]/route.ts` | Better Auth's HTTP API, for its browser client.                     |
| `src/middleware.ts`                     | The session on `ctx.locals`.                                        |
| `src/routes/sign-in/page.stsx`, …       | Form actions that post to Better Auth's handler, rate-limited.      |
| `src/islands/AccountMenu.stsx`          | An island that reads the session with Better Auth's browser client. |

## Setup

```sh
pnpm add better-auth @prisma/client @prisma/adapter-libsql @libsql/client
pnpm add -D prisma
```

Prisma 7 talks to the database through a driver adapter; `@prisma/adapter-libsql` opens SQLite
files with prebuilt binaries. For Postgres, swap it for `@prisma/adapter-pg` and the schema's
`provider`. pnpm asks whether `prisma` and `@prisma/engines` may run install scripts:
`allowBuilds` set to `false` for both works, since the CLI downloads its schema engine the first
time it needs it (`prisma migrate`).

`prisma.config.ts`, at the project root:

```ts
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "file:./data/auth.db" },
});
```

`prisma/schema.prisma` generates the client into `src/server/`, which makes it server-only, then
lists Better Auth's tables (`npx auth generate` writes them from your Better Auth config):

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/server/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

model User {
  id            String    @id
  name          String
  email         String
  emailVerified Boolean   @default(false)
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]

  @@unique([email])
  @@map("user")
}

// Session, Account and Verification: see the sample's schema.
```

Add `src/server/generated/` to `.gitignore`. `prisma generate` reads `tsconfig.json`, which extends
`.lumiose/tsconfig.generated.json`, so run `lumiose typegen` before it in a fresh checkout. The
sample's scripts do:

```json
{
  "scripts": {
    "dev": "lumiose typegen && prisma generate && prisma migrate deploy && lumiose dev",
    "build": "lumiose typegen && prisma generate && lumiose build",
    "typecheck": "lumiose typegen && prisma generate && lumiose check",
    "db:migrate": "prisma migrate deploy"
  }
}
```

Create the first migration with `prisma migrate dev --name init` and commit `prisma/migrations`.

| Variable             | Value                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET` | Signs Better Auth's cookies and tokens. A random value of at least 32 bytes (`openssl rand -base64 32`); a dev-only one in `.env.development`. |
| `BETTER_AUTH_URL`    | The public URL (`https://example.com`), in production. Without it Better Auth takes the origin from each request, which suits dev.             |
| `DATABASE_URL`       | `file:./data/auth.db` by default, relative to the working directory.                                                                           |
| `TRUSTED_PROXIES`    | Behind a proxy: its address (`127.0.0.1` for nginx or Caddy on the same machine), so the rate limiter sees each client's address. See below.   |

## Prisma as a server-only module

```ts
// src/server/db.server.ts
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { env } from "lumiose";
import { PrismaClient } from "./generated/prisma/client.ts";

let client: PrismaClient | undefined;

export function prisma(): PrismaClient {
  client ??= new PrismaClient({
    adapter: new PrismaLibSql({ url: env("DATABASE_URL") ?? "file:./data/auth.db" }),
  });
  return client;
}
```

Files under `src/server/` and named `*.server.ts` are server-only: an island or any other module
that reaches the browser and imports them, directly or through another module, fails
`lumiose dev` and `lumiose build` with [LUM4003](../errors/LUM4003.md), and `lumiose check` reports
it. The client is created on first use rather than at import, so `env()` reads the request's
environment: in dev, that includes the `.env` files.

## The Better Auth instance

```ts
// src/server/auth.server.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { env, href, locals, redirect, url, type RequestContext } from "lumiose";
import { forwardedFor, parseTrustedProxies } from "./client-address.server.ts";
import { prisma } from "./db.server.ts";

function createAuth(trustedProxies: string[]) {
  return betterAuth({
    secret: env("BETTER_AUTH_SECRET"),
    baseURL: env("BETTER_AUTH_URL"),
    database: prismaAdapter(prisma(), { provider: "sqlite" }),
    emailAndPassword: { enabled: true },
    // The rate limiter (on in production) keys requests by client address.
    advanced: { ipAddress: { trustedProxies } },
  });
}

let instance: { auth: ReturnType<typeof createAuth>; trustedProxies: string[] } | undefined;

function setup() {
  if (instance === undefined) {
    const trustedProxies = parseTrustedProxies(env("TRUSTED_PROXIES"));
    instance = { auth: createAuth(trustedProxies), trustedProxies };
  }
  return instance;
}

export function auth(): ReturnType<typeof createAuth> {
  return setup().auth;
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

/** `next` when it is a path on this site, else `fallback`: never a redirect to another site. */
export function safeNext(next: string | null, fallback: string = href("/dashboard")): string {
  return next !== null && /^\/(?![/\\])/.test(next) ? next : fallback;
}

// authHandler(), authRequest(), authError() and redirectWithCookies(): below.
```

`auth()` creates the instance inside the first request, for the same reason as `prisma()`. It also
keeps Better Auth from starting while static pages prerender, where there is no secret.

### Client addresses for the rate limiter

In production, Better Auth limits requests per client address: 3 sign-in or sign-up attempts per
10 seconds, 100 requests per 10 seconds elsewhere. It reads the address from `X-Forwarded-For`,
which a request handed to it from Lumiose does not carry by itself. The sample sets it from
`ctx.platform.clientAddress`, the address the host saw:

```ts
// src/server/client-address.server.ts
/** `X-Forwarded-For` to hand to Better Auth, or `undefined` when the host knows no address. */
export function forwardedFor(
  headers: Headers,
  clientAddress: string | undefined,
  trustedProxies: readonly string[],
): string | undefined {
  // Without trusted proxies, the client's own X-Forwarded-For is ignored: it could pick any address.
  const chain = trustedProxies.length > 0 ? headers.get("x-forwarded-for") : null;
  const hops = [chain, clientAddress].filter((hop): hop is string => hop != null && hop !== "");
  return hops.length === 0 ? undefined : hops.join(", ");
}
```

```ts
// src/server/auth.server.ts, continued
type AuthContext = Pick<RequestContext, "request" | "url" | "platform">;

function clientHeaders(ctx: AuthContext, headers: Headers): Headers {
  const { trustedProxies } = setup();
  const forwarded = forwardedFor(ctx.request.headers, ctx.platform.clientAddress, trustedProxies);
  if (forwarded === undefined) headers.delete("x-forwarded-for");
  else headers.set("x-forwarded-for", forwarded);
  return headers;
}

/** Better Auth's HTTP API for a request, with the client's address for its rate limiter. */
export function authHandler(ctx: AuthContext): Promise<Response> {
  const headers = clientHeaders(ctx, new Headers(ctx.request.headers));
  return auth().handler(new Request(ctx.request, { headers }));
}
```

Behind a proxy, the address the host sees is the proxy's, and every visitor would share one
bucket. Set `TRUSTED_PROXIES` to the proxy's address (or CIDR range, comma-separated): the
proxy's `X-Forwarded-For` chain is then kept, and Better Auth, given the same list as
`advanced.ipAddress.trustedProxies`, walks it from the right, skips the trusted hops and takes the
client. On Cloudflare, `clientAddress` is already the visitor's (`CF-Connecting-IP`).

## The handler

Better Auth's HTTP API (sessions, sign-in, sign-out and the rest) goes under `/api/auth/*`, where its
browser client calls it. A catch-all endpoint passes the request through, with the client's
address:

```ts
// src/routes/api/auth/[...all]/route.ts
import type { Endpoint } from "lumiose";
import { authHandler } from "../../../../server/auth.server.ts";

export const GET: Endpoint<"/api/auth/[...all]"> = (ctx) => authHandler(ctx);
export const POST: Endpoint<"/api/auth/[...all]"> = (ctx) => authHandler(ctx);
```

The client posts JSON, which Lumiose's cross-site check leaves to the endpoint; Better Auth checks
the `Origin` of those requests against `BETTER_AUTH_URL` (`403` otherwise).

## The session in middleware

```ts
// src/middleware.ts
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
```

Every page, endpoint and action then reads `ctx.locals.session` (`locals().session` in a component).
`getSessionCookie()` only checks that the cookie is there; `getSession()` verifies it against the
database.

## Protected pages

```stsx
// src/routes/dashboard/page.stsx
import { href, response, Title } from "lumiose";
import { requireSession } from "../../server/auth.server.ts";

export default function Dashboard() {
  const { user, session } = requireSession();
  response().setHeader("cache-control", "private, no-store");
  return (
    <main>
      <Title>Dashboard</Title>
      <p>
        Signed in as <strong>{user.name}</strong> ({user.email}).
      </p>
      <p>Your session lasts until {session.expiresAt.toISOString().slice(0, 10)}.</p>
      <form method="post" action={href("/sign-out")}>
        <button>Sign out</button>
      </form>
    </main>
  );
}
```

A visitor without a session gets a `302` to `/sign-in?next=%2Fdashboard`, and signing in brings them
back. Protected pages render per request (`mode = "server"`, the sample's default): a `static` page
cannot read the session ([LUM5001](../errors/LUM5001.md)). To guard a whole section instead, check
`ctx.locals.session` in the middleware after setting it and return a redirect for the paths that
need one ([Server](../concepts/server.md#example)).

## Forms: sign-up, sign-in and sign-out

The forms post to page actions, so they work without JavaScript, and Lumiose's cross-site check
guards them like any form action. Sign-in and sign-up go on to Better Auth's HTTP handler, as its
browser client would, so its rate limiter counts every attempt: it runs on HTTP requests only,
and calls through `auth.api.signInEmail()` would skip it, leaving passwords open to guessing.

```ts
// src/server/auth.server.ts, continued
/** Posts `body` to a Better Auth endpoint (`/sign-in/email`) through its HTTP handler. */
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

/** A 303 redirect that sets the cookies of a Better Auth response. */
export function redirectWithCookies(location: string, headers: Headers): Response {
  const response = new Response(null, { status: 303, headers: { location } });
  for (const cookie of headers.getSetCookie()) response.headers.append("set-cookie", cookie);
  return response;
}
```

```stsx
// src/routes/sign-in/page.stsx
import { actionData, fail, Title, type ActionContext, type ActionData } from "lumiose";
import { authError, authRequest, redirectWithCookies, safeNext } from "../../server/auth.server.ts";

export const action = async (ctx: ActionContext<"/sign-in">) => {
  const form = await ctx.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const response = await authRequest(ctx, "/sign-in/email", { email, password });
  // A wrong password (401) or too many attempts (429): Better Auth's message.
  if (!response.ok) return fail(response.status, { email, message: await authError(response) });
  return redirectWithCookies(safeNext(ctx.url.searchParams.get("next")), response.headers);
};

export default function SignIn() {
  return <SignInForm failed={actionData<typeof action>()} />;
}

function SignInForm(props: { failed: ActionData<typeof action> | undefined }) {
  return (
    <main>
      <Title>Sign in</Title>
      {/* No action attribute: the form posts to this URL, `?next=` included. */}
      <form method="post">
        <input type="email" name="email" value={props.failed?.email ?? ""} required />
        <input type="password" name="password" required />
        <p role="alert">{props.failed?.message}</p>
        <button>Sign in</button>
      </form>
    </main>
  );
}
```

- **Cookies.** Better Auth's response sets the session cookie; the action returns a redirect that
  carries its `Set-Cookie` lines. A plain `redirect()` would drop them, and the visitor would not be
  signed in.
- **Errors.** A wrong password (`401`), a taken email (`422`), a short password (`400`) or too many
  attempts (`429`, "Too many requests. Please try again later.") come back as a status and a
  message, which `fail()` shows on the page.
- **Sign-up** is the same with `authRequest(ctx, "/sign-up/email", { name, email, password })`,
  which signs the new user in.
- **Sign-out** needs no limit, so its action calls the server API, on `/sign-out` so that a form on
  any page can post to it:

```ts
export const action = async (ctx: ActionContext<"/sign-out">) => {
  if (ctx.locals.session === null) return redirectWithCookies(href("/"), new Headers());
  const { headers } = await auth().api.signOut({
    headers: ctx.request.headers,
    returnHeaders: true,
  });
  return redirectWithCookies(href("/"), headers); // the headers clear the cookies
};
```

## Better Auth's client in an island

A prerendered page cannot know who is signed in, and an island can find out in the browser. Better
Auth's browser client has no server imports, so islands can use it:

```ts
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient(); // calls /api/auth/* on the page's origin
```

```stsx
// src/islands/AccountMenu.stsx (shortened), used as <AccountMenu client:load /> in the layout
import { href, onMount, signal } from "lumiose";
import { authClient } from "../lib/auth-client.ts";

export function AccountMenu() {
  // `undefined` until the session has loaded: no links that may be wrong.
  const account = signal<{ name: string } | null | undefined>(undefined);

  onMount(() =>
    // Called at once with the current value; the returned unsubscribe runs on unmount.
    authClient.useSession.subscribe(({ data, isPending }) => {
      if (!isPending) account.set(data === null ? null : { name: data.user.name });
    }),
  );

  async function signOut() {
    await authClient.signOut();
    location.assign(href("/"));
  }

  return (
    <div class="account">
      {account() === null ? <a href={href("/sign-in")}>Sign in</a> : null}
      {account() ? (
        <button type="button" onClick={signOut}>
          Sign out {account()?.name}
        </button>
      ) : null}
    </div>
  );
}
```

`authClient.useSession` is a nanostores atom: `subscribe` fetches the session and calls back on every
change (after `authClient.signOut()` too), and `onMount` runs only in the browser and disposes the
subscription with the island. Server-rendered pages can pass what they already know as props
instead: `locals().session` is there during their render. With the client, the sample's island
chunk is about 11 kB (brotli); an island that only needs the session can fetch
`/api/auth/get-session` with `fetchJSON` instead.

## Production

- Set `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the public `https://` URL: Better Auth then marks its
  cookies `Secure`) and `DATABASE_URL`, plus `ORIGIN` behind a proxy ([Deploy](../deploy/README.md)).
- Apply migrations before starting the new build: `prisma migrate deploy` (the `prisma` CLI is a dev
  dependency, so run it where those are installed, such as CI or a release step).
- Behind a proxy, set `TRUSTED_PROXIES` to its address, or the rate limiter puts every visitor in
  the proxy's bucket. The limiter is off in development (`lumiose dev`).
- **Several instances.** The rate limiter keeps its counts in memory by default, per process: with
  several instances (a cluster, replicas behind a load balancer, serverless functions), each one
  counts on its own, and an attacker gets that many more attempts. Store them where every
  instance sees them, with Better Auth's `rateLimit: { storage: "database" }` (a `rateLimit` table:
  run `npx auth generate` and migrate) or `"secondary-storage"` (Redis or another store, through
  Better Auth's `secondaryStorage` option).

## Common mistakes

- **Importing `auth.server.ts` or the Prisma client into an island.** `LUM4003`. Islands use the
  browser client, or call an endpoint.
- **Calling `betterAuth()` at module scope with `env()` values.** In dev, `.env` values reach
  `env()` only inside a request, and a static page's prerender would start Better Auth without a
  secret. Create it on first use, as `auth()` does.
- **Signing in with `auth.api.signInEmail()` in the action.** It works, but Better Auth's rate
  limiter never sees the attempt. Post to its handler, as `authRequest()` does.
- **Redirecting with `redirect()` after sign-in.** The session cookie is in Better Auth's response
  headers; return a `Response` that sets them.
- **Reading the session in a `static` page.** `locals()` throws `LUM5001` while prerendering; render
  the page per request, or read the session in an island.
- **`prisma generate` failing on a fresh checkout** with "File './.lumiose/tsconfig.generated.json'
  not found". Run `lumiose typegen` first.

See also: [Server](../concepts/server.md), [Data and actions](../concepts/data-and-actions.md),
[Islands](../concepts/islands.md), [Security](../concepts/security.md).
