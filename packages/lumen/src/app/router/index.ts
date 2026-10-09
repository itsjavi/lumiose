// `lumen/router` (owner: Spark): the client router of `spa` routes (spec §7.5, decision-20). This is
// the browser entry (and the types); ./index.server.ts has the server variants with the same names.
import type { RouteParams, Routes } from "../routes/registry.ts";
import type { RouteParamValues } from "../server/context.ts";
import {
  currentParams,
  currentRoute,
  currentSearch,
  currentUrl,
  navigate,
  navigating,
  setSearch,
  type NavigateOptions,
  type SearchInit,
} from "./router.ts";

export { Link, type LinkProps, type Prefetch } from "./link.ts";
export { navigate, navigating, type NavigateOptions, type SearchInit };

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
 * The current URL, reactive. Inside a page that is still loading during a navigation, the URL of
 * the page it is loading. Do not mutate it.
 */
export function url(): URL {
  return currentUrl();
}

export interface Search {
  /** The query of the current URL, reactive. A new object per change: do not mutate it. */
  (): URLSearchParams;
  /**
   * Navigates to the current path with a new query, keeping the scroll position:
   * `search.set({ q, page: 2 })`, `search.set((current) => …)`. `null`/`undefined` values are
   * left out. Adds a history entry unless `{ replace: true }`.
   */
  set(
    next: SearchInit | ((current: URLSearchParams) => SearchInit),
    options?: NavigateOptions,
  ): Promise<void>;
}

/** The current URL's query (`search()`), and `search.set()` to change it. */
// Pure: an island that only uses `<Link>` (on an MPA page) ships none of the router.
export const search: Search = /* @__PURE__ */ Object.assign(() => currentSearch(), {
  set: setSearch,
});
