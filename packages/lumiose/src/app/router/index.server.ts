// `lumiose/router` under the `node` condition (owner: Spark): what `spa` pages see while the server
// renders them (spec §7.5). Same names and types as ./index.ts. Reads come from the request scope;
// navigation is browser-only.
import type { Renderable } from "../../contract/client.ts";
import { Dynamic } from "../../server/elements.ts";
import { restProps } from "../../server/ssr.ts";
import { locale as requestLocale } from "../i18n/server.ts";
import type { CurrentLocale, RouteParams, Routes } from "../routes/registry.ts";
import type { RouteParamValues } from "../server/context.ts";
import {
  notePrefetchLink,
  params as requestParams,
  route as requestRoute,
  url as requestUrl,
} from "../server/scope.ts";
import { PREFETCH_MARKER } from "../server/navigation.ts";
import type { AfterNavigate, BeforeNavigate } from "./hooks.ts";
import type { LinkProps } from "./link.ts";
import type { SearchParams } from "./index.ts";
import type { NavigateOptions, SearchParamsInit } from "./router.ts";

export type { LinkProps, NavigateOptions, SearchParams, SearchParamsInit };
export type { Prefetch } from "./link.ts";
export type { AfterNavigate, BeforeNavigate, NavigationTarget, NavigationType } from "./hooks.ts";

function browserOnly(api: string): never {
  throw new Error(
    `${api} from lumiose/router runs in the browser: call it from an event handler or an effect.`,
  );
}

/**
 * Server `<Link>`: the `<a>` the client adopts, with `aria-current="page"` on the current URL and
 * the `prefetch` marker that MPA pages' speculation rules read.
 */
export function Link(props: LinkProps): Renderable {
  const others = restProps(props, ["prefetch"]) as Record<string, unknown>;
  let current = false;
  try {
    const here = requestUrl();
    const target = new URL(props.href, here);
    current = target.origin === here.origin && trim(target.pathname) === trim(here.pathname);
  } catch {
    // Outside a request (renderToString in a test): no current page.
  }
  // Getters stay getters: children render inside the element, as on the client.
  others.component = "a";
  others[PREFETCH_MARKER] = props.prefetch;
  // The handler picks the page's speculation rules from this, without searching the HTML.
  if (props.prefetch !== undefined) notePrefetchLink();
  others["aria-current"] = current ? "page" : undefined;
  return Dynamic(others as LinkProps & { component: "a" }) as Renderable;
}

function trim(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function navigate(_href: string | URL, _options?: NavigateOptions): Promise<void> {
  return browserOnly("navigate()");
}

export function params<P extends Routes = never>(): [P] extends [never]
  ? RouteParamValues
  : RouteParams<P> {
  return requestParams() as never;
}

export function route(): Routes | undefined {
  return requestRoute();
}

export function url(): URL {
  return requestUrl();
}

export function locale(): CurrentLocale {
  return requestLocale();
}

export function isNavigating(): boolean {
  return false;
}

/** Nothing navigates while the server renders: the hook is registered in the browser only. */
export function beforeNavigate(_fn: (navigation: BeforeNavigate) => void): void {}

/** Nothing navigates while the server renders: the hook is registered in the browser only. */
export function afterNavigate(_fn: (navigation: AfterNavigate) => void): void {}

export const searchParams: SearchParams = Object.assign(
  () => new URLSearchParams(requestUrl().search),
  {
    set: (_next: unknown, _options?: NavigateOptions): Promise<void> =>
      browserOnly("searchParams.set()"),
  },
);
