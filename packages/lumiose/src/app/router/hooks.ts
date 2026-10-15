// `beforeNavigate` and `afterNavigate` of `lumiose/router` (decision-50, TASK-296; owner: Spark):
// SvelteKit's names and semantics. Apart from ./router.ts, so islands on MPA pages that use them
// ship none of the router: there, `beforeNavigate` sees only `"leave"` (a `beforeunload` listener,
// added while a hook is registered) and `afterNavigate` fires once with `"enter"`. Inside an SPA the
// router runs them around its navigations (`runBefore`, `startNavigation`, `endNavigation`) and
// tells them the committed location (`setRouterLocation`).
import { onMount } from "../../core/effect.ts";
import { getOwner, onCleanup } from "../../core/owner.ts";
import { DEV } from "../../dom/dev.ts";
import type { Routes } from "../routes/registry.ts";
import type { RouteParamValues } from "../server/context.ts";

/**
 * What started a navigation: a link click, `navigate()` or `searchParams.set()`, back/forward, or
 * leaving the document (another document, closing the tab, a reload). `"enter"` is the mount of
 * the component that registered an `afterNavigate` hook.
 */
export type NavigationType = "link" | "navigate" | "popstate" | "leave" | "enter";

/** A location a navigation leaves or reaches. */
export interface NavigationTarget {
  url: URL;
  /** The matched route pattern (`/songs/[id]`); undefined when none matched or it is unknown. */
  route: Routes | undefined;
  params: RouteParamValues;
}

interface NavigationBase {
  /** Where it starts; `null` for `"enter"`. */
  from: NavigationTarget | null;
  /** Where it goes; `null` when the next document is outside the app (`"leave"`, another origin). */
  to: NavigationTarget | null;
  /** Whether the document unloads: the navigation is not a client-side one. */
  willUnload: boolean;
}

/** The navigation a `beforeNavigate` hook receives. */
export interface BeforeNavigate extends NavigationBase {
  type: Exclude<NavigationType, "enter">;
  /**
   * Stops it. Back/forward the browser cannot cancel returns to the entry it left; for a
   * navigation that unloads the document (`willUnload`), the browser asks the user instead.
   */
  cancel(): void;
}

/** The navigation an `afterNavigate` hook receives. */
export interface AfterNavigate extends NavigationBase {
  type: Exclude<NavigationType, "leave">;
}

/** A navigation of the SPA router, as its hooks receive it (`cancel()` aside). */
export type RouterNavigation = Omit<AfterNavigate, "type"> & { type: BeforeNavigate["type"] };

const befores = new Set<(navigation: BeforeNavigate) => void>();
const afters = new Set<(navigation: AfterNavigate) => void>();

/** The router's committed location, while an SPA runs. */
let routerLocation: (() => NavigationTarget) | undefined;
/** The SPA navigation in progress: components it creates get its `afterNavigate`, not `"enter"`. */
let pending: RouterNavigation | undefined;
/**
 * The hooks of the document navigation in progress already ran (a link out of the SPA): 1 when
 * none cancelled it, 2 when one did, so that `beforeunload` makes the browser ask.
 */
let unloading = 0;

/** Called by the router when it starts and stops. */
export function setRouterLocation(location: (() => NavigationTarget) | undefined): void {
  routerLocation = location;
}

function here(): NavigationTarget {
  return routerLocation?.() ?? { url: new URL(location.href), route: undefined, params: {} };
}

function register<T>(hooks: Set<T>, hook: T, api: string): void {
  if (DEV && getOwner() === undefined) {
    throw new Error(
      `${api} from lumiose/router registers a hook for the component calling it: call it during component setup.`,
    );
  }
  hooks.add(hook);
  onCleanup(() => {
    hooks.delete(hook);
    if (befores.size === 0) removeEventListener("beforeunload", onBeforeUnload);
  });
}

/**
 * Runs `fn` before each navigation away from the current location, while the calling component is
 * mounted: links and `navigate()` inside the SPA, back/forward, and leaving the document.
 * `navigation.cancel()` stops it.
 */
export function beforeNavigate(fn: (navigation: BeforeNavigate) => void): void {
  register(befores, (navigation: BeforeNavigate) => fn(navigation), "beforeNavigate()");
  if (befores.size === 1) addEventListener("beforeunload", onBeforeUnload);
}

/**
 * Runs `fn` after each navigation, once the new page is on screen with its scroll position and
 * focus set, while the calling component is mounted; and once when it mounts, with `"enter"`
 * (unless a navigation created it: then that navigation's call is its first).
 */
export function afterNavigate(fn: (navigation: AfterNavigate) => void): void {
  const hook = (navigation: AfterNavigate): void => fn(navigation);
  register(afters, hook, "afterNavigate()");
  if (pending === undefined) {
    onMount(() => hook({ type: "enter", from: null, to: here(), willUnload: false }));
  }
}

/** Runs the `beforeNavigate` hooks; returns whether one cancelled the navigation. */
export function runBefore(navigation: RouterNavigation): boolean {
  let cancelled = false;
  // A document navigation that did not happen after all (another listener prevented the click).
  unloading = 0;
  const event: BeforeNavigate = {
    ...navigation,
    cancel: () => {
      cancelled = true;
    },
  };
  // A copy: hooks that a hook registers or removes wait for the next navigation.
  for (const hook of Array.from(befores)) hook(event);
  return cancelled;
}

/**
 * A document navigation is starting (a link out of the SPA, `navigate()` to another document):
 * runs the hooks now, with the destination; `beforeunload` then makes the browser ask if one
 * cancelled, instead of running them again as `"leave"`. Without `navigation`, the router reloads
 * on its own (a module that did not load) and no hook runs.
 */
export function leaveTo(navigation?: RouterNavigation): void {
  unloading = navigation !== undefined && runBefore(navigation) ? 2 : 1;
}

function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (
    unloading === 2 ||
    (unloading === 0 && runBefore({ type: "leave", from: here(), to: null, willUnload: true }))
  ) {
    event.preventDefault();
  }
  unloading = 0;
}

/** The router starts `navigation` (its `beforeNavigate` hooks passed). */
export function startNavigation(navigation: RouterNavigation): void {
  pending = navigation;
}

/**
 * `navigation` ended: `shown` once its page is on screen with its scroll position and focus set
 * (the `afterNavigate` hooks run), else superseded or aborted.
 */
export function endNavigation(navigation: RouterNavigation, shown: boolean): void {
  if (pending === navigation) pending = undefined;
  if (shown) for (const hook of Array.from(afters)) hook(navigation as AfterNavigate);
}
