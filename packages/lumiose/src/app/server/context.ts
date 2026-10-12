// Request context types (spec §8 Context). Type-only, so both public entries can export them:
// TypeScript resolves `lumiose` through the browser entry (package.json "types").

import type { Renderable } from "../../contract/client.ts";
import type {
  EndpointRoutes,
  Locale,
  PageRoutes,
  RouteParams,
  Routes,
} from "../routes/registry.ts";
import type { Cookies } from "./cookies.ts";

/**
 * Per-request data that middleware hands to pages and endpoints. Type it with:
 *
 *   declare module "lumiose" { interface Locals { user: User | null } }
 */
export interface Locals {}

/** Server environment variables: `process.env` unless the adapter passes its own. */
export type ServerEnv = Readonly<Record<string, string | undefined>>;

/**
 * The bindings of the platform in `ctx.platform.env` (Cloudflare's KV, D1, R2, Durable Objects…).
 * Type them with:
 *
 *   declare module "lumiose" { interface PlatformEnv { DB: D1Database } }
 */
export interface PlatformEnv {}

/**
 * What the host passes with each request (`fetch(request, platform)` of the server build), as
 * `ctx.platform`. The deploy adapters fill it in; every field has a fallback.
 */
export interface Platform {
  /** The platform's bindings (Cloudflare's `env`); `{}` on hosts without them (Node, Bun, Deno). */
  readonly env: PlatformEnv;
  /**
   * Keeps the host running `promise` after the response is sent (Cloudflare's, Vercel's and
   * Netlify's `waitUntil`). Elsewhere the promise just runs; a rejection goes to `onError`.
   */
  waitUntil(promise: Promise<unknown>): void;
  /** The client's IP address as the host sees it (a proxy's, behind one); undefined when unknown. */
  readonly clientAddress: string | undefined;
}

export type RouteParamValues = Record<string, string>;

/** The params of route pattern `P`, or any params without one (middleware, shared helpers). */
type ParamsOf<P extends Routes> = [P] extends [never] ? RouteParamValues : RouteParams<P>;

/**
 * What middleware, endpoints and actions receive. With a route pattern, `params` is typed:
 * `RequestContext<"/users/[id]">`. Without one (middleware, shared helpers) it is a string record.
 */
export interface RequestContext<P extends Routes = never> {
  request: Request;
  url: URL;
  /** Params of the matched route; `{}` when nothing matched. */
  params: ParamsOf<P>;
  /**
   * The request's locale with `lumiose({ i18n })` (decision-44): its URL prefix (`/es/about` →
   * `"es"`), else the default locale. Undefined without `lumiose({ i18n })`.
   */
  locale: Locale;
  locals: Locals;
  cookies: Cookies;
  env: ServerEnv;
  /** The host's extras: bindings, `waitUntil` and the client address (see `Platform`). */
  platform: Platform;
}

/** `src/middleware.ts` default export (or an array of them, run in order). */
export type Middleware = (
  ctx: RequestContext,
  next: () => Promise<Response>,
) => Response | Promise<Response>;

export type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";

/**
 * An endpoint method export, by route pattern:
 * `export const GET: Endpoint<"/api/users/[id]"> = (ctx) => Response.json(…)`.
 */
export type Endpoint<P extends EndpointRoutes = never> = (
  ctx: RequestContext<P>,
) => Response | Promise<Response>;

/**
 * The context of a form action, by page pattern: the request context plus its parsed form body.
 * Annotate the action's parameter with it so `actionData<typeof actions>()` and `submit()` infer
 * what the action returns: `save: async (ctx: ActionContext<"/books/[isbn]">) => …`.
 */
export interface ActionContext<P extends PageRoutes = never> extends RequestContext<P> {
  /** The request body as `FormData`; parsed once, so it can be called again. 400 if not a form. */
  formData(): Promise<FormData>;
}

/**
 * A page's form action, by page pattern: `export const action` or one entry of
 * `export const actions = { name: … }` (posted to `?/name`). Return a `Response` or `redirect()`,
 * data for `actionData()`, or `fail(status, data)`. An annotation with `Action` hides the result
 * type from `actionData<typeof action>()`: annotate the parameter with `ActionContext` instead, or
 * check the action with `satisfies Action<"/login">`.
 */
export type Action<P extends PageRoutes = never, Result = unknown> = (
  ctx: ActionContext<P>,
) => Result | Promise<Result>;

/**
 * Response status and headers for the page being rendered. Writable until the SSR shell is sent
 * (decision-19); later writes throw LUM5004. Headers set by middleware before `next()` also apply
 * to endpoint responses that do not set them.
 */
export interface ResponseContext {
  readonly status: number;
  setStatus(status: number): void;
  getHeader(name: string): string | null;
  setHeader(name: string, value: string): void;
}

/** Props of `error` and `not-found` pages. */
export interface ErrorPageProps {
  status: number;
  /** An `HttpError` from `error()`/`notFound()`; other errors are masked as 500 outside dev. */
  error: Error & { status?: number };
}

/**
 * Props of `src/document.stsx`: the collected head and the page body, to render once each
 * (`<head>{props.head}</head><body>{props.body}</body>`). The document renders like any component:
 * it can provide context to the page and set head defaults with `<Title>`/`<Meta>`.
 */
export interface DocumentProps {
  head: Renderable;
  body: Renderable;
}
