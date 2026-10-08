// Request scope (spec §7.3 "Request access", decision-19): the handler runs middleware, endpoints
// and the page render inside an AsyncLocalStorage frame, so server components anywhere in the
// tree (including streamed Suspense boundaries) can call request(), url(), params(), locals(),
// cookies(), response() and env(). Server-only: imports node:async_hooks.

import { AsyncLocalStorage } from "node:async_hooks";
import type { Routes, RouteParams } from "../routes/registry.ts";
import { LUM_AFTER_SHELL, LumenError } from "../diagnostics.ts";
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
}

const storage = new AsyncLocalStorage<RequestScope>();

export function runInRequestScope<T>(scope: RequestScope, fn: () => T): T {
  return storage.run(scope, fn);
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
      throw new LumenError(
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
  return currentScope("request()").ctx.request;
}

/** The current request URL. */
export function url(): URL {
  return currentScope("url()").ctx.url;
}

/** Params of the matched route; pass the route pattern to type them: `params<"/blog/[slug]">()`. */
export function params<P extends Routes = never>(): [P] extends [never]
  ? RouteParamValues
  : RouteParams<P> {
  return currentScope("params()").ctx.params as never;
}

/** The request's `locals`, set by middleware. */
export function locals(): Locals {
  return currentScope("locals()").ctx.locals;
}

/** The request's cookies. */
export function cookies(): Cookies {
  return currentScope("cookies()").ctx.cookies;
}

/** Status and headers of the page response; writable until the shell is sent. */
export function response(): ResponseContext {
  return currentScope("response()").response;
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

/** HMAC-signed cookie; the secret defaults to the `LUMEN_SECRET` env variable (see `env()`). */
export function signedCookie(name: string, options?: SignedCookieOptions): SignedCookie {
  return createSignedCookie(name, options, env);
}

export function processEnv(): ServerEnv {
  return (globalThis as { process?: { env: ServerEnv } }).process?.env ?? {};
}
