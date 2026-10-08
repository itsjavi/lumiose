// Request context types (spec §8 Context). Type-only, so both public entries can export them:
// TypeScript resolves `lumen` through the browser entry (package.json "types").

import type { SSRNode } from "../../contract/server.ts";
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

/** Props of `src/document.stsx`: the collected head and the rendered body, as SSR nodes. */
export interface DocumentProps {
  head: SSRNode;
  body: SSRNode;
}
