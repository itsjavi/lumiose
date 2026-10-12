# `lumiose`: app layer

> Signatures of the app-layer exports of `lumiose`: data fetching, form actions, routing helpers, control flow, request APIs, cookies, env and the request-context types.

`lumiose` exposes the same names in the browser and on the server. Server-only APIs exist in the
browser build as stubs that throw `LUM4003` with a hint; browser-only APIs reject on the server.
Concepts: [Data and actions](../concepts/data-and-actions.md), [Server](../concepts/server.md),
[Routing](../concepts/routing.md).

## Data

### fetchJSON

```ts
function fetchJSON<T = unknown>(input: string | URL, init?: RequestInit): Promise<T>;
```

Fetches and parses JSON (`Accept: application/json` unless `init` sets it); an empty body is
`undefined`. Non-2xx responses throw a `FetchError`. During SSR, same-origin URLs are served
in-process through the request handler, with the page request's cookies and headers. Returns plain
data, so awaited results stay serializable in islands.

Awaited in an async component, a GET is **cached by its absolute URL** (see [query](#query) for the
cache's behaviour): components awaiting the same URL share one request. The first caller's `init`
(headers, credentials) makes the request. Inside an async component the signal defaults to
`getAbortSignal()`: a superseded run stops waiting, and the request is cancelled once no component
waits for it. Elsewhere (event handlers, middleware, endpoints, actions) and for other methods it is
a plain request.

`fetchJSON(url, { cache: "no-store" })` opts a component-level GET out of the cache: a plain
request, not deduped with other components, not kept, and not sent with the page payload (inside an
island, its value is still recorded for hydration like any other await). Other `cache` values keep
the default behaviour; `init` always reaches `fetch` as given.

### query

```ts
function query<T, const TKey extends readonly unknown[]>(
  key: TKey,
  fn: (context: QueryFunctionContext<TKey>) => T | PromiseLike<T>,
): Promise<T>;

interface QueryFunctionContext<TKey extends readonly unknown[] = readonly unknown[]> {
  signal: AbortSignal; // the shared request's signal
  queryKey: TKey; // `key`
}
```

Awaited in an async component, caches what `fn` resolves to under `key`, an array of
JSON-serializable values hashed stably (object key order does not matter), as TanStack Query's
`queryKey`. Use it for data that does not come from `fetchJSON`: a database call in a server
component, a third-party SDK. `fn` receives `{ signal, queryKey }`, TanStack Query's
`QueryFunctionContext`: `fn` runs outside the component, so `signal` is the shared request's
(the same one `getAbortSignal()` returns inside `fn`), aborted once no component waits for it.
Pass it on to `fetch` or an SDK: `query(["user", id], ({ signal }) => sdk.getUser(id, { signal }))`.
Outside an async component it calls `fn` without caching, with the current owner's signal (one that
never aborts when there is no owner).

The cache behind `fetchJSON` and `query`:

- **Scope:** one per request on the server; one per page in the browser, shared by every island and
  the SPA tree and kept across client navigations.
- **Deduplication:** components awaiting the same entry share one request.
- **Stale-while-revalidate:** in the browser, an entry with data returns it at once (a new
  component shows it without a `<Suspense>` fallback) and refetches in the background; when the
  data changed, the components that awaited it re-run. Defaults follow TanStack Query: `staleTime`
  0, `gcTime` 5 minutes after the last component that awaited it is gone.
- **Invalidation:** [`invalidate(target)`](#invalidate) re-runs only the components that awaited the
  matching entries; their re-runs wait for the refetch, keeping their UI meanwhile.
- **Islands:** entries awaited inside an island (or an SPA page) during SSR are sent once with the
  page, so the browser cache starts with them and islands hydrate without fetching. Their values
  must be plain data (`LUM4007`); entries only server components awaited are never sent.
- **Errors** are never cached: the next await fetches again. A failed background refetch keeps the
  old data.
- Cached data is shared, not copied: treat it as read-only.

### FetchError, isFetchError

```ts
interface FetchError extends HttpError {
  readonly status: number; // 0 for network failures
  readonly url: string;
  /** Parsed JSON body for JSON responses, else text; undefined when empty. */
  readonly data: unknown;
}
function isFetchError(value: unknown): value is FetchError;
```

Thrown by `fetchJSON()` and by `submit()` for unexpected errors. An `HttpError`, so if a server
component lets it escape, the page renders the `error` (or `not-found`) page with the same status.

## Form actions

### submit

```ts
function submit(target: SubmitTarget, options?: SubmitOptions): Promise<ActionResult>;
// Typed by the action it posts to: submit<typeof actions.save>(event)
function submit<A extends ActionsExport>(
  target: SubmitTarget,
  options?: SubmitOptions,
): Promise<ActionResult<ActionSuccessData<A>, ActionFailureData<A>>>;

type SubmitTarget =
  | HTMLFormElement
  | Event // a submit event: onSubmit={submit}
  | FormData
  | URLSearchParams
  | Record<string, string | Blob | readonly (string | Blob)[]>;

interface SubmitOptions {
  /** A URL, or "?/name" for a named action. Default: the submitter's formaction, else the
   *  form's action, else the current URL. */
  action?: string;
  /** Default POST. A form must say method="post". */
  method?: string;
  signal?: AbortSignal;
  /** After a success: true (default) refreshes the whole page with invalidate() on client-routed
   *  (SPA) pages, false keeps the page, and a list of targets (URLs, query() keys) refetches only
   *  those, on SPA and MPA pages. MPA pages never refresh as a whole on their own. */
  invalidate?: boolean | readonly (string | readonly unknown[])[];
}

type ActionResult<Data = unknown, Failure = unknown> =
  | { type: "success"; status: number; data: Data }
  | { type: "failure"; status: number; data: Failure }
  | { type: "redirect"; status: number; location: string };
```

Posts without a page load. `success` and `failure` set `actionData()`; `redirect` navigates.
On client-routed (SPA) pages, after a `success`, `submit()` runs [`invalidate()`](#invalidate) and
resolves once the page's data is fresh (decision-20); `{ invalidate: false }` skips it, and
`{ invalidate: ["/api/books/1", ["stats"]] }` refetches only those targets instead, on SPA and MPA
pages alike. On MPA pages it never reloads: the island updates itself from the result, refetches
targets, or calls `invalidate()` explicitly.
Failures, redirects and errors do not invalidate. Rejects only for unexpected errors (the action throws, an error response, a network
failure) with a `FetchError`, and with a `TypeError` for a redirect to a URL that is not `http(s)`
(a `javascript:` location never runs). Browser only: rejects on the server.

### isSubmitting

```ts
function isSubmitting(name?: string): boolean;
```

Whether a `submit()` is in flight; with a name, one to that named action (`?/name`). Reactive.
`false` on the server.

### actionData

```ts
function actionData(): unknown;
// Typed by the page's actions: actionData<typeof actions>() or actionData<typeof action>()
function actionData<A extends ActionsExport>(): ActionData<A> | undefined;
type ActionData<A extends ActionsExport> =
  | ActionSuccessData<A> // what the actions return (not fail() or a Response); void → undefined
  | ActionFailureData<A>; // the data they pass to fail()
// typeof action, typeof actions or typeof actions.name
type ActionsExport =
  | ((ctx: never) => unknown)
  | { readonly [name: string]: (ctx: never) => unknown };
```

The data of the last action result: what the action returned, or its `fail()` data. The type
argument is the actions export itself, never a data type: the result types are inferred from it.
`ActionData<typeof actions>` names the same type, for the props of a component that receives it
(`failed: ActionData<typeof action> | undefined`). Success and failure data are told apart by
their shape, as with React Router's `useActionData` and SvelteKit's `form`. Reactive in
the browser; after a no-JS form post it starts with the data the page was rendered with. On the
server: the current request's action result while the page re-renders after a post.

### fail, ActionFailure

```ts
function fail(status: number): ActionFailure<undefined>;
function fail<Data>(status: number, data: Data): ActionFailure<Data>;
```

A failed action result, usually for validation errors: `return fail(400, { errors })`. Without
JavaScript the page re-renders with `status`; `submit()` resolves with `{ type: "failure" }`.

### invalidate

```ts
function invalidate(...targets: (string | readonly unknown[])[]): Promise<void>;
```

With targets, refetches only the matching [cache](#query) entries and re-runs the async components
that awaited them, on SPA and MPA pages alike; their UI stays until the new data arrives. A string
is a URL (resolved against the page) and matches the `fetchJSON()` entry of that exact URL; an
array matches the `query()` entries whose key starts with it, as TanStack Query's
`invalidateQueries`: `invalidate(["books"])` matches `["books"]`, `["books", 1]` and
`["books", { page: 2 }]`. In development, a string that does not look like a URL (`/…`, `./…`,
`../…`, `http(s):…`) logs a warning: `invalidate("stats")` was probably meant as
`invalidate(["stats"])`.

Without targets, refreshes the whole page after a mutation: re-runs the page's async components in
SPA routes, refetching every cache entry (their UI stays until the new data arrives), and reloads
the page otherwise (that promise never settles, as the page is going away). A successful `submit()`
calls it for you on SPA pages only; on MPA pages call it yourself when the page needs fresh server
HTML.

Resolves once nothing is in flight anymore (`isBusy()` is false). Browser only: rejects on the
server.

## Routing

### href

```ts
function href<P extends Routes>(pattern: P, ...args: HrefArgs<P>): string;
```

Builds a path from a route pattern, encoding each param; `params` is required when the pattern has
params. A `[...rest]` param keeps its `/` separators; an optional `[[param]]` or `[[...rest]]`
whose value is missing or empty leaves its segment out (`href("/docs/[[...path]]")` is `/docs`).
Throws on a missing or empty `[param]` or `[...rest]`.

The path is below Vite's `base` and follows `lumiose({ trailingSlash })`, on the server and in the
browser alike (`lumiose dev`, `lumiose build` and prerendering):

| `base`  | `trailingSlash` | `href("/")` | `href("/blog/[slug]", { slug: "a" })` | `href("/feed.xml")` |
| ------- | --------------- | ----------- | ------------------------------------- | ------------------- |
| `/`     | `"ignore"`      | `/`         | `/blog/a`                             | `/feed.xml`         |
| `/sub/` | `"never"`       | `/sub/`     | `/sub/blog/a`                         | `/sub/feed.xml`     |
| `/sub/` | `"always"`      | `/sub/`     | `/sub/blog/a/`                        | `/sub/feed.xml`     |

With `"always"`, a pattern whose last segment has a dot (an endpoint such as `/feed.xml`) gets no
trailing slash. A relative `base` (`./`) counts as `/`. Outside Vite (plain Node) the path is
root-relative.

### Route types

```ts
interface RouteMap {}                  // augmented by .lumiose/types/routes.d.ts (typegen)
interface LayoutMap {}                 // the same, for layouts (by the URL scope of their folder)
type Routes = /* every route pattern, or string before typegen */;
type RouteParams<P extends Routes>;    // { slug: string } for "/blog/[slug]"
interface PageProps<P extends /* a page pattern */> { params: RouteParams<P> }
interface LayoutProps<P extends /* a layout pattern */> {
  params: /* the params of the layout's scope */;
  children: JSX.Element;
}
```

## Control flow

```ts
function redirect(location: string | URL, status?: 301 | 302 | 303 | 307 | 308): never;
function notFound(message?: string): never;
function error(status: number, message?: string): never; // 400-599
function isRedirect(value: unknown): value is Redirect;
function isHttpError(value: unknown): value is HttpError;
```

They throw; the framework renders a redirect, the nearest `not-found` page (404) or the nearest
`error` page.
Without a status, `redirect()` uses 302 for GET/HEAD and 303 otherwise. `HttpError` is an `Error`
with a `status`.

## Request APIs (server)

```ts
function request(): Request;
function url(): URL;
function params<P extends Routes = never>(): RouteParams<P>; // Record<string, string> without P
function route(): Routes | undefined; // the matched pattern, "/blog/[slug]"; undefined if none
function locals(): Locals;
function cookies(): Cookies;
function response(): ResponseContext;
function env(name: string): string | undefined;
function publicEnv(source?: ServerEnv): Record<string, string>;
function cspNonce(): string | undefined; // lumiose({ csp: "strict" }): the response's nonce
```

`cspNonce()` is `undefined` without strict CSP, outside a request and while prerendering (the
page's hash policy covers its inline elements); in the browser it reads
`<meta property="csp-nonce">`. See [Security](../concepts/security.md).

Available anywhere during a server render (also after `await`), scoped to the current request. In
the browser they throw `LUM4003`. `url()`, `params()` and `route()` also exist in
[`lumiose/router`](router.md): those are reactive, follow client navigations and also work during
server rendering, so use them in code that runs in the browser (SPA routes, islands). `env()` reads the adapter's env, else `process.env`;
`publicEnv()` returns the `PUBLIC_*` subset.

```ts
interface ResponseContext {
  readonly status: number;
  setStatus(status: number): void;
  getHeader(name: string): string | null;
  setHeader(name: string, value: string): void;
}
```

Writable until the shell is sent; later writes throw `LUM5004`.

## Cookies

```ts
interface Cookies {
  get(name: string): string | undefined;
  getAll(): Array<{ name: string; value: string }>;
  set(name: string, value: string, options?: CookieOptions): void;
  delete(name: string, options?: CookieDeleteOptions): void;
}
interface CookieOptions {
  path?: string; // default "/"
  domain?: string;
  maxAge?: number; // seconds
  expires?: Date;
  httpOnly?: boolean; // default true
  secure?: boolean; // default: true in production and on https
  sameSite?: "lax" | "strict" | "none"; // default "lax"; "none" forces secure
  partitioned?: boolean; // CHIPS; forces secure
}
type CookieDeleteOptions = Pick<CookieOptions, "path" | "domain" | "secure" | "sameSite">;

function signedCookie(name: string, options?: SignedCookieOptions): SignedCookie;
interface SignedCookieOptions extends CookieOptions {
  /** HMAC secret; an array rotates keys (the first signs). Default: env LUMIOSE_SECRET. */
  secret?: string | readonly string[];
  /** Accept secrets under 32 bytes (else they throw in production, warn in dev). */
  allowWeakSecret?: boolean;
}
interface SignedCookie {
  readonly name: string;
  get(cookies: Cookies): Promise<string | undefined>; // undefined when the signature is invalid
  set(cookies: Cookies, value: string, options?: CookieOptions): Promise<void>;
  delete(cookies: Cookies, options?: CookieDeleteOptions): void;
}
```

## Context types

```ts
// P is a route pattern ("/books/[isbn]"); without one, params is Record<string, string>.
interface RequestContext<P extends Routes = never> {
  request: Request;
  url: URL;
  params: RouteParams<P>;
  locals: Locals;
  cookies: Cookies;
  env: ServerEnv; // Readonly<Record<string, string | undefined>>
  platform: Platform; // what the host adds: bindings, waitUntil, client address
}
interface Platform {
  readonly env: PlatformEnv; // the platform's bindings; {} where there are none
  waitUntil(promise: Promise<unknown>): void; // fallback: runs it, reports a rejection
  readonly clientAddress: string | undefined;
}
interface ActionContext<P extends /* a page pattern */ = never> extends RequestContext<P> {
  formData(): Promise<FormData>; // parsed once; 400 if the body is not a form
}
type Middleware = (
  ctx: RequestContext,
  next: () => Promise<Response>,
) => Response | Promise<Response>;
type Endpoint<P extends /* an endpoint pattern */ = never> = (
  ctx: RequestContext<P>,
) => Response | Promise<Response>;
// Annotating with Action hides the result from actionData<typeof action>(): type the parameter
// with ActionContext<P> instead, or use `satisfies Action<P>`.
type Action<P extends /* a page pattern */ = never, Result = unknown> = (
  ctx: ActionContext<P>,
) => Result | Promise<Result>;
type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
interface ErrorPageProps {
  status: number;
  error: Error & { status?: number };
}
interface DocumentProps {
  head: JSX.Element;
  body: JSX.Element;
}
interface Locals {} // augment: declare module "lumiose" { interface Locals { … } }
interface PlatformEnv {} // augment: declare module "lumiose" { interface PlatformEnv { … } }
```

## Example

```ts check file=routes/api/session/route.ts
// src/routes/api/session/route.ts
import { isHttpError, type Endpoint } from "lumiose";

// Per request: it reads cookies and accepts POST, so it cannot be prerendered (LUM5005).
export const mode = "server";

export const GET: Endpoint<"/api/session"> = ({ cookies }) =>
  Response.json({ theme: cookies.get("theme") ?? "light" });

export const POST: Endpoint<"/api/session"> = async ({ request, cookies }) => {
  try {
    const { theme } = (await request.json()) as { theme: string };
    cookies.set("theme", theme, { maxAge: 60 * 60 * 24 * 365 });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (isHttpError(error)) throw error;
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
};
```
