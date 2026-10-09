// Browser variants of the server-only request APIs. `lumen` must expose the same names in both
// entries (types resolve through the browser one), so these keep the server signatures and throw
// LUM4003 if client code calls them. Keep the signatures in sync with ./scope.ts; this module must
// not import it (it pulls in node:async_hooks).

import { LUM_SERVER_ONLY, LumenError } from "../diagnostics.ts";
import type { Routes, RouteParams } from "../routes/registry.ts";
import type { Locals, ResponseContext, RouteParamValues, ServerEnv } from "./context.ts";
import type { Cookies, SignedCookie, SignedCookieOptions } from "./cookies.ts";

function serverOnly(api: string, hint: string): never {
  throw new LumenError(
    LUM_SERVER_ONLY,
    `${api} is server-only and cannot run in the browser. ${hint}`,
  );
}

const CALL_ENDPOINT = "Call an endpoint from client code instead.";

export function request(): Request {
  return serverOnly("request()", CALL_ENDPOINT);
}

export function url(): URL {
  return serverOnly("url()", "Inside SPA routes, use url() from lumen/router.");
}

export function params<P extends Routes = never>(): [P] extends [never]
  ? RouteParamValues
  : RouteParams<P> {
  return serverOnly("params()", "Inside SPA routes, use params() from lumen/router.");
}

export function route(): Routes | undefined {
  return serverOnly("route()", "Inside SPA routes, use route() from lumen/router.");
}

/** The page's CSP nonce (`<meta property="csp-nonce">`), with `lumen({ csp: "strict" })`. */
export function cspNonce(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const meta = document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]');
  return meta?.nonce || undefined;
}

export function locals(): Locals {
  return serverOnly("locals()", CALL_ENDPOINT);
}

export function cookies(): Cookies {
  return serverOnly("cookies()", CALL_ENDPOINT);
}

export function response(): ResponseContext {
  return serverOnly("response()", CALL_ENDPOINT);
}

export function env(_name: string): string | undefined {
  return serverOnly("env()", "Client code reads import.meta.env.PUBLIC_* instead.");
}

export function publicEnv(_source?: ServerEnv): Record<string, string> {
  return serverOnly("publicEnv()", "Client code reads import.meta.env.PUBLIC_* instead.");
}

export function signedCookie(_name: string, _options?: SignedCookieOptions): SignedCookie {
  return serverOnly("signedCookie()", CALL_ENDPOINT);
}
