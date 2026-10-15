// `lumiose/router` (owner: Spark): the client router of `spa` routes (spec §7.5, decision-20). This is
// the browser entry (and the types); ./index.server.ts has the server variants with the same names.
import { splitLocale } from "../i18n/config.ts";
import { envI18n, normalizeBase, pathBelowBase } from "../routes/href.ts";
import type { CurrentLocale, Locale, RouteParams, Routes } from "../routes/registry.ts";
import type { RouteParamValues } from "../server/context.ts";
import {
  currentParams,
  currentRoute,
  currentSearchParams,
  currentUrl,
  navigate,
  isNavigating,
  routerLocale,
  setSearchParams,
  type NavigateOptions,
  type SearchParamsInit,
} from "./router.ts";

export {
  afterNavigate,
  beforeNavigate,
  type AfterNavigate,
  type BeforeNavigate,
  type NavigationTarget,
  type NavigationType,
} from "./hooks.ts";
export { Link, type LinkProps, type Prefetch } from "./link.ts";
export { navigate, isNavigating, type NavigateOptions, type SearchParamsInit };

/**
 * Params of the current route, reactive: `params<"/songs/[id]">().id`. Inside a page that is
 * still loading during a navigation, the params of the page it is loading.
 */
export function params<P extends Routes = never>(): [P] extends [never]
  ? RouteParamValues
  : RouteParams<P> {
  return currentParams() as never;
}

/**
 * The matched route pattern, reactive: `route() === "/songs/[id]"`. Undefined on a not-found page.
 * Inside a page that is still loading during a navigation, the pattern of the page it is loading.
 */
export function route(): Routes | undefined {
  return currentRoute() as Routes | undefined;
}

/**
 * The locale of the current URL with `lumiose({ i18n })` (decision-44), reactive inside SPA routes:
 * its prefix (`/es/about` → `"es"`), else the default locale. In islands of other routes, the
 * page's locale. Undefined without `lumiose({ i18n })`.
 */
export function locale(): CurrentLocale {
  const inside = routerLocale();
  if (inside !== undefined) return inside as Locale;
  // An island of another route: the page's URL.
  const i18n = envI18n();
  if (i18n === undefined) return undefined as never;
  const path = pathBelowBase(location.pathname, normalizeBase(import.meta.env?.BASE_URL ?? "/"));
  return (path === undefined ? i18n.defaultLocale : splitLocale(path, i18n).locale) as Locale;
}

/**
 * The current URL, reactive. Inside a page that is still loading during a navigation, the URL of
 * the page it is loading. Do not mutate it.
 */
export function url(): URL {
  return currentUrl();
}

export interface SearchParams {
  /** The query of the current URL, reactive. A new object per change: do not mutate it. */
  (): URLSearchParams;
  /**
   * Navigates to the current path with a new query, keeping the scroll position:
   * `searchParams.set({ q, page: 2 })`, `searchParams.set((current) => …)`. `null`/`undefined` values are
   * left out. Adds a history entry unless `{ replace: true }`.
   */
  set(
    next: SearchParamsInit | ((current: URLSearchParams) => SearchParamsInit),
    options?: NavigateOptions,
  ): Promise<void>;
}

/** The current URL's query (`searchParams()`), and `searchParams.set()` to change it. */
// Pure: an island that only uses `<Link>` (on an MPA page) ships none of the router.
export const searchParams: SearchParams = /* @__PURE__ */ Object.assign(
  () => currentSearchParams(),
  {
    set: setSearchParams,
  },
);
