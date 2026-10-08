// Request context types (spec §8 Context). Type-only, so both public entries can export them:
// TypeScript resolves `lumen` through the browser entry (package.json "types").

import type { Renderable } from "../../contract/client.ts";
import type { Cookies } from "./cookies.ts";

/**
 * Per-request data that middleware hands to pages and endpoints. Type it with:
 *
 *   declare module "lumen" { interface Locals { user: User | null } }
 */
export interface Locals {}

/** Server environment variables: `process.env` unless the adapter passes its own. */
export type ServerEnv = Readonly<Record<string, string | undefined>>;

export type RouteParamValues = Record<string, string>;

export interface RequestContext<Params = RouteParamValues> {
  request: Request;
  url: URL;
  /** Params of the matched route; `{}` when nothing matched. */
  params: Params;
  locals: Locals;
  cookies: Cookies;
  env: ServerEnv;
}

/** `src/middleware.ts` default export (or an array of them, run in order). */
export type Middleware = (
  ctx: RequestContext,
  next: () => Promise<Response>,
) => Response | Promise<Response>;

export type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";

/** An endpoint method export: `export const GET: Endpoint = (ctx) => Response.json(…)`. */
export type Endpoint<Params = RouteParamValues> = (
  ctx: RequestContext<Params>,
) => Response | Promise<Response>;

/** The context of a form action: the request context plus its parsed form body. */
export interface ActionContext<Params = RouteParamValues> extends RequestContext<Params> {
  /** The request body as `FormData`; parsed once, so it can be called again. 400 if not a form. */
  formData(): Promise<FormData>;
}

/**
 * A page's form action: `export const action: Action = (ctx) => …`, or one entry of
 * `export const actions = { name: (ctx) => … }` (posted to `?/name`). Return a `Response` or
 * `redirect()`, data for `actionData()`, or `fail(status, data)`.
 */
export type Action<Params = RouteParamValues, Result = unknown> = (
  ctx: ActionContext<Params>,
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

/** Props of `_error` and `_404` pages. */
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
