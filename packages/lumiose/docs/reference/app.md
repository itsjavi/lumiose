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
component lets it escape, the page renders `_error` (or `_404`) with the same status.

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
  /** Client-routed (SPA) pages: after a success, refresh the page's data with invalidate().
   *  Default true. MPA pages never invalidate on their own. */
  invalidate?: boolean;
}

type ActionResult<Data = unknown, Failure = unknown> =
  | { type: "success"; status: number; data: Data }
  | { type: "failure"; status: number; data: Failure }
  | { type: "redirect"; status: number; location: string };
```

Posts without a page load. `success` and `failure` set `actionData()`; `redirect` navigates.
On client-routed (SPA) pages, after a `success`, `submit()` runs [`invalidate()`](#invalidate) and
resolves once the page's data is fresh (decision-20); `{ invalidate: false }` skips it. On MPA pages
it never reloads: the island updates itself from the result, or calls `invalidate()` explicitly.
Failures, redirects and errors do not invalidate. Rejects only for unexpected errors (the action throws, an error response, a network
failure) with a `FetchError`, and with a `TypeError` for a redirect to a URL that is not `http(s)`
(a `javascript:` location never runs). Browser only: rejects on the server.

### submitting

```ts
function submitting(name?: string): boolean;
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
function invalidate(): Promise<void>;
```

Refreshes the current page's server data after a mutation: re-runs the page's async components in
SPA routes (their UI stays until the new data arrives), reloads the page otherwise. A successful
`submit()` calls it for you on SPA pages only; on MPA pages call it yourself when the page needs
fresh server HTML. Browser only.

## Routing

### href

```ts
function href<P extends Routes>(pattern: P, ...args: HrefArgs<P>): string;
```

Builds a path from a route pattern, encoding each param; `params` is required when the pattern has
params. A `[...rest]` param keeps its `/` separators and may be empty. Throws on a missing or empty
`[param]`.

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

They throw; the framework renders a redirect, the nearest `_404` (404) or the nearest `_error`.
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
the browser they throw `LUM4003`. `env()` reads the adapter's env, else `process.env`;
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
```

## Example

```ts check file=routes/api/session.ts
// src/routes/api/session.ts
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
