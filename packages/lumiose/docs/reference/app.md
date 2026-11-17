# `lumiose`: app layer

> Signatures of the app-layer exports: data fetching, form actions, routing helpers, request APIs, cookies and env.

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
`false` on the server. Submissions of `submission()` handles count too.

### submission

```ts
function submission(): Submission;
// Typed by the action it posts to: submission<typeof actions.toggle>()
function submission<A extends ActionsExport>(): Submission<
  ActionSuccessData<A>,
  ActionFailureData<A>
>;

interface Submission<Data = unknown, Failure = unknown> {
  /** submit() for this handle: aborts its submission in flight, returns submit()'s promise. */
  submit(target: SubmitTarget, options?: SubmitOptions): Promise<ActionResult<Data, Failure>>;
  isSubmitting(): boolean; // this handle's submission is in flight
  result():
    | { type: "success"; status: number; data: Data }
    | { type: "failure"; status: number; data: Failure }
    | undefined; // the last settled result
  error(): FetchError | undefined; // the last unexpected error
  abort(): void; // cancels the submission in flight; the handle is idle at once
  reset(): void; // clears result() and error()
}
```

The submissions of one component instance (decision-51, after Solid Router's `useSubmission` and
React Router's `useFetcher`). Call it during component setup: disposing the component aborts its
submission in flight. Its results never set `actionData()`, and [`isSubmitting(name)`](#issubmitting)
still counts them; invalidation and redirects behave as with `submit()`. The promise `submit()`
returns rejects for errors (also in `error()`) and aborts (`AbortError`, not an error of the
handle), but an unawaited one (`onSubmit={handle.submit}`) reports no unhandled rejection. On the
server the handle is idle and its `submit()` rejects.

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

With `lumiose({ i18n })`, the path is in the current locale: the request's on the server, the
page's URL in the browser (`/es/...` on a Spanish page). The `locale` key switches it and is no
route param: `href("/blog/[slug]", { slug, locale: "es" })` is `/es/blog/hello`, `{ locale: "en" }`
(the default locale) `/blog/hello`. An unknown locale throws. `href()` does not check that the
page declares the locale: `alternates()` lists the URLs that exist. See
[Internationalization](../concepts/i18n.md).

### Route types

```ts
interface RouteMap {}                  // augmented by .lumiose/types/routes.d.ts (typegen)
interface LayoutMap {}                 // the same, for layouts (by the URL scope of their folder)
interface LocaleMap {}                 // the same, for the locales of lumiose({ i18n })
type Locale = /* "en" | "es" | …, or string before typegen */;
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
function locale(): Locale; // lumiose({ i18n }): the request's locale; string | undefined without it
function alternates(): { locale: Locale; href: string }[]; // the page in each declared locale
function alternates<P extends Routes>(
  pattern: P,
  params?: RouteParams<P>,
): { locale: Locale; href: string }[];
```

`locale()` is the locale of the request's URL prefix (`/es/about` → `"es"`), else the default
locale, also while prerendering (each locale renders separately); without `lumiose({ i18n })` it
is `undefined`, typed `string | undefined` (so is `ctx.locale`). `alternates()` lists the current
route's URL in every locale it declares, with `base` and the trailing-slash policy, for language
switchers; `[]` without `lumiose({ i18n })` or when no route matched. With a route pattern (and
params, required when the route has some, as for `href()`), it lists that route's URLs from its
`locales` list, a layout's or the default locale, to link a page translated into fewer locales:
`alternates("/about")`. It throws for an unknown pattern and for a route whose locales come from a
`locales({ params })` function. See [Internationalization](../concepts/i18n.md).

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
  setStreaming(streaming: boolean): void; // false: one fully resolved document
}
```

Writable until the shell is sent; later writes throw `LUM5004`. `setStreaming(false)` makes the
response wait for every `<Suspense>` boundary and send one complete document, without fallbacks
or swap scripts, as prerendering renders; call it in middleware, or in a page before its first
`<Suspense>`. It is meant for crawlers: see
[the middleware recipe](../concepts/server.md#crawlers-get-one-resolved-document). The response
still waits at most `lumiose({ streamTimeout })` ([`LUM5009`](../errors/LUM5009.md)).

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
  // The matched pattern (route()); undefined only in src/middleware.ts for a URL no route matches.
  route: Routes | undefined;
  locals: Locals;
  cookies: Cookies;
  env: ServerEnv; // Readonly<Record<string, string | undefined>>
  platform: Platform; // what the host adds: bindings, waitUntil, client address
  locale: Locale; // lumiose({ i18n }): the request's locale; undefined without it
}
interface Platform {
  readonly env: PlatformEnv; // the platform's bindings; {} where there are none
  waitUntil(promise: Promise<unknown>): void; // fallback: runs it, reports a rejection
  readonly clientAddress: string | undefined;
}
interface ActionContext<P extends /* a page pattern */ = never> extends RequestContext<P> {
  formData(): Promise<FormData>; // parsed once; 400 if the body is not a form
}
// src/middleware.ts, or a folder's middleware.ts with the folder's URL scope as P ("/admin"):
// then ctx.params holds the folder's params and ctx.route the patterns below it (decision-48).
type Middleware<P extends /* a layout or middleware folder's pattern */ = never> = (
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

### Instrumentation types

The exports of `src/instrumentation.server.ts` ([Server](../concepts/server.md#instrumentation)):
`register(): unknown`, `onRequestError(error: unknown, info: RequestErrorInfo): unknown` and
`instrumentations: ServerInstrumentation[]`.

```ts
interface RequestErrorInfo {
  request: Request;
  route: Routes | undefined; // the matched pattern; undefined when no route matched
  params: Record<string, string>;
  phase: "middleware" | "action" | "endpoint" | "render" | "stream" | "waitUntil";
  digest: string | undefined; // what an <ErrorBoundary> fallback shows outside dev
}
// Each wrapper: (call, info) => unknown. call() runs the phase (once) and never throws.
type Result = { status: "success" } | { status: "error"; error: unknown };
type Info = { request: Request; route: Routes | undefined; params: Record<string, string> };
interface ServerInstrumentation {
  request?(call: () => Promise<Result & { response?: { status: number } }>, info: Info): unknown;
  middleware?(call: () => Promise<Result>, info: Info & { file: string }): unknown;
  action?(call: () => Promise<Result>, info: Info & { name: string }): unknown; // "default" for `action`
  endpoint?(call: () => Promise<Result>, info: Info & { method: HttpMethod }): unknown;
  render?(call: () => Promise<Result>, info: Info): unknown; // until the shell is ready
  stream?(call: () => Promise<Result>, info: Info): unknown; // each streamed boundary
}
```

The exports of `src/instrumentation.client.ts` ([Islands](../concepts/islands.md#concept)):
`onError(error: unknown, info: ClientErrorInfo): unknown` and
`instrumentations: ClientInstrumentation[]`.

```ts
interface ClientErrorInfo {
  phase: "hydrate" | "render" | "effect" | "navigate" | "submit";
  route: Routes | undefined; // the SPA route; undefined on MPA pages
  island: string | undefined; // the island's module#export, for errors in an island
}
type ClientInfo = { route: Routes | undefined };
interface ClientInstrumentation {
  navigate?(
    call: () => Promise<Result>,
    info: ClientInfo & {
      type: "link" | "navigate" | "popstate";
      from: NavigationTarget | null; // lumiose/router
      to: NavigationTarget | null;
    },
  ): unknown; // until the page is on screen
  submit?(call: () => Promise<Result>, info: ClientInfo & { action: string; url: string }): unknown;
  fetch?(
    call: () => Promise<Result>,
    info: ClientInfo & ({ url: string } | { key: readonly unknown[] }),
  ): unknown; // each fetchJSON() request or query() function; cache hits are not requests
  hydrate?(call: () => Promise<Result>, info: ClientInfo & { island: string }): unknown;
}
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

## File routes

```
src/
  routes/
    layout.stsx                     root layout; a nested layout.stsx per folder
    page.stsx                       /
    about/page.stsx                 /about
    blog/page.stsx                  /blog
    blog/[slug]/page.stsx           /blog/:slug
    blog/[slug]/Comments.stsx       colocated module, not a route
    blog/_lib/posts.ts              private folder: nothing below it routes
    docs/[[...path]]/page.stsx      /docs and /docs/*  (optional rest)
    files/[...path]/page.stsx       /files/*  (rest: one or more segments)
    [[lang]]/contact/page.stsx      /contact and /:lang/contact  (optional param)
    (marketing)/pricing/page.stsx   /pricing  (a group folder adds no URL segment)
    api/posts/route.ts              endpoint: export GET / POST / … = (ctx) => Response
    admin/middleware.ts             runs for the pages, actions and endpoints below /admin
    sitemap.xml/route.ts            endpoint at /sitemap.xml
    not-found.stsx  error.stsx      error pages, nearest one wins
  document.stsx                     optional: owns <html>, <head> and <body>
  middleware.ts                     optional: export default (ctx, next) => Promise<Response>
```

- **A folder is a URL segment; special files give it behavior:** `page.stsx` or `page.tsx` (the
  page), `route.ts` (an endpoint), `middleware.ts` (folder middleware), and `layout`, `not-found`
  and `error` (`.stsx` or `.tsx`).
  There is no `index` and no flat page file: `about/page.stsx` is the page at `/about`, and
  `about.stsx` is not a route. A folder has a page or a `route.ts`, not both (`LUM5003`).
- **Colocation:** any other file in `src/routes` (components, helpers, styles, tests) is ignored
  by the router, so it can live next to the route that uses it. A folder whose name starts with
  `_` is private: nothing below it routes, not even a `page.stsx`.
- **Segments:** `[param]` matches one segment, `[[param]]` zero or one, `[...rest]` one or more
  and `[[...rest]]` zero or more (joined with `/`); `(group)` folders add no segment. A rest
  segment is the last one of the URL. An optional param that matched nothing is absent:
  `params.lang` is `undefined` at `/contact`.
- **Matching priority:** segment by segment, static beats `[param]`, which beats `[...rest]`. A
  route with optional segments competes with each URL shape it serves: `/[[lang]]/contact` serves
  `/contact` as a static route. Two files that serve the same URL are `LUM5003`, including a
  `[[...rest]]` folder next to a page for the URL without it.
- **Next.js files Lumiose does not have** are `LUM5002`, so they never silently do nothing:
  `loading`, `template`, `default` and `global-error` files, `@slot` folders (parallel routes)
  and `(.)` folders (intercepting routes).
- **Layouts** wrap every page below their folder and receive `{ params, children }`. `children`
  is the page (the outlet).
- **Folder middleware:** a `middleware.ts` runs for every page, form action and endpoint below its
  folder (group folders included), after `src/middleware.ts` and outermost folder first. It is the
  place for a section's auth, since a layout does not see the folder's actions and endpoints. See
  [Server](../concepts/server.md#concept); `src/routes/middleware.ts` is `LUM5002` (use `src/middleware.ts`).
- **Pages** export a `default` component (it may be `async`), which receives `{ params }`. Other
  page exports: `mode`, `ssr`, `prerender`, `staticPaths`, `action`/`actions`, `headers` and
  `limits` (see
  [Rendering modes](../concepts/rendering-modes.md), [Data and actions](../concepts/data-and-actions.md) and
  [Security](../concepts/security.md)). Endpoints may export `limits` too.
- **Error pages:** `not-found` renders unmatched URLs and `notFound()`; `error` renders thrown
  errors and `error(status)`. Both receive `{ status, error }`. Outside dev, unexpected errors are
  masked as 500. An error page renders inside the layouts of its folder, like a page there: the
  root `not-found` gets the root `layout` (header, navigation), so it only renders its own
  content. If a layout itself fails, the error page renders without layouts. To give errors a
  different frame, move the regular pages into a group with their own layout
  (`(app)/layout.stsx`) and keep the error page outside it.

**Locales.** With `lumiose({ i18n })`, the router also serves each page under the prefixes of the
locales it declares (`/es/about` from `about/page.stsx`), and `href()`, `<html lang>` and the
`hreflang` links follow. See [Internationalization](../concepts/i18n.md).

> **Status:** file routes, the manifest, matching, typegen, `href()`, the request handler, MPA
> prefetch and View Transitions, and the SPA router (`lumiose/router`) are available, served by
> `lumiose dev`, `lumiose build` and `lumiose preview`.

## Typed routes

**Typed routes.** `lumiose typegen` (run by `lumiose check` and the dev server) writes
`.lumiose/types/routes.d.ts`, which augments `RouteMap` (pages and endpoints) and `LayoutMap`
(the folders with a layout or a middleware file). Every route-bound type then takes the route pattern as a string literal, checked
against that table: an unknown or stale pattern is a type error, and editors complete it.

- `href("/blog/[slug]", { slug })` builds a URL and type-checks the pattern and params; the URL
  includes Vite's `base` and follows `trailingSlash` ([reference](#href));
- `PageProps<"/blog/[slug]">` types a page's props, `LayoutProps<"/blog">` a layout's
  (`{ params, children }`, with the params of the layout's URL scope; route groups such as `(app)`
  add nothing to it), and `params<"/blog/[slug]">()` the params anywhere on the server;
- `RequestContext<P>`, `ActionContext<P>` and `Endpoint<P>` type `ctx.params` of middleware
  helpers, actions and endpoints (see [Data and actions](../concepts/data-and-actions.md)), and
  `Middleware<"/admin">` types a folder's middleware: `ctx.params` with the folder's params and
  `ctx.route` with the patterns below it;
- optional params are optional properties (`RouteParams<"/[[lang]]/contact">` is
  `{ lang?: string }`), and `href()` leaves out an optional segment whose param is missing or
  empty: `href("/docs/[[...path]]")` is `/docs`.

## MPA navigation: prefetch and View Transitions

**Navigation.** Routes are MPA by default: links load the next document. Two `lumiose()` options in
`vite.config.ts` make these navigations smooth ([reference](vite.md#lumiose)); both are
progressive, so browsers without support navigate normally:

- **Prefetch** (`prefetch`, default `"hover"`). Pages get `<script type="speculationrules">` that
  prefetches same-origin links: when the pointer rests on a link (`"hover"`), early, as the browser
  sees fit (`"viewport"`), or never (`"none"`). Links to endpoints are never prefetched, since a GET
  endpoint may act (`/logout`). `spa` pages get no rules: there `<Link prefetch>` decides per link.
- **Per link**, `<Link prefetch>` from `lumiose/router` overrides the default on MPA pages too. There
  it renders a plain `<a>` (no JavaScript, no router) with a `data-l-prefetch` marker, and the
  rules prefetch it at its own level: `"none"` opts the link out, `"viewport"` prefetches it early,
  `"hover"` on hover. `<Link>` without `prefetch`, like a plain `<a>`, follows the default. The
  server `<Link>` tells the page it rendered a marker as it renders; a hand-written
  `data-l-prefetch` attribute on a plain `<a>` does not change the page's rules.
- **View Transitions** (`viewTransitions: true`, off by default). Every page opts into
  cross-document View Transitions (`@view-transition { navigation: auto }`), except for readers who
  prefer reduced motion: the old page cross-fades into the new one. An element morphs into its
  counterpart on the next page when both have the same CSS `view-transition-name`, unique on each
  page: in a style block (`.site-header { view-transition-name: site-header; }`) or per item with
  ``style={{ "view-transition-name": `cover-${post.slug}` }}``. Style the animation with the
  `::view-transition-*` pseudo-elements in a global style block.

```ts
// vite.config.ts
export default defineConfig({ plugins: [lumiose({ viewTransitions: true })] });
```

```tsx
import { Link } from "lumiose/router";

// In any page or component: the next page prefetches early, the archive never.
<Link href="/page/2" prefetch="viewport">Older →</Link>
<Link href="/archive" prefetch="none">Archive</Link>
```

## Common routing mistakes

- **A flat or `index` page file.** `src/routes/about.stsx` and `src/routes/blog/index.stsx` are
  colocated modules, not routes: name them `about/page.stsx` and `blog/page.stsx`. `lumiose routes`
  lists what the router sees.
- **A `[...rest]` folder for its parent's URL.** `docs/[...path]/page.stsx` does not match
  `/docs`: use `docs/[[...path]]/page.stsx`, or add `docs/page.stsx`.
- **Two files for one URL.** `cart/page.stsx` and `(shop)/cart/page.stsx` both match `/cart`, and
  so do `feed/page.stsx` and `feed/route.ts` (`LUM5003`).
- **Hard-coded URLs.** `"/blog/" + slug` breaks silently when a route moves; `href("/blog/[slug]",
  { slug })` fails type-checking instead.
- **Reading params from `window.location` in a server component.** Use `props.params` or
  `params()`.
- **Matching `url().pathname` to know which route is showing.** `route() === "/songs/[id]"`
  compares the matched pattern, type-checked against the app's routes.
- **Route loaders.** There are none: load data in the async page component itself (decision-18).
- **A custom dialog for `"leave"`.** For closing the tab, a reload, a typed URL or a `POST` form
  (`navigation.type === "leave"`), `cancel()` makes the browser show its own prompt; a `confirm()`
  or a modal cannot run there. Ask with your own UI for the rest: links (on MPA pages too) and
  `navigate()` stay on the page when cancelled.
- **`mode` that is not a string literal.** `export const mode = getMode()` cannot be read at build
  time (`LUM5002`).

## Request context and middleware

**Request context.** Middleware, endpoints and actions receive
`ctx = { request, url, params, route, locals, cookies, env, platform }`, where `route` is the
matched pattern (`"/users/[id]"`; `undefined` in `src/middleware.ts` for a URL no route matches).
During a server render, the same values are
available through functions scoped to the current request (they work after `await` too):
`request()`, `url()`, `params()`, `route()` (the matched pattern), `locals()`, `cookies()`,
`response()` and `env(name)`.

**Platform.** `ctx.platform` is what the host adds to a request: `env` (the platform's bindings,
such as Cloudflare's KV or D1; `{}` elsewhere), `waitUntil(promise)` (work that continues after the
response) and `clientAddress` (the client's IP as the host sees it). Each has a fallback, so the
same code runs on every host ([server build](server-entry.md#platform)). Type the
bindings by augmenting `PlatformEnv`. A server component that needs them gets them from middleware,
through `locals`.

**Middleware.** `src/middleware.ts` default-exports `(ctx, next) => Promise<Response>` (or an array,
run in order) and runs for every request. Use it for sessions, auth and headers. Put request data on
`ctx.locals`, and type it by augmenting `Locals`:

```ts
declare module "lumiose" {
  interface Locals {
    user: { id: string; name: string } | null;
  }
}
```

**Folder middleware.** A `middleware.ts` (or `.js`) in a route folder has the same default export and
runs for every page, form action and `route.ts` endpoint in that folder and below it. That makes it
the place for a section's auth: a layout guard (`locals()` plus `redirect()`) covers the folder's
pages, but not their actions or endpoints. Group folders count: `(account)/middleware.ts` covers
every route in the group without a URL segment.

- **Order.** The trailing-slash redirect and the cross-site check answer first. Then
  `src/middleware.ts`, and inside its `next()` the route's locale checks (`/es/admin` runs the
  `/admin` middleware), the folder middleware from the outermost folder to the innermost, and the
  route. Responses unwind in reverse. URLs that match no route run `src/middleware.ts` only.
- **Errors.** What folder middleware throws (`redirect()`, `error()`, any error) renders the
  route's error page outside the chain, as for `src/middleware.ts`.
- **Types.** `Middleware<"/admin">` takes the folder's URL scope (the pattern `LayoutProps` takes):
  `ctx.params` holds the folder's params and `ctx.route` the patterns below it.
- **SPA routes.** Client navigations between `spa` pages do not reach the server. The middleware
  runs for the document request and for the actions and endpoints below the folder, which is what
  protects an SPA's data.
- **Prerendered routes.** Like `src/middleware.ts`, folder middleware runs whenever the app handles
  a route: per request for server routes, for every route in `lumiose dev`, and at build time for
  prerendered pages, whose files production serves without the app. It cannot guard those, so
  `lumiose check` and the build warn ([`LUM5008`](../errors/LUM5008.md)).
- `src/routes/middleware.ts` is an error ([`LUM5002`](../errors/LUM5002.md)): the app's middleware
  is `src/middleware.ts`. `lumiose routes` prints each route's middleware chain.

## Responses, cookies and env

**Control flow.** `redirect(to, status?)`, `notFound()` and `error(status, message?)` throw; the
framework turns them into a redirect or the nearest `not-found`/`error` page. Without a status,
`redirect()` uses 302 for GET/HEAD and 303 for other methods.

**Cookies.** `cookies.get/getAll/set/delete`. Defaults: `path=/`, `httpOnly`, `sameSite=lax`, and
`secure` on HTTPS and in production. `signedCookie(name)` signs values with HMAC-SHA256 (secret:
`LUMIOSE_SECRET`, or rotate with an array of secrets); signing protects integrity, not
confidentiality. Secrets must be at least 32 bytes: a shorter one throws in production and warns
in development, unless you pass `{ allowWeakSecret: true }`. Generate one with
`openssl rand -base64 32`.

**Status and headers.** `response().setStatus()` and `setHeader()` change the page response, and
a page may export `headers(ctx)`. They are writable **until the shell is sent** (see
[Rendering modes](../concepts/rendering-modes.md)); a change inside a streamed `<Suspense>` boundary is
`LUM5004`. So is `response().setStreaming(false)`, which makes the page wait for every
`<Suspense>` boundary and send one fully resolved document instead of streaming them
([for crawlers](../concepts/server.md#crawlers-get-one-resolved-document)).

**Env.** `env("NAME")` reads server env variables (the adapter's env, else `process.env`) in
server-only code. Only `import.meta.env.PUBLIC_*` reaches client code (`@lumiose/vite` sets Vite's
`envPrefix` to `"PUBLIC_"` unless the config sets its own); `publicEnv()` returns that subset.

**Server-only code** lives in `*.server.ts` modules and under `src/server/`. Importing it from code
that reaches the browser is `LUM4003`, also through a web worker, `new URL("…", import.meta.url)`
or a `?raw`/`?url` import. `lumiose dev` does not serve these files over HTTP either: they are added
to Vite's `server.fs.deny` unless the config sets its own list (the server still loads them).

> **Status:** the request handler, middleware, endpoints, cookies, env, error pages and
> instrumentation are available, served by `lumiose dev` and by the build output
> (`lumiose preview`, [`@lumiose/adapter-node`](adapter-node.md), the deploy adapters).

## The instrumentation file

`src/instrumentation.server.ts` (also `.js` or `.mjs`; server-only by its `.server.` segment) is
where error reporting and tracing start. `lumiose dev`, `lumiose preview`, the server build
(`dist/server/entry.js` on any host) and the deploy adapters load it; prerendering at build time
does not, since errors there fail the build. Its three exports are optional:

- **`register()`** runs once per server instance (per isolate on workers), before the first
  request, which waits for it: start an SDK here. `lumiose dev` runs it again after an edit of the
  file. What it throws is logged, and the server goes on.
- **`onRequestError(error, info)`** receives the unexpected errors of a request on every host,
  `lumiose dev` included: those that render the `error` page or answer 500, errors of streamed
  `<Suspense>` boundaries (also those `streamTimeout` ended), rejected `ctx.platform.waitUntil()`
  work, and errors an `<ErrorBoundary>` caught, with the `digest` its fallback shows outside dev. `redirect()`,
  `notFound()` and `error(status)` are not errors. `info` is `{ request, route, params, phase,
  digest }`, with `phase` one of `"middleware"` (also the route's locale checks), `"action"`,
  `"endpoint"`, `"render"`, `"stream"` or `"waitUntil"`. The handler's `onError` (the host's log,
  `console.error` by default) still gets each error first, except those an `<ErrorBoundary>`
  caught in dev.
- **`instrumentations`**, an array of observers with optional wrappers per phase: `request` (a
  request until its response is ready to send, `call()`'s result adds `response.status`),
  `middleware` (each middleware file, `info.file`), `action` (`info.name`: the key in `actions`,
  or `"default"`), `endpoint` (`info.method`), `render` (a page or error page until its shell is
  ready) and `stream` (each streamed boundary). A wrapper gets `call` and `info`
  (`{ request, route, params }` plus those): call `call()` where the phase runs and await it to
  time it. It never throws and resolves to `{ status: "success" }` or `{ status: "error", error }`.
  A wrapper only observes: the phase runs once, also when the wrapper never calls `call()`, its
  result is the phase's own, and what a wrapper throws is logged. The first observer is the
  outermost. Static files are served before the app and are not observed; a `fetchJSON()` the
  render handles in-process gets its phases observed, not a `request` of its own.

Without the file nothing loads; with it, a phase without wrappers costs one check. Its browser
counterpart, `src/instrumentation.client.ts`, runs on every page before hydration
([Islands](../concepts/islands.md#concept)).

## Tracing phases with OpenTelemetry

Tracing with [OpenTelemetry](https://opentelemetry.io/docs/languages/js/): install
`@opentelemetry/api` and an SDK (`@opentelemetry/sdk-node` with an exporter), start the SDK in
`register()`, and open a span per phase. Spans nest as the phases do: middleware inside the request,
the action, endpoint or render inside the middleware. Instrumenting other libraries automatically
(database drivers, `fetch`) still needs `node --import`, as OpenTelemetry documents.

```ts
// src/instrumentation.server.ts
import { SpanStatusCode, trace, type Attributes } from "@opentelemetry/api";
import type { ServerInstrumentation } from "lumiose";

export async function register() {
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  new NodeSDK({ serviceName: "my-app" }).start(); // exporters from OTEL_* env variables
}

const tracer = trace.getTracer("my-app");

/** A span around one phase, failed when the phase failed. */
const span =
  (name: string, attributes: Attributes) =>
  (call: () => Promise<{ status: "success" | "error"; error?: unknown }>) =>
    tracer.startActiveSpan(name, { attributes }, async (s) => {
      const result = await call();
      if (result.status === "error") {
        s.recordException(result.error as Error);
        s.setStatus({ code: SpanStatusCode.ERROR });
      }
      s.end();
    });

export const instrumentations: ServerInstrumentation[] = [
  {
    request: (call, info) =>
      tracer.startActiveSpan(`${info.request.method} ${info.route ?? ""}`, async (s) => {
        s.setAttributes({
          "http.request.method": info.request.method,
          "http.route": info.route ?? "",
        });
        const result = await call();
        if (result.status === "success" && result.response !== undefined) {
          s.setAttribute("http.response.status_code", result.response.status);
          if (result.response.status >= 500) s.setStatus({ code: SpanStatusCode.ERROR });
        }
        s.end();
      }),
    middleware: (call, info) => span("middleware", { "code.file.path": info.file })(call),
    action: (call, info) => span(`action ${info.name}`, { "http.route": info.route ?? "" })(call),
    endpoint: (call, info) =>
      span(`${info.method} handler`, { "http.route": info.route ?? "" })(call),
    render: (call, info) => span("render", { "http.route": info.route ?? "" })(call),
    stream: (call, info) => span("stream", { "http.route": info.route ?? "" })(call),
  },
];
```

## Common server mistakes

- **Reporting errors from middleware with `try`/`catch` around `next()`.** The error page, the
  `500` of an endpoint and streamed boundaries never throw there. Use `onRequestError` in
  `src/instrumentation.server.ts`.
- **Changing the request in an instrumentation wrapper.** Wrappers observe: they cannot change
  arguments, results or the response. Use middleware for that.

- **Guarding a section in a layout.** A layout's `redirect()` does not cover the folder's form
  actions or endpoints. Put the check in the folder's `middleware.ts`.
- **Guarding prerendered routes with folder middleware.** It runs at build time only for them
  (`LUM5008`). Set `export const mode = "server"` on the routes it protects.
- **Reading request APIs in a `static` route.** `cookies()`, `request()` and friends throw
  `LUM5001` while prerendering. Set `export const mode = "server"`.
- **Setting headers or status after the shell.** Inside a streamed `<Suspense>` boundary it is too
  late (`LUM5004`). Do it before the boundary, in the page body outside `<Suspense>`, in
  `headers(ctx)` or in middleware.
- **Reading secrets with `import.meta.env`.** Only `PUBLIC_*` values exist there. Use `env("NAME")`
  in server-only modules.
- **Catching `redirect()` by accident.** It throws. In a `try`/`catch`, rethrow when
  `isRedirect(error) || isHttpError(error)`.
- **Storing request data in module-scope variables.** Modules are shared by every request. Use
  `locals`, context or component state (`LUM4008`).
- **Expecting signed cookies to hide data.** They are tamper-proof, not encrypted.

## Data and actions in detail

**Reading: async components.** Await data in the component that needs it. Server-only data
access (databases, secrets) lives in `*.server.ts` modules or `src/server/`. See
[Async components](../concepts/async.md).

**HTTP APIs: endpoints.** A `route.ts` file under `src/routes` exports handlers named after HTTP
methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE` (and `HEAD`, `OPTIONS`), each
`(ctx) => Response`. Islands, SPA code and other clients call them with `fetch` or `fetchJSON`.

**`fetchJSON<T>(url, init?)`** fetches JSON and returns plain data, so awaited results stay
serializable inside islands. Non-2xx responses throw a `FetchError` (an `HttpError` with `status`,
`url` and the parsed body as `data`); if a server component lets it escape, the page renders
`error` (or `not-found`) page with that status. **During SSR, same-origin URLs are served in-process**, with
the page request's cookies, without a network round-trip. **Awaited in an async component, a GET
is cached by URL**: components awaiting the same URL share one request, and in the browser cached
data shows at once and revalidates in the background; `{ cache: "no-store" }` opts a request out.
`query(key, fn)` caches other data under an array key, and passes `fn` TanStack's
`{ signal, queryKey }`. See [Async components](../concepts/async.md) and [reference: query](#query).

**Mutations: form actions.** A page exports `action(ctx)` or named `actions = { name(ctx) }`. A
`<form method="post">` posts to the page (or to `?/name` for a named action) and works without
JavaScript. A named action's URL may keep the page's other query parameters: the action is the
parameter that starts with `/`, wherever it is, so `?status=open&/close` runs `close`, and
`ctx.url` still has `status=open` (useful to redirect back to a filtered list). An action receives
`ctx.formData()` and returns:

| Return                         | Result                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `redirect(to)` or a `Response` | Sent as is (303 after a POST).                                                                  |
| plain data                     | The page re-renders (200) and `actionData()` returns the data.                                  |
| `fail(status, data)`           | The page re-renders with `status`; `actionData()` returns `data`. Use it for validation errors. |

**Keeping what the user entered.** After a failed submission, send back the values to fill in
again with the errors, so the page renders the form filled in and nobody types everything again
(WCAG 3.3.7). Name the fields you send back:
`return fail(400, { errors, values: { username, email } })`. Everything in `actionData()` data is
embedded in the re-rendered page, so a password, a token or a card number in it would sit in the
HTML, within reach of every script on the page. A `FormData` works too (its text entries; files are
left out), but it carries every field of the form: in development, Lumiose warns when one carries a
name that looks secret (`password`, `pwd`, `token`, `otp`, `card`, `ssn`, `iban`, `privateKey`,
`sessionId`, …, in camelCase too, such as `passwordConfirm`).
@lumiose/ui's [Form](https://lumiose.dev/ui/form/) takes them as `values` and fills its
controls by name; with your own inputs, use them as `defaultValue`s.

An Origin check protects page POSTs and form-encoded endpoint requests by default (403 for
cross-site requests).

**Enhancing forms.** Inside an island, `onSubmit={submit}` posts the form without a page load.
`submit()` resolves to `{ type: "success", status, data }`, `{ type: "failure", status, data }` or
follows a redirect, and sets `actionData()`. It rejects only for unexpected errors, with a
`FetchError`. `isSubmitting(name?)` is true while a submission is in flight.

**Per-instance submissions.** `isSubmitting(name)` and `actionData()` are page-wide: rows of a
list that post the same action would share one pending flag and overwrite each other's result.
`submission()` gives a component its own handle, created during setup:
`const toggle = submission<typeof actions.toggle>()`, then `onSubmit={toggle.submit}`.
`toggle.isSubmitting()`, `toggle.result()` (the last `{ type: "success" | "failure", status, data }`,
typed from the action) and `toggle.error()` (the last unexpected `FetchError`) are this instance's
only. `toggle.submit()` takes what `submit()` takes and returns the same promise; a new submission
on the handle aborts the one in flight, `toggle.abort()` cancels it (the handle is idle at once,
and an abort is no error), `toggle.reset()` clears the result and the error, and disposing the
component aborts too. A handle never sets `actionData()`, while `isSubmitting(name)` still counts
it; SPA refreshing, `invalidate` targets and `optimistic()` work as with `submit()`. Errors land
in `error()`, so `onSubmit={toggle.submit}` reports no unhandled rejection; redirects navigate
and leave `result()` as it was.

**Refreshing.** `invalidate()` re-runs the current page's async components (SPA; the stale UI stays
until the new data arrives), or reloads the page (MPA). On client-routed (SPA) pages a successful
`submit()` runs it for you, so the page shows the mutation without extra code; pass
`submit(form, { invalidate: false })` to keep the page as it is. On MPA pages a successful
`submit()` never reloads: an island owns only its own state, so it updates itself from the result
(`result.data`, `actionData()`). Call `invalidate()` yourself when the page needs fresh
server-rendered content; on MPA pages that reloads and resets `actionData()`.

**Refreshing only what changed.** `invalidate(...targets)` refetches cache entries and re-runs only
the async components that awaited them, on SPA and MPA pages alike (islands included, no reload):
a string is a URL (the `fetchJSON` entry of that URL), an array a `query()` key prefix.
`submit(form, { invalidate: ["/api/books/1", ["stats"]] })` does the same after a successful
submission, instead of refreshing the whole page. Components rendered only on the server (outside
islands) are not re-run by a target: use `invalidate()` for those.

**Optimistic updates.** `optimistic(source)` follows `source` (a getter such as `() => props.likes`,
or a signal) and shows an overlay while a promise is pending: `likes.update((n) => n + 1,
submit(event))` or `likes.set(value, promise)`. When the promise settles the overlay drops:
on success the source already holds the new value, on failure (a `fail()` result or a rejection)
the value rolls back. On SPA pages `submit()` resolves after its `invalidate()`, so the refreshed
data replaces the overlay in the same task, with no flicker back. On MPA pages read the new value
from the result (`actionData()?.likes ?? props.likes` as the source), or pass
`submit(event).then(() => invalidate())`: the MPA `invalidate()` reloads and never settles, so the
overlay holds until the page unloads. Overlays apply in call order and drop independently, and an
`update` re-applies over the latest source. `optimistic` does not re-throw a rejection: await
`submit()` yourself to handle errors.

**Typed results.** Type an action's parameter with its page pattern,
`(ctx: ActionContext<"/books/new">)`, and let TypeScript infer what it returns:
`actionData<typeof actions>()` (or `typeof action`) is the union of the data the actions return
and the data they pass to `fail()`, or `undefined` before a submission. `submit<typeof actions.create>(form)`
resolves with `{ type: "success", data }` or `{ type: "failure", data }` typed from that action,
so the two are told apart by `type`; `actionData()` data is told apart by its shape.
`ActionData<typeof actions>` names that type for a child component's props. An island that posts to another page's action imports the
type only: `import type { actions } from "../routes/reading-list/page.stsx"`.

**More examples.**

Rows that post the same action, each with its own pending state and result:

```stsx check file=routes/checklist/page.stsx
// src/routes/checklist/page.stsx
import { submission, type ActionContext } from "lumiose";

export const mode = "server";

const done = new Set<string>(); // a database in a real app

export const actions = {
  async toggle(ctx: ActionContext<"/checklist">) {
    const id = String((await ctx.formData()).get("id"));
    if (done.has(id)) done.delete(id);
    else done.add(id);
    return { id, done: done.has(id) };
  },
};

export function Row(props: { id: string; label: string; done: boolean }) {
  const toggle = submission<typeof actions.toggle>();
  const isDone = () => {
    const result = toggle.result();
    return result?.type === "success" ? result.data.done : props.done;
  };
  return (
    <form method="post" action="?/toggle" onSubmit={toggle.submit}>
      <input type="hidden" name="id" value={props.id} />
      <button disabled={toggle.isSubmitting()}>
        {isDone() ? "✓" : "○"} {props.label}
      </button>
      {toggle.error() ? <span class="error">Not saved</span> : null}
    </form>
  );
}

export default function Checklist() {
  return (
    <ul>
      {["milk", "eggs", "bread"].map((item) => (
        <li>
          <Row client:load id={item} label={item} done={done.has(item)} />
        </li>
      ))}
    </ul>
  );
}
```

Keeping the page's filters through a named action:

```stsx check file=routes/issues/page.stsx
// src/routes/issues/page.stsx: the list is filtered by ?status=; "Close" keeps the filter
import { redirect, url, type ActionContext } from "lumiose";

export const mode = "server";

export const actions = {
  async close(ctx: ActionContext) {
    // await db.issues.close((await ctx.formData()).getAll("ids"));
    const back = new URL(ctx.url);
    back.searchParams.delete("/close"); // the action key; the filters stay
    redirect(back.pathname + back.search);
  },
};

export default function Issues() {
  const search = url().search; // "?status=open", or ""
  return (
    <form method="post" action={`${search === "" ? "?" : `${search}&`}/close`}>
      {/* rows with <input type="checkbox" name="ids" value={id} /> */}
      <button>Close selected</button>
    </form>
  );
}
```

**Mistakes with data and actions.**

- **Route loaders.** Lumiose has none. Await data in the page component; it is the same code on every
  route mode.
- **Calling server code from an island.** Import nothing from `*.server.ts` in island code
  (`LUM4003`); expose an endpoint and call it with `fetchJSON`.
- **`fetch()` instead of `fetchJSON()` inside islands.** A `Response` is not serializable
  (`LUM4007`).
- **One `isSubmitting(name)` for several forms.** Rows that post the same action share it, and
  `actionData()` holds whichever answered last. Give each row a `submission()`.
- **Expecting `submit()` to reject on validation errors.** `fail()` resolves with
  `{ type: "failure" }`; only unexpected errors reject.
- **Calling `invalidate()` after a successful `submit()` on an SPA page.** `submit()` already did;
  a second call refreshes twice.
- **Reaching for a client cache library first.** `fetchJSON` and `query` already dedupe, cache and
  revalidate component awaits on the server and in the browser. Use
  [`@lumiose/query`](query.md) for client data that needs polling, refetching on focus,
  retries or per-query stale times.
- **Expecting an MPA page to refresh after `submit()`.** On MPA pages `submit()` never reloads.
  Update the island from the result (a toggle sets its own state, a list removes its own row), or
  call `invalidate()` explicitly if the page must show fresh server HTML.
- **Leaving an optimistic overlay up after the request.** Pass the promise to `set`/`update`
  rather than resetting by hand, and on MPA pages give the island a source that changes
  (`actionData()`, or an explicit `invalidate()`), or the value returns to the old one on success.
- **Forms without `method="post"`.** Actions only run for POST; `submit()` refuses a form that does
  not say `method="post"`, as the no-JS form would not post either.
- **Throwing for validation errors.** A thrown error renders the `error` page. Return
  `fail(400, data)`.
- **Casting action data.** `actionData<{ errors: … }>()` is a type error: pass `typeof actions`.
  Annotating the export with `Action` (`export const action: Action = …`) hides what it returns,
  so annotate the parameter instead, or check it with `satisfies Action<"/x">`. Add
  `satisfies YourFailure` to `fail()` data whose string literals should stay literal.
- **Disabling the Origin check to make a cross-site form work.** Allow the specific origin instead
  (`lumiose({ csrf: { allowedOrigins } })` in `vite.config.ts`).
