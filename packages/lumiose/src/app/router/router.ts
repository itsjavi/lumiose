// The client router of SPA subtrees (spec §7.5, §4.4, decisions 18 and 20; owner: Spark).
//
// - Boot: the SPA entry (./boot.ts) hydrates or client-renders the SPA root island with `spaRoot()`
//   once the modules of its first view are loaded. One SPA runs per document.
// - Views: a view is a URL resolved to the files the island renders ("levels": the SPA's layouts,
//   then the page or a `not-found`/`error` page) and its params. `current` holds the committed view.
// - Outlets: each layout's `children` is an outlet rendering the next level. Navigating to a view
//   keeps the levels both views share (persistent layouts keep their state) and replaces the rest
//   at the first level that differs: another file, or other values of the params in its path
//   (`users/[id].tsx` is a new page for each user). The new content is created off-screen under a
//   boundary that counts its pending async content (like an async run before it is shown), so the
//   old page stays until the new one is ready; then, in one step, the URL signals change, the new
//   content swaps in and the old content is disposed. A view with the same levels (another query)
//   commits at once; props and `params()`/`url()`/`searchParams()` are reactive.
// - View transitions: with `lumiose({ viewTransitions: true })` the entry passes `viewTransition()`,
//   and that swap runs inside it. A view with the same levels still commits at once.
// - Content created for a view reads that view (`params()`, `url()`, props) until it is shown,
//   then the committed one.
// - Navigation API: same-document navigations to URLs of this SPA are intercepted, so plain
//   `<a href>` links, back/forward and `navigation.navigate()` all route here; it also restores
//   scroll and resets focus after each transition. Without it, the History API fallback
//   (./history.ts, loaded only then) intercepts link clicks and `popstate`, restores scroll and
//   resets focus the same way.
// - Announcer (./announcer.ts, TASK-345): once a navigation's page is on screen, scrolled and
//   focused, a live region reads its title to screen readers (not for the first view).
// - Hooks (./hooks.ts, decision-50): `beforeNavigate` hooks run before a navigation loads anything
//   and may cancel it; `afterNavigate` hooks run once its page is on screen, scrolled, focused and
//   announced.
//   A navigation to a document outside the SPA runs them with `willUnload`, then unloads.
// - Errors: a render error, a rejected async page or `notFound()` render the nearest `error` or
//   `not-found` page inside the SPA (`redirect()` navigates); without one, a minimal built-in page.
// - `invalidate()` bumps a revision that every async component run and resource below the SPA
//   reads, so they re-run (holding their UI); `submit()` redirects navigate through the router.
import type { Component, Renderable } from "../../contract/client.ts";
import { isBusy } from "../../core/async.ts";
import { batch, effect, onMount } from "../../core/effect.ts";
import {
  beginBusy,
  createOwner,
  disposeOwner,
  getOwner,
  handleError,
  lookupContext,
  onCleanup,
  onError,
  provideContext,
  REVISION,
  runWithOwner,
  SUSPENSE,
  type Boundary,
  type Owner,
} from "../../core/internal.ts";
import { readContext } from "../../core/owner.ts";
import { untrack } from "../../core/reactive.ts";
import { computed, signal, type Signal } from "../../core/signal.ts";
import { createComponent } from "../../dom/component.ts";
import { DEV, INSPECTED } from "../../dom/dev.ts";
import { MISMATCH } from "../../dom/hydration.ts";
import { INSTRUMENTED, instrument, notify } from "../../dom/instrument.ts";
import { createRange, renderRange, type RangeStart } from "../../dom/insert.ts";
import { navigationUrl, setClientNavigation } from "../actions/navigation.ts";
import { splitLocale } from "../i18n/config.ts";
import { createRouteMatcher, type RouteMatcher } from "../routes/match.ts";
import { formatPattern } from "../routes/segments.ts";
import type { RouteManifest } from "../routes/manifest.ts";
import type { Routes } from "../routes/registry.ts";
import { HttpError, isHttpError, isRedirect } from "../server/control.ts";
import { createAnnouncer, type Announcer } from "./announcer.ts";
import type { HistoryNavigation } from "./history.ts";
import {
  endNavigation,
  leaveTo,
  runBefore,
  setRouterLocation,
  startNavigation,
  type NavigationTarget,
  type RouterNavigation,
} from "./hooks.ts";
import type { followLocaleLinks } from "./locale-links.ts";
import { searchString, setRouterSearch, type SearchParamsInit } from "./search.ts";
import { REROUTE_ATTR, type ClientRoute, type ClientTable } from "./table.ts";
import { labelValue } from "../../dom/devtools.ts";

export type Params = Record<string, string>;
type Module = Record<string, unknown>;

/** What the SPA entry passes to the router: the route table and a loader per module. */
export interface SpaConfig extends ClientTable {
  /** Project-relative file → import of the module. */
  modules: Record<string, () => Promise<Module>>;
  /** Vite's `base`, with leading and trailing slashes. */
  base: string;
  /**
   * `viewTransition()` (../../dom/view-transition.ts) with `lumiose({ viewTransitions: true })`:
   * navigations to other pages then swap their content inside a view transition. The entry imports
   * it only then, so other SPAs leave it out.
   */
  viewTransition?: (update: () => void) => Promise<void>;
  /**
   * `followLocaleLinks()` (./locale-links.ts) with `lumiose({ i18n })`: the hreflang and canonical
   * links follow the committed view. The entry imports it only then, so other SPAs leave it out.
   */
  followLocaleLinks?: typeof followLocaleLinks;
}

interface Level {
  file: string;
  component: Component<any>;
}

/** A URL resolved to what the SPA renders for it. */
export interface View {
  url: URL;
  params: Params;
  /** The matched route pattern (`/songs/[id]`); undefined when no route matched (a 404). */
  route?: string;
  /** `lumiose({ i18n })`: the locales the matched route declares. */
  locales?: string[];
  levels: Level[];
  /** Error pages (`not-found`, `error`, the built-in one): the leaf's `status` and `error` props. */
  error?: { status: number; error: Error };
}

/** What content created for a view reads (context `ROUTE`): that view until it is shown, then the committed one. */
interface Scope {
  view: () => View;
  params: () => Params;
  url: () => URL;
  route: () => string | undefined;
  searchParams: () => URLSearchParams;
}

/** A level's content in an outlet: its owner and range, and the outlet its `children` renders. */
interface Content {
  file: string;
  owner: Owner;
  node: RangeStart;
  child: Outlet | undefined;
}

interface Outlet {
  /** Where its content lives in the owner tree: inside the layout that reads `children`. */
  owner: Owner | undefined;
  shown: Signal<Content>;
}

/** What a URL resolves to before its modules load. */
interface Target {
  levels: string[];
  params: Params;
  route?: ClientRoute;
  status?: number;
}

/** A navigation in flight. */
interface Nav {
  /** Disposes content prepared for it. */
  cancel: (() => void) | undefined;
  /** Resolves its `show()`. */
  done: (() => void) | undefined;
}

/** The running SPA. */
interface Router {
  config: SpaConfig;
  matcher: RouteMatcher;
  app: string;
  current: Signal<View>;
  scope: Scope;
  root: Outlet | undefined;
  navigating: Signal<boolean>;
  revision: Signal<number>;
  /** The latest navigation, until it commits or fails. */
  active: Nav | undefined;
  endBusy: (() => void) | undefined;
  /** Modules loaded or loading, by file. */
  loaded: Map<string, Promise<Component<any>>>;
  /** The route announcer, once the SPA root is on screen. */
  announcer: Announcer | undefined;
}

const ROUTE: unique symbol = Symbol("lumiose.route");
/** `navigation.navigate()` info of `navigate()`; it tells the hooks their type. */
const NAVIGATE = "lumiose:navigate";
/** `navigation.navigate()` info of navigations that keep the scroll position (`searchParams.set()`). */
const KEEP_SCROLL = "lumiose:keep-scroll";
/** `navigation.navigate()` info of a thrown `redirect()`: it continues a confirmed navigation. */
const REDIRECT = "lumiose:redirect";
/** `navigation.traverseTo()` info of the way back from a back/forward that a hook cancelled. */
const RESTORE = "lumiose:restore";

let router: Router | undefined;

/** Creates the router of the document's SPA (by the SPA entry). */
export function createRouter(config: SpaConfig, app: string): void {
  const matcher = createRouteMatcher(
    config as unknown as Pick<RouteManifest, "routes" | "notFoundPages">,
  );
  const current = signal<View>(undefined as unknown as View);
  router = {
    config,
    matcher,
    app,
    current,
    scope: createScope(current),
    root: undefined,
    navigating: signal(false),
    revision: signal(0),
    active: undefined,
    endBusy: undefined,
    loaded: new Map(),
    announcer: undefined,
  };
  if (import.meta.env?.DEV && INSPECTED) {
    labelValue(current, "route view", true);
    labelValue(router.navigating, "isNavigating()", true);
    labelValue(router.revision, "route revision", true);
  }
}

function createScope(view: () => View): Scope {
  const params = computed(() => view().params);
  const search = computed(() => view().url.search);
  if (import.meta.env?.DEV && INSPECTED) {
    const scope = {
      view,
      params,
      url: computed(() => view().url),
      route: computed(() => view().route),
      searchParams: computed(() => new URLSearchParams(search())),
    };
    for (const [key, value] of Object.entries(scope)) labelValue(value, `${key}()`, true);
    labelValue(search, "search", true);
    return scope;
  }
  return {
    view,
    params,
    url: computed(() => view().url),
    route: computed(() => view().route),
    searchParams: computed(() => new URLSearchParams(search())),
  };
}

// --- Resolving views ----------------------------------------------------------------------------

/** The SPA path of `url` (below `base`), or `undefined` when it is outside this SPA's origin or base. */
function routePath(url: URL, base: string): string | undefined {
  if (url.origin !== location.origin) return undefined;
  if (base === "/") return url.pathname;
  if (url.pathname === base.slice(0, -1)) return "/";
  return url.pathname.startsWith(base) ? url.pathname.slice(base.length - 1) : undefined;
}

/**
 * What this SPA renders for `url`; `undefined` for URLs it does not own (a document navigation).
 * With `lumiose({ i18n })`, routes match the path without its locale prefix, and a page the SPA
 * owns only in the locales it declares (decision-44): the server answers the others.
 */
function targetOf(r: Router, url: URL): Target | undefined {
  const below = routePath(url, r.config.base);
  if (below === undefined) return undefined;
  const { i18n } = r.config;
  const { locale, path } = i18n === undefined ? { path: below } : splitLocale(below, i18n);
  const match = r.matcher.match(path);
  if (match !== null) {
    const route = match.route as unknown as ClientRoute;
    if (locale !== undefined && route.locales?.includes(locale) !== true) return undefined;
    return route.app === r.app ? { levels: route.levels!, params: match.params, route } : undefined;
  }
  const notFound = r.matcher.notFound(path);
  const page = notFound === undefined ? undefined : r.config.pages[notFound.file];
  return page?.app === r.app ? { levels: page.levels, params: {}, status: 404 } : undefined;
}

function loadLevel(r: Router, file: string): Promise<Component<any>> {
  let loading = r.loaded.get(file);
  if (loading === undefined) {
    const load = r.config.modules[file];
    loading = (
      load === undefined ? Promise.reject(new Error(`${file} is not an SPA module.`)) : load()
    )
      .then((module) => {
        if (typeof module.default !== "function") {
          throw new TypeError(`${file} must export default a component.`);
        }
        return module.default as Component<any>;
      })
      .catch((error: unknown) => {
        // A later navigation tries again (a chunk that failed to load, a syntax error fixed in dev).
        r.loaded.delete(file);
        throw error;
      });
    r.loaded.set(file, loading);
  }
  return loading;
}

async function loadLevels(r: Router, files: readonly string[]): Promise<Level[]> {
  const components = await Promise.all(files.map((file) => loadLevel(r, file)));
  return files.map((file, i) => ({ file, component: components[i]! }));
}

/** Starts loading what `url` renders (`<Link prefetch>`); failures are ignored. */
export function prefetch(href: string): void {
  const r = router;
  if (r === undefined) return;
  const target = targetOf(r, new URL(href, document.baseURI));
  if (target !== undefined) loadLevels(r, target.levels).catch(() => {});
}

function createView(r: Router, url: URL, target: Target, levels: Level[]): View {
  // Equal params keep their identity, so what reads them does not re-run.
  const previous = untrack(r.current);
  const view: View = {
    url,
    params:
      previous !== undefined && sameParams(previous.params, target.params)
        ? previous.params
        : target.params,
    levels,
  };
  if (target.route !== undefined) {
    view.route = formatPattern(target.route.segments);
    if (target.route.locales !== undefined) view.locales = target.route.locales;
  }
  if (target.status !== undefined) {
    view.error = { status: target.status, error: new HttpError(target.status, "Not Found") };
  }
  return view;
}

function sameParams(a: Params, b: Params): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

// --- Boot ---------------------------------------------------------------------------------------

/** Island props of the SPA root: the status and message of an error page the server rendered. */
export interface SpaRootProps {
  status?: number;
  message?: string;
}

/**
 * Loads what the SPA root island renders first and returns its root component. `leaf` is the page
 * or error page the server rendered (from the island ref). `csr`: the server sent an empty shell,
 * so the view comes from the URL (a static host may serve the shell for any URL, as `404.html`).
 * A `not-found` page at the URL of a page that reroutes (`reroutes()` in ./table.ts: prerendered, with
 * params `staticPaths()` may not list) renders that page instead, on the client: the island asks
 * the loader for a fresh render (`$$fresh`), and the page decides, with the browser's data, whether
 * it is found.
 */
export async function prepareRoot(leaf: string, csr: boolean): Promise<Component<SpaRootProps>> {
  const r = router!;
  const url = new URL(location.href);
  const target = targetOf(r, url);
  const page = r.config.pages[leaf];
  const reroute =
    !csr &&
    target?.route?.reroute === true &&
    r.config.notFoundPages.some((notFound) => notFound.file === leaf);
  const [routeLevels, errorLevels] = await Promise.all([
    target === undefined ? undefined : loadLevels(r, target.levels),
    page === undefined || reroute ? undefined : loadLevels(r, page.levels),
  ]);
  if (reroute) {
    const root: Component<SpaRootProps> & { $$fresh?: true } = () =>
      spaRoot(r, createView(r, url, target!, routeLevels!));
    root.$$fresh = true;
    return root;
  }
  return (props) => {
    let view: View;
    const status = props.status;
    if (status !== undefined && errorLevels !== undefined && !(csr && status === 404 && target)) {
      view = {
        url,
        params: target?.params ?? {},
        levels: errorLevels,
        error: { status, error: new HttpError(status, props.message ?? "") },
      };
      if (target?.route !== undefined) view.route = formatPattern(target.route.segments);
    } else if (target !== undefined) {
      view = createView(r, url, target, routeLevels!);
    } else {
      view = builtinError(url, 404, new HttpError(404, "Not Found"));
    }
    return spaRoot(r, view);
  };
}

/** The SPA root island's component: renders `view` and starts routing. */
function spaRoot(r: Router, view: View): Renderable {
  const owner = getOwner()!;
  r.current.set(view);
  // `<html lang>` and the hreflang and canonical links follow the committed view (decision-44).
  const { i18n } = r.config;
  if (i18n !== undefined) {
    effect(() => {
      const locale = localeOf(r, r.current().url);
      if (locale !== undefined) document.documentElement.lang = locale;
    });
    r.config.followLocaleLinks?.(i18n, r.config.base, r.current);
  }
  provideContext(ROUTE, r.scope);
  provideContext(REVISION, r.revision);
  setRouterLocation(() => locationOf(untrack(r.current)));
  onCleanup(() => setRouterLocation(undefined));
  setRouterSearch({ read: currentSearchParams, set: setSearchParams });
  onCleanup(() => setRouterSearch(undefined));
  onError((error) => {
    // A hydration mismatch goes to the island, which renders on the client instead.
    if (error === MISMATCH) handleError(owner.parent, error);
    else fail(r, error, untrack(r.current));
  });
  onCleanup(listen(r));
  onCleanup(
    setClientNavigation({
      clientRouted: true,
      navigate: (href) => navigate(href),
      invalidate,
    }),
  );
  onCleanup(() => {
    supersede(r);
    r.root = undefined;
  });
  // After hydration, outside the island: the announcer is no part of what the server rendered.
  onMount(() => {
    const announcer = createAnnouncer(untrack(r.current).url);
    r.announcer = announcer;
    onCleanup(() => {
      announcer.remove();
      if (r.announcer === announcer) r.announcer = undefined;
    });
  });
  const outlet = createOutlet(0, r.scope);
  r.root = outlet;
  reveal(r);
  return () => outlet.shown().node;
}

/**
 * Shows the document that a `not-found` page hid while the router decides what its URL renders
 * (`rerouteScript()` in ./server.ts), once the first view and what it started (an error page, a
 * redirect) are on screen.
 */
function reveal(r: Router): void {
  const html = document.documentElement;
  if (!html.hasAttribute(REROUTE_ATTR)) return;
  // A level that throws while it is created fails in a microtask (`createOutlet`): after it.
  queueMicrotask(() => {
    let stop: (() => void) | undefined;
    let done = false;
    stop = effect(() => {
      if (r.navigating()) return;
      done = true;
      html.removeAttribute(REROUTE_ATTR);
      html.style.removeProperty("visibility");
      stop?.();
    });
    if (done) stop();
  });
}

// --- Outlets ------------------------------------------------------------------------------------

/**
 * Creates the outlet rendering level `depth` of `scope`'s view, with its first content. Under
 * hydration, the content claims the rest of the server region it renders in.
 */
function createOutlet(depth: number, scope: Scope): Outlet {
  const owner = getOwner();
  const view = untrack(scope.view);
  let content: Content;
  try {
    content = untrack(() => mountLevel(createOwner(owner), depth, scope, view, 3));
  } catch (error) {
    // A level that throws while it is created (`redirect()`, `notFound()`, a bug): the outlet
    // starts empty and the error page (or the redirect) replaces it once the SPA has started.
    content = { file: "", owner: createOwner(owner), node: createRange(), child: undefined };
    queueMicrotask(() => {
      if (router !== undefined) fail(router, error, view);
    });
  }
  if (import.meta.env?.DEV && INSPECTED) {
    const shown = signal(content);
    labelValue(shown, "page", true);
    return { owner, shown };
  }
  return { owner, shown: signal(content) };
}

/** Renders level `depth` of `view` into a new range under `owner`. */
function mountLevel(owner: Owner, depth: number, scope: Scope, view: View, mode?: number): Content {
  const level = view.levels[depth]!;
  const content: Content = {
    file: level.file,
    owner,
    node: undefined as unknown as RangeStart,
    child: undefined,
  };
  const props = levelProps(content, depth, scope, view);
  content.node = runWithOwner(owner, () =>
    renderRange(() => createComponent(level.component, props), mode),
  );
  return content;
}

function levelProps(content: Content, depth: number, scope: Scope, view: View): object {
  if (depth < view.levels.length - 1) {
    return {
      get params() {
        return scope.params();
      },
      get children() {
        content.child ??= createOutlet(depth + 1, scope);
        const outlet = content.child;
        return () => outlet.shown().node;
      },
    };
  }
  if (view.error !== undefined) {
    return {
      get params() {
        return scope.params();
      },
      get status() {
        return scope.view().error?.status;
      },
      get error() {
        return scope.view().error?.error;
      },
    };
  }
  return {
    get params() {
      return scope.params();
    },
  };
}

/**
 * Shows `view`: commits at once when it renders the same levels, else prepares the first level that
 * differs off-screen and commits once its pending content has settled. Resolves on commit, or when
 * a newer navigation supersedes it.
 */
function show(r: Router, view: View, nav: Nav): Promise<void> {
  const shown = untrack(r.current);
  let depth = 0;
  // Another locale renders every level again: content read the old one.
  if (localeOf(r, view.url) === localeOf(r, shown.url)) {
    while (
      depth < view.levels.length &&
      depth < shown.levels.length &&
      levelKey(view.levels[depth]!.file, view.params) ===
        levelKey(shown.levels[depth]!.file, shown.params)
    ) {
      depth++;
    }
  }
  // The outlet that renders the first differing level (none past a layout without `children`).
  let outlet = r.root;
  for (let i = 0; i < depth && outlet !== undefined; i++) outlet = untrack(outlet.shown).child;
  if (depth === view.levels.length || outlet === undefined) {
    batch(() => r.current.set(view));
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    nav.done = resolve;
    prepare(r, outlet, depth, view, nav);
  });
}

/** A level's identity: its file, and the values of the params in its path (`users/[id]/page.tsx`). */
function levelKey(file: string, params: Params): string {
  let key = file;
  for (const [, name] of file.matchAll(/\[\[?(?:\.\.\.)?([^\]]+)\]\]?/g))
    key += `\0${params[name!] ?? ""}`;
  return key;
}

/** The locale of a URL with `lumiose({ i18n })`, else `undefined`. */
function localeOf(r: Router, url: URL): string | undefined {
  const { i18n } = r.config;
  const path = i18n === undefined ? undefined : routePath(url, r.config.base);
  return path === undefined ? undefined : splitLocale(path, i18n!).locale;
}

function prepare(r: Router, outlet: Outlet, depth: number, view: View, nav: Nav): void {
  const owner = createOwner(outlet.owner);
  const committed = signal(false);
  if (import.meta.env?.DEV && INSPECTED) labelValue(committed, "route committed", true);
  const scope = createScope(() => (committed() ? r.current() : view));
  let waiting = 0;
  let created = false;
  let content: Content | undefined;
  let swapping = false;

  const swap = (): void => {
    if (r.active !== nav) return;
    const previous = untrack(outlet.shown);
    batch(() => {
      committed.set(true);
      r.current.set(view);
      outlet.shown.set(content!);
      // The old content goes in the same step as its nodes, before it could render the new view.
      disposeOwner(previous.owner);
    });
    nav.cancel = undefined;
    nav.done?.();
  };
  // With view transitions, the swap waits for the browser to capture the old page.
  const commit = (): void => {
    if (r.active !== nav || swapping) return;
    swapping = true;
    const transition = r.config.viewTransition;
    if (transition === undefined) swap();
    else transition(swap).catch((error: unknown) => fail(r, error, untrack(r.current)));
  };

  (owner.context ??= {})[SUSPENSE] = {
    update(fn) {
      if (committed.peek()) {
        // Shown: new pending content below goes to the boundary above, as usual.
        (lookupContext(outlet.owner, SUSPENSE, undefined) as Boundary | undefined)?.update(fn);
        return;
      }
      waiting = fn(waiting);
      if (waiting === 0 && created) commit();
    },
  } satisfies Boundary;
  owner.context[ROUTE] = scope;
  runWithOwner(owner, () =>
    onError((error) => fail(r, error, committed.peek() ? untrack(r.current) : view)),
  );
  nav.cancel = () => disposeOwner(owner);
  try {
    content = mountLevel(owner, depth, scope, view);
  } catch (error) {
    fail(r, error, view);
    return;
  }
  created = true;
  if (waiting === 0) commit();
}

// --- Navigation ---------------------------------------------------------------------------------

/** Ends the navigation in flight, if any: its prepared content is disposed. */
function supersede(r: Router): void {
  const nav = r.active;
  if (nav === undefined) return;
  r.active = undefined;
  nav.cancel?.();
  nav.done?.();
}

function setNavigating(r: Router, on: boolean): void {
  r.navigating.set(on);
  if (on) r.endBusy ??= beginBusy();
  else {
    r.endBusy?.();
    r.endBusy = undefined;
  }
}

/** Loads and shows what `url` renders. Resolves once it is on screen or superseded. */
async function go(r: Router, url: URL, target: Target): Promise<void> {
  supersede(r);
  const nav: Nav = { cancel: undefined, done: undefined };
  r.active = nav;
  setNavigating(r, true);
  try {
    let levels: Level[];
    try {
      levels = await loadLevels(r, target.levels);
    } catch (error) {
      // A module that does not load (a stale chunk after a deploy): load the page from the server.
      // The URL is already the page's; its hooks ran.
      if (r.active === nav) {
        if (INSTRUMENTED) notify(error, "navigate");
        leaveTo();
        location.reload();
      }
      throw error;
    }
    if (r.active !== nav) return;
    await show(r, createView(r, url, target, levels), nav);
  } finally {
    if (r.active === nav) {
      r.active = undefined;
      setNavigating(r, false);
    }
  }
}

/**
 * Renders the error page for `error` thrown while rendering `view`: the nearest `not-found` (404s) or
 * `error` page inside the SPA, else a built-in one. A thrown `redirect()` navigates instead.
 */
function fail(r: Router, error: unknown, view: View): void {
  if (isRedirect(error)) {
    void navigateTo(navigationUrl(error.location), true, false, true);
    return;
  }
  const status = isHttpError(error) ? error.status : 500;
  if (!isHttpError(error)) console.error(error);
  if (INSTRUMENTED && !isHttpError(error)) {
    notify(error, "navigate", undefined, view.route as Routes | undefined);
  }
  const exposed = error instanceof Error ? error : new Error(String(error));
  const route = view.error === undefined ? targetOf(r, view.url)?.route : undefined;
  const candidates = status === 404 ? [route?.notFound, route?.error] : [route?.error];
  const file = candidates.find((page) => page !== undefined && r.config.pages[page]?.app === r.app);
  supersede(r);
  const nav: Nav = { cancel: undefined, done: undefined };
  r.active = nav;
  setNavigating(r, true);
  void (async () => {
    let next: View;
    try {
      next =
        file === undefined
          ? builtinError(view.url, status, exposed)
          : {
              url: view.url,
              params: view.params,
              levels: await loadLevels(r, r.config.pages[file]!.levels),
              error: { status, error: exposed },
              ...(view.route === undefined ? {} : { route: view.route }),
            };
    } catch {
      next = builtinError(view.url, status, exposed);
    }
    if (r.active !== nav) return;
    if (view.error !== undefined && next.levels.at(-1)!.file === view.levels.at(-1)!.file) {
      // The error page itself failed.
      next = builtinError(view.url, status, exposed);
    }
    await show(r, next, nav);
  })().finally(() => {
    if (r.active === nav) {
      r.active = undefined;
      setNavigating(r, false);
    }
  });
}

/** The page shown when the SPA has no error page for an error: it replaces every level. */
function builtinError(url: URL, status: number, error: Error): View {
  return {
    url,
    params: {},
    levels: [{ file: "", component: BuiltinError }],
    error: { status, error },
  };
}

function BuiltinError(props: { status: number; error: Error }): Renderable {
  const main = document.createElement("main");
  const heading = document.createElement("h1");
  heading.textContent = String(props.status);
  const message = document.createElement("p");
  message.textContent = props.error.message;
  main.append(heading, message);
  return main;
}

export interface NavigateOptions {
  /** Replace the current history entry instead of adding one. */
  replace?: boolean;
}

/**
 * Navigates to `href`: on the client inside this SPA, else with a document navigation. Resolves once
 * the new page is on screen (its async content ready), or when another navigation supersedes it.
 */
export function navigate(href: string | URL, options: NavigateOptions = {}): Promise<void> {
  return navigateTo(navigationUrl(href), options.replace === true, false);
}

/** `redirect`: a thrown `redirect()`, which continues a navigation the hooks already confirmed. */
function navigateTo(
  url: URL,
  replace: boolean,
  keepScroll: boolean,
  redirect = false,
): Promise<void> {
  const r = router;
  const target = r?.root === undefined ? undefined : targetOf(r, url);
  const api = navigationApi();
  if (api !== undefined && r?.root !== undefined) {
    // The `navigate` event runs the hooks (`listen()`), for a document navigation too.
    const result = api.navigate(url.href, {
      history: replace ? "replace" : "auto",
      info: redirect ? REDIRECT : keepScroll ? KEEP_SCROLL : NAVIGATE,
    });
    return target === undefined
      ? Promise.resolve()
      : result.finished.then(
          () => {},
          () => {},
        );
  }
  if (target === undefined) {
    if (r?.root !== undefined) leave(r, "navigate", url, redirect);
    if (replace) location.replace(url.href);
    else location.assign(url.href);
    return Promise.resolve();
  }
  return loadHistory().then((fallback) => {
    // A fragment of the current page: the browser's, as with the Navigation API (no hooks).
    if (
      url.href.includes("#") &&
      url.pathname === location.pathname &&
      url.search === location.search
    ) {
      return fallback.historyFragment(url, replace);
    }
    const navigation = begin(r!, "navigate", url, redirect);
    if (navigation !== undefined) {
      return fallback.historyGo(
        url,
        historyNavigation(r!, url, target, navigation),
        replace ? "replace" : "push",
        keepScroll,
      );
    }
  });
}

// --- Hooks (./hooks.ts) ----------------------------------------------------------------------------

function locationOf(view: View): NavigationTarget {
  return { url: view.url, route: view.route as Routes | undefined, params: view.params };
}

/**
 * Where a navigation to `url` goes: its route and params when the app has a page there (inside the
 * SPA or not), `null` outside the app (another origin, or outside its base).
 */
function locate(r: Router, url: URL): NavigationTarget | null {
  const below = routePath(url, r.config.base);
  if (below === undefined) return null;
  const { i18n } = r.config;
  const match = r.matcher.match(i18n === undefined ? below : splitLocale(below, i18n).path);
  return {
    url,
    route:
      match === null
        ? undefined
        : (formatPattern((match.route as unknown as ClientRoute).segments) as Routes),
    params: match?.params ?? {},
  };
}

function navigationTo(
  r: Router,
  type: RouterNavigation["type"],
  url: URL,
  willUnload: boolean,
): RouterNavigation {
  return { type, from: locationOf(untrack(r.current)), to: locate(r, url), willUnload };
}

/**
 * Starts a client navigation to `url`: runs the `beforeNavigate` hooks (not for a redirect);
 * undefined when one cancelled it.
 */
function begin(
  r: Router,
  type: RouterNavigation["type"],
  url: URL,
  redirect: boolean,
): RouterNavigation | undefined {
  const navigation = navigationTo(r, type, url, false);
  if (!redirect && runBefore(navigation)) return undefined;
  startNavigation(navigation);
  return navigation;
}

/** A navigation to a document outside the SPA starts: its hooks run now (not for a redirect). */
function leave(r: Router, type: RouterNavigation["type"], url: URL, redirect: boolean): void {
  leaveTo(redirect ? undefined : navigationTo(r, type, url, true));
}

/**
 * `navigation` ended: `shown` once its page is on screen with its scroll position and focus set.
 * The announcer reads it, then the `afterNavigate` hooks run.
 */
function settle(r: Router, navigation: RouterNavigation, shown: boolean): void {
  if (shown) r.announcer?.navigated(untrack(r.current).url);
  endNavigation(navigation, shown);
}

function historyNavigation(
  r: Router,
  url: URL,
  target: Target,
  navigation: RouterNavigation | undefined,
): HistoryNavigation {
  return {
    run: () => (INSTRUMENTED ? visit(r, url, target, navigation) : go(r, url, target)),
    done: (shown) => {
      if (navigation !== undefined) settle(r, navigation, shown);
    },
  };
}

/**
 * Instrumented builds: the navigation to `url` inside the `navigate` wrappers of
 * `src/instrumentation.client.ts` (../../dom/instrument.ts).
 */
function visit(
  r: Router,
  url: URL,
  target: Target,
  navigation: RouterNavigation | undefined,
): Promise<void> {
  if (navigation === undefined) return go(r, url, target);
  const { type, from, to } = navigation;
  return instrument("navigate", { type: type as "link", from, to }, () => go(r, url, target));
}

// --- Navigation API and History fallback ---------------------------------------------------------

interface NavigateEventLike extends Event {
  canIntercept: boolean;
  hashChange: boolean;
  downloadRequest: string | null;
  formData: FormData | null;
  navigationType: "push" | "replace" | "reload" | "traverse";
  destination: { url: string };
  info: unknown;
  intercept(options: {
    handler: () => Promise<void>;
    scroll?: "after-transition" | "manual";
    focusReset?: "after-transition" | "manual";
  }): void;
}

interface NavigationLike extends EventTarget {
  navigate(
    url: string,
    options: { history: "auto" | "replace"; info?: unknown },
  ): { finished: Promise<unknown> };
  traverseTo(key: string, options: { info: unknown }): unknown;
  currentEntry: { key: string } | null;
  transition: { finished: Promise<unknown> } | null;
}

function navigationApi(): NavigationLike | undefined {
  return (globalThis as { navigation?: NavigationLike }).navigation;
}

/** Starts intercepting navigations; returns the function that stops. */
function listen(r: Router): () => void {
  const api = navigationApi();
  if (api !== undefined) {
    const onNavigate = (event: Event): void => {
      const e = event as NavigateEventLike;
      const info = e.info;
      if (info === RESTORE) {
        // Back to the entry a cancelled back/forward left: the page never changed.
        e.intercept({ scroll: "manual", focusReset: "manual", handler: async () => {} });
        return;
      }
      if (
        e.hashChange ||
        e.downloadRequest !== null ||
        e.formData !== null ||
        e.navigationType === "reload"
      ) {
        return;
      }
      const url = new URL(e.destination.url);
      const target = e.canIntercept ? targetOf(r, url) : undefined;
      const traverse = e.navigationType === "traverse";
      const type = traverse ? "popstate" : info === undefined ? "link" : "navigate";
      if (target === undefined) {
        leave(r, type, url, info === REDIRECT);
        return;
      }
      const navigation = begin(r, type, url, info === REDIRECT);
      if (navigation === undefined) {
        if (e.cancelable) e.preventDefault();
        else if (traverse) {
          // The browser does not let it be cancelled: it happens, then goes back.
          const key = api.currentEntry!.key;
          e.intercept({
            scroll: "manual",
            focusReset: "manual",
            handler: async () => {
              api.traverseTo(key, { info: RESTORE });
            },
          });
        }
        return;
      }
      const keep = info === KEEP_SCROLL;
      e.intercept({
        scroll: keep ? "manual" : "after-transition",
        focusReset: keep ? "manual" : "after-transition",
        handler: () => {
          const shown = INSTRUMENTED ? visit(r, url, target, navigation) : go(r, url, target);
          // Settles after the scroll restoration and focus reset that follow the handler.
          (api.transition?.finished ?? shown).then(
            () => settle(r, navigation, true),
            () => settle(r, navigation, false),
          );
          return shown;
        },
      });
    };
    api.addEventListener("navigate", onNavigate);
    return () => api.removeEventListener("navigate", onNavigate);
  }

  // The History API fallback, loaded only here.
  let stop: (() => void) | undefined;
  let stopped = false;
  void loadHistory().then((fallback) => {
    if (!stopped) stop = fallback.listenHistory((url, type) => routeOf(r, url, type));
  });
  return () => {
    stopped = true;
    stop?.();
  };
}

/** The History API fallback (./history.ts), for browsers without the Navigation API. */
let historyModule: Promise<typeof import("./history.ts")> | undefined;
const loadHistory = (): Promise<typeof import("./history.ts")> =>
  (historyModule ??= import("./history.ts"));

/**
 * The fallback's view of a link click or back/forward to `url`: the navigation that shows it, if
 * the SPA owns it (`null` when a hook cancelled it). A move between fragments of one page (the
 * browser's fragment navigations, back/forward that only changes the hash) is not a navigation for
 * the hooks.
 */
function routeOf(
  r: Router,
  url: URL,
  type: "link" | "popstate",
): HistoryNavigation | null | undefined {
  const target = targetOf(r, url);
  if (target === undefined) {
    leave(r, type, url, false);
    return undefined;
  }
  const shown = untrack(r.current).url;
  const hash =
    url.pathname === shown.pathname &&
    url.search === shown.search &&
    (url.href.includes("#") || shown.href.includes("#"));
  const navigation = hash ? undefined : begin(r, type, url, false);
  return hash || navigation !== undefined ? historyNavigation(r, url, target, navigation) : null;
}

// --- Public API ---------------------------------------------------------------------------------

/** The scope that content created now reads: its view's, else the committed one. */
function scopeOf(api: string): Scope {
  const found = readContext(ROUTE, undefined) as Scope | undefined;
  if (found !== undefined) return found;
  if (router?.root !== undefined) return router.scope;
  throw new Error(
    DEV
      ? `${api} from lumiose/router works inside spa routes (export const mode = "spa"). Islands of other routes receive what they need as props.`
      : `${api} works inside spa routes.`,
  );
}

/** `params()` of lumiose/router. */
export function currentParams(): Params {
  return scopeOf("params()").params();
}

/** `url()` of lumiose/router. */
export function currentUrl(): URL {
  return scopeOf("url()").url();
}

/**
 * `locale()` of lumiose/router inside the SPA: the locale of the URL content reads (reactive);
 * `undefined` outside the SPA (an MPA island) or without `lumiose({ i18n })`.
 */
export function routerLocale(): string | undefined {
  const r = router;
  if (r?.config.i18n === undefined) return undefined;
  const found = readContext(ROUTE, undefined) as Scope | undefined;
  if (found !== undefined) return localeOf(r, found.url());
  return r.root === undefined ? undefined : localeOf(r, r.scope.url());
}

/** `route()` of lumiose/router. */
export function currentRoute(): string | undefined {
  return scopeOf("route()").route();
}

/** `searchParams()` of lumiose/router. */
export function currentSearchParams(): URLSearchParams {
  return scopeOf("searchParams()").searchParams();
}

/** Whether a navigation is in flight (decision-20; also counted by `isBusy()`). */
export function isNavigating(): boolean {
  return router?.navigating() ?? false;
}

export type { SearchParamsInit };

/** Replaces the query of the current URL, keeping the scroll position. */
export function setSearchParams(
  next: SearchParamsInit | ((current: URLSearchParams) => SearchParamsInit),
  options: NavigateOptions = {},
): Promise<void> {
  const current = new URL(location.href);
  const value = typeof next === "function" ? next(new URLSearchParams(current.search)) : next;
  current.search = searchString(value);
  return navigateTo(current, options.replace === true, true);
}

/**
 * Re-runs the async components (and resources) of the SPA, which keep their UI until the new run
 * resolves. Resolves once nothing is in flight anymore (`isBusy()` is false).
 */
export function invalidate(): Promise<void> {
  const r = router;
  if (r === undefined) return Promise.resolve();
  r.revision.update((n) => n + 1);
  return new Promise<void>((resolve) => {
    let stop: (() => void) | undefined;
    let idle = false;
    stop = effect(() => {
      if (!isBusy()) {
        idle = true;
        stop?.();
        resolve();
      }
    });
    if (idle) stop();
  });
}

/** Whether `href` is the current URL's path (`<Link>`'s `aria-current="page"`). Reactive. */
export function isCurrent(href: string): boolean {
  const found =
    (readContext(ROUTE, undefined) as Scope | undefined) ??
    (router?.root === undefined ? undefined : router.scope);
  const current = found === undefined ? new URL(location.href) : found.url();
  const target = new URL(href, current);
  return (
    target.origin === current.origin && trimSlash(target.pathname) === trimSlash(current.pathname)
  );
}

function trimSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/** For tests: forgets the router. */
export function resetRouter(): void {
  router = undefined;
  setRouterSearch(undefined);
}
