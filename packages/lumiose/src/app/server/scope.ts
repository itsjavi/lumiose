// Request scope (spec §7.3 "Request access", decision-19): the handler runs middleware, endpoints
// and the page render inside an AsyncLocalStorage frame, so server components anywhere in the
// tree (including streamed Suspense boundaries) can call request(), url(), params(), locals(),
// cookies(), response() and env(). Server-only: imports node:async_hooks.

import type { ActionData, ActionsExport } from "../actions/types.ts";
import type { BodyLimits } from "./body.ts";
import { AsyncLocalStorage } from "node:async_hooks";
import { createStateScope, runInStateScope } from "../../server/state.ts";
import type { Routes, RouteParams } from "../routes/registry.ts";
import { LUM_AFTER_SHELL, LUM_PRERENDER_REQUEST, LumioseError } from "../diagnostics.ts";
import type {
  Locals,
  RequestContext,
  ResponseContext,
  RouteParamValues,
  ServerEnv,
} from "./context.ts";
import {
  signedCookie as createSignedCookie,
  type CookieJar,
  type Cookies,
  type SignedCookie,
  type SignedCookieOptions,
} from "./cookies.ts";

/** Response status and headers collected for a page; see `ResponseContext`. */
export interface ResponseState extends ResponseContext {
  readonly headers: Headers;
  /** Called once the page shell resolved: later writes throw LUM5004. */
  seal(): void;
}

export interface RequestScope {
  ctx: RequestContext;
  cookies: CookieJar;
  response: ResponseState;
  /** The matched route pattern (`/blog/[slug]`); undefined when no route matched. */
  route?: string;
  /** Set when a form action ran and the page re-renders with its data. */
  action?: ActionState;
  /** Serves a same-origin request in-process, as part of this request (`fetchJSON()` in SSR). */
  fetch?: (request: Request) => Promise<Response>;
  /** The response's CSP nonce, with `lumiose({ csp: "strict" })` (./csp.ts). */
  nonce?: string;
  /** Set when the page rendered a `<Link prefetch>` marker (./navigation.ts). */
  prefetchLinks?: boolean;
  /** The body limits of the request: the app's, then the route's (./body.ts). */
  bodyLimits?: { current: BodyLimits };
  /**
   * With `lumiose({ i18n })` (decision-44): the request's locale (its URL prefix, else the default
   * locale), how `href()` builds URLs in it, and the matched route's URL in each locale it
   * declares (`alternates()`).
   */
  i18n?: {
    locale: string;
    href: (pattern: string, params: Record<string, unknown>) => string;
    alternates: Array<{ locale: string; href: string }>;
  };
}

export interface ActionState {
  /** What the action returned, or the `fail()` data. */
  data: unknown;
  /** `data` encoded with `encodeData`, for the browser's `actionData()`. */
  encoded: unknown;
}

const storage = new AsyncLocalStorage<RequestScope>();

/** Runs `fn` for one request: request APIs read `scope`, and scoped state starts fresh (decision-33). */
export function runInRequestScope<T>(scope: RequestScope, fn: () => T): T {
  return storage.run(scope, () => runInStateScope(createStateScope(), fn));
}

/** Notes that the current page renders a `data-l-prefetch` marker (`<Link prefetch>`). */
export function notePrefetchLink(): void {
  const scope = storage.getStore();
  if (scope !== undefined) scope.prefetchLinks = true;
}

/**
 * Build-time prerendering of a `static` route, or of an `spa` route with `prerender` (spec §7.1,
 * decision-38): there is no request, so request APIs throw LUM5001 while the route renders. Middleware is not guarded (it runs for every mode).
 */
export interface PrerenderGuard {
  /** Called with each violation, also when an `<ErrorBoundary>` later catches the error. */
  report(error: LumioseError): void;
}

const guards = new AsyncLocalStorage<PrerenderGuard | undefined>();

/** Runs `fn` with request APIs guarded (`guard`) or allowed again (`undefined`). */
export function runPrerenderGuarded<T>(guard: PrerenderGuard | undefined, fn: () => T): T {
  return guards.run(guard, fn);
}

/** Throws LUM5001 when `api` is used while a route is prerendered. */
export function assertRequestApi(api: string): void {
  const guard = guards.getStore();
  if (guard === undefined) return;
  const error = new LumioseError(
    LUM_PRERENDER_REQUEST,
    `${api} reads the request, but this route is prerendered at build time (mode "static", or an spa route with prerender), where there is no request. Render it per request (\`export const mode = "server"\`, or an spa route without prerender), or move this part into an island or the browser.`,
  );
  guard.report(error);
  throw error;
}

/** `url` as seen while prerendering: its query string is a request API. */
export function prerenderUrl(source: URL): URL {
  if (guards.getStore() === undefined) return source;
  return new Proxy(source, {
    get(target, key) {
      if (key === "search" || key === "searchParams") assertRequestApi(`url().${key}`);
      const value: unknown = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** The current request scope, or `undefined` outside a request. For the server runtime. */
export function getRequestScope(): RequestScope | undefined {
  return storage.getStore();
}

export function createResponseState(status = 200, headers?: HeadersInit): ResponseState {
  let current = status;
  let sealed = false;
  const all = new Headers(headers);
  const check = (what: string) => {
    if (sealed) {
      throw new LumioseError(
        LUM_AFTER_SHELL,
        `Cannot ${what} after the shell was sent. Set it outside <Suspense>, or on the Response returned by next() in middleware.`,
      );
    }
  };
  return {
    get status() {
      return current;
    },
    headers: all,
    setStatus(next) {
      check("set the response status");
      if (!(Number.isInteger(next) && next >= 200 && next <= 599)) {
        throw new RangeError(`setStatus(): status must be between 200 and 599, got ${next}.`);
      }
      current = next;
    },
    getHeader: (name) => all.get(name),
    setHeader(name, value) {
      check(`set the "${name}" header`);
      all.set(name, value);
    },
    seal() {
      sealed = true;
    },
  };
}

function currentScope(api: string): RequestScope {
  const current = storage.getStore();
  if (current === undefined) {
    throw new Error(
      `${api} can only be called while handling a request: in middleware, endpoints or server components.`,
    );
  }
  return current;
}

/** The current `Request`. */
export function request(): Request {
  const scope = currentScope("request()");
  assertRequestApi("request()");
  return scope.ctx.request;
}

/** The current request URL. */
export function url(): URL {
  return prerenderUrl(currentScope("url()").ctx.url);
}

/**
 * The matched route pattern, e.g. `"/blog/[slug]"`: compare it instead of matching `url().pathname`.
 * Undefined when no route matched (a `not-found` page for an unknown URL).
 */
export function route(): Routes | undefined {
  return currentScope("route()").route as Routes | undefined;
}

/** Params of the matched route; pass the route pattern to type them: `params<"/blog/[slug]">()`. */
export function params<P extends Routes = never>(): [P] extends [never]
  ? RouteParamValues
  : RouteParams<P> {
  return currentScope("params()").ctx.params as never;
}

/**
 * The CSP nonce of the response being rendered, with `lumiose({ csp: "strict" })`: put it on the
 * app's own inline scripts and styles (`<script nonce={cspNonce()}>`). Undefined without strict
 * CSP, outside a request, and while prerendering (prerendered pages allow their inline scripts
 * and styles by hash instead).
 */
export function cspNonce(): string | undefined {
  return storage.getStore()?.nonce;
}

/** The request's `locals`, set by middleware. */
export function locals(): Locals {
  const scope = currentScope("locals()");
  assertRequestApi("locals()");
  return scope.ctx.locals;
}

/** The request's cookies. */
export function cookies(): Cookies {
  const scope = currentScope("cookies()");
  assertRequestApi("cookies()");
  return scope.ctx.cookies;
}

/** Status and headers of the page response; writable until the shell is sent. */
export function response(): ResponseContext {
  const scope = currentScope("response()");
  assertRequestApi("response()");
  return scope.response;
}

/**
 * What this request's form action returned (the `fail()` data for failures), while the page
 * re-renders after a form post; `undefined` otherwise, also outside a request.
 */
export function actionData(): unknown;
export function actionData<A extends ActionsExport>(): ActionData<A> | undefined;
export function actionData(): unknown {
  return storage.getStore()?.action?.data;
}

/** A server env variable: the request's env when handling a request, else `process.env`. */
export function env(name: string): string | undefined {
  const current = storage.getStore();
  return current !== undefined ? current.ctx.env[name] : processEnv()[name];
}

/** The `PUBLIC_*` subset of an env, which is safe to expose to client code. */
export function publicEnv(source: ServerEnv = processEnv()): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(source)) {
    if (name.startsWith("PUBLIC_") && value !== undefined) result[name] = value;
  }
  return result;
}

/** HMAC-signed cookie; the secret defaults to the `LUMIOSE_SECRET` env variable (see `env()`). */
export function signedCookie(name: string, options?: SignedCookieOptions): SignedCookie {
  return createSignedCookie(name, options, env);
}

export function processEnv(): ServerEnv {
  return (globalThis as { process?: { env: ServerEnv } }).process?.env ?? {};
}
