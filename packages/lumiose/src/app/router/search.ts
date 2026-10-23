// `searchParams()` and `searchParams.set()` of `lumiose/router` (owner: Spark, decision-61).
//
// - Inside an SPA they are the router's (`setRouterSearch`): reactive per view, and `set()`
//   navigates through the router.
// - In islands of MPA pages (`static` and `server` routes), where no router runs, `set()` loads
//   the page with the new query, as `navigate()` does there. With `{ shallow: true }` the query is
//   URL state instead: a signal shared by every island of the document, which `set()` writes with
//   `history.pushState()`/`replaceState()` without loading anything, and which back/forward
//   between those entries update. Nothing navigates then: the navigation hooks do not run, and the
//   server-rendered parts of the page keep the HTML of the URL they were rendered for.
//
// Apart from ./router.ts, so that those islands ship none of the router.
import { computed, signal, type Signal } from "../../core/signal.ts";
import type { NavigateOptions } from "./router.ts";

export type SearchParamsInit =
  | URLSearchParams
  | string
  | Record<string, string | number | boolean | readonly string[] | null | undefined>;

/** Options of `searchParams.set()`. */
export interface SearchParamsOptions extends NavigateOptions {
  /**
   * In islands of MPA pages, update the URL and `searchParams()` without loading the page. Inside
   * an SPA, where a query change already keeps every layout and page mounted, it changes nothing.
   */
  shallow?: boolean;
}

type SearchParamsNext = SearchParamsInit | ((current: URLSearchParams) => SearchParamsInit);

/** The SPA router's `searchParams()` and `searchParams.set()`. */
export interface RouterSearch {
  read(): URLSearchParams;
  set(next: SearchParamsNext, options: NavigateOptions): Promise<void>;
}

/** A signal, so that an island read before the SPA started follows the router once it does. */
const routed = signal<RouterSearch | undefined>(undefined);

/** Called by the router when it starts and stops. */
export function setRouterSearch(search: RouterSearch | undefined): void {
  routed.set(search);
}

/** The shallow query (`location.search`) and its params, created on the first use. */
let shallow: { search: Signal<string>; params: () => URLSearchParams } | undefined;

function onPopState(): void {
  shallow?.search.set(location.search);
}

function shallowState(): NonNullable<typeof shallow> {
  if (shallow === undefined) {
    const search = signal(location.search);
    shallow = { search, params: computed(() => new URLSearchParams(search())) };
    // Back/forward between the entries a shallow `set()` added stay in the document.
    addEventListener("popstate", onPopState);
  }
  return shallow;
}

/** `searchParams()`. */
export function readSearchParams(): URLSearchParams {
  const router = routed();
  return router === undefined ? shallowState().params() : router.read();
}

/** `searchParams.set()`. */
export function writeSearchParams(
  next: SearchParamsNext,
  options: SearchParamsOptions = {},
): Promise<void> {
  const router = routed.peek();
  if (router !== undefined) return router.set(next, options);
  const url = new URL(location.href);
  const value = typeof next === "function" ? next(new URLSearchParams(url.search)) : next;
  url.search = searchString(value);
  if (options.shallow !== true) {
    if (options.replace === true) location.replace(url.href);
    else location.assign(url.href);
    return Promise.resolve();
  }
  const state = shallowState();
  // As in the browser, going to the current URL replaces its entry.
  const replace = options.replace === true || url.href === location.href;
  history[replace ? "replaceState" : "pushState"](history.state, "", url.href);
  state.search.set(location.search);
  return Promise.resolve();
}

/**
 * Escapes that `URLSearchParams` writes for characters a query holds as they are and its parser
 * reads as themselves (RFC 3986 sub-delims, `:`, `@`, `/` and `?`, less `&`, `=` and `+`, and `'`,
 * which the URL parser escapes in http(s) queries).
 */
const READABLE = /%(?:2[1489CF]|3[ABF]|40|7E)/g;

/**
 * A query string from a `searchParams.set()` value: `null` and `undefined` values are left out.
 * Serialized as `URLSearchParams` does (form encoding: `%`, `&`, `=`, `+`, `#` and what a URL cannot
 * hold are escaped, spaces become `+`), then `! $ ( ) , / : ; ? @ ~` are unescaped, so that
 * `sorts=price:desc,name:asc` stays readable (TASK-525). `URLSearchParams` parses both alike, in
 * the browser and on the server.
 */
export function searchString(value: SearchParamsInit): string {
  let out: URLSearchParams;
  if (typeof value === "string" || value instanceof URLSearchParams) {
    out = new URLSearchParams(value);
  } else {
    out = new URLSearchParams();
    for (const [key, item] of Object.entries(value)) {
      if (item === null || item === undefined) continue;
      if (Array.isArray(item)) for (const one of item) out.append(key, String(one));
      else out.append(key, String(item));
    }
  }
  // Every `%` of the input is escaped (`%25`), so each match is an escape `URLSearchParams` wrote.
  return out.toString().replace(READABLE, decodeURIComponent);
}

/** For tests: forgets the shallow query and the router. */
export function resetSearch(): void {
  removeEventListener("popstate", onPopState);
  shallow = undefined;
  routed.set(undefined);
}
