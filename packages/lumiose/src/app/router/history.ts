// History API fallback of the client router (owner: Spark): link clicks, back/forward, scroll
// restoration and focus reset in browsers without the Navigation API. ./router.ts loads it only
// there, so browsers with the Navigation API never download it.
//
// Each entry the fallback creates stores a key (for its scroll position) and its index in the
// session history in `history.state`: `popstate` cannot be cancelled, so a back/forward that a
// `beforeNavigate` hook cancels goes back by the difference (decision-50).
//
// Fragment navigations (a link to a `#hash` of the page, `navigate()` to one, `location.hash`)
// are the browser's, as with the Navigation API (TASK-350): it adds or replaces the entry, fires
// `popstate` (with a null state), then scrolls to the fragment. That `popstate` only commits the URL
// and gives the new entry its key.

/**
 * A navigation of the router: `run` loads and shows its page (resolves once it is on screen or
 * superseded); `done` hears whether it ended on screen, with its scroll position and focus set.
 */
export interface HistoryNavigation {
  run(): Promise<void>;
  done(shown: boolean): void;
}

/**
 * What the router does for a link click or back/forward to a URL: `undefined` when the SPA does
 * not own it (a document navigation), `null` when a `beforeNavigate` hook cancelled it, else the
 * navigation.
 */
export type Route = (url: URL, type: "link" | "popstate") => HistoryNavigation | null | undefined;

type NavigationKind = "push" | "replace" | "traverse";

/** `history.state` keys of an entry: its key, for scroll restoration, and its index. */
const KEY = "lumiose:key";
const INDEX = "lumiose:index";

type EntryState = Record<string, unknown> | null;

/** The current entry and the scroll positions of history entries, while the fallback runs. */
let state:
  | {
      key: string;
      /** Undefined after back/forward to an entry the fallback did not create. */
      index: number | undefined;
      href: string;
      /** `history.length` on the current entry: a fragment navigation that grows it added an entry. */
      length: number;
      positions: Map<string, [number, number]>;
    }
  | undefined;

/** The fragment navigation `historyFragment()` starts replaces the current entry. */
let replacing = false;
/** The navigation that the latest `popstate` started. */
let traversal: Promise<void> | undefined;

function newKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function save(): void {
  state?.positions.set(state.key, [scrollX, scrollY]);
}

function enter(key: string, index: number | undefined, href: string): void {
  if (state !== undefined) {
    state.key = key;
    state.index = index;
    state.href = href;
    state.length = history.length;
  }
}

/** Starts intercepting link clicks and back/forward; returns the function that stops. */
export function listenHistory(route: Route): () => void {
  const first = history.state as EntryState;
  const firstKey = (first?.[KEY] as string | undefined) ?? newKey();
  // The document's first entry: its own entries count from it.
  const firstIndex = (first?.[INDEX] as number | undefined) ?? 0;
  history.replaceState({ ...first, [KEY]: firstKey, [INDEX]: firstIndex }, "");
  const restoration = history.scrollRestoration;
  history.scrollRestoration = "manual";
  state = {
    key: firstKey,
    index: firstIndex,
    href: location.href,
    length: history.length,
    positions: new Map(),
  };
  const current = state;
  /** A cancelled back/forward is on its way back to the entry it left. */
  let restoring = false;

  const onClick = (event: MouseEvent): void => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const link = (event.target as Element | null)?.closest?.("a");
    if (
      !(link instanceof HTMLAnchorElement) ||
      link.href === "" ||
      (link.target !== "" && link.target !== "_self") ||
      link.hasAttribute("download")
    ) {
      return;
    }
    const url = new URL(link.href);
    // A fragment of this page (`#`, the same one included): the browser's.
    if (
      url.href.includes("#") &&
      url.pathname === location.pathname &&
      url.search === location.search
    ) {
      return;
    }
    const navigation = route(url, "link");
    if (navigation === undefined) return;
    event.preventDefault();
    if (navigation !== null) {
      void historyGo(url, navigation, url.href === location.href ? "replace" : "push", false);
    }
  };
  const onPopState = (): void => {
    if (restoring) {
      restoring = false;
      return;
    }
    const entry = history.state as EntryState;
    const index = entry?.[INDEX] as number | undefined;
    const url = new URL(location.href);
    const navigation = route(url, "popstate");
    if (navigation === null) {
      // Cancelled after the browser moved: back to the entry it left.
      if (index !== undefined && current.index !== undefined && index !== current.index) {
        restoring = true;
        history.go(current.index - index);
      } else {
        history.pushState({ [KEY]: current.key }, "", current.href);
        current.index = undefined;
      }
      return;
    }
    save();
    let key = entry?.[KEY] as string | undefined;
    // Back/forward between entries of one page (only the hash differs) keeps focus, as browsers do.
    const from = new URL(current.href);
    const samePage = url.pathname === from.pathname && url.search === from.search;
    // A fragment navigation: its entry has no key yet, and the browser scrolls once this returns.
    const fragment = samePage && key === undefined;
    let next = index;
    if (fragment) {
      // Its index: the current one when it replaced the entry, the next one when it added an entry
      // at the end (`history.length` grew), else unknown (an entry of the page before the fallback
      // started, or one added after going back).
      next =
        current.index === undefined
          ? undefined
          : replacing || url.href === current.href
            ? current.index
            : history.length > current.length
              ? current.index + 1
              : undefined;
      key = newKey();
      history.replaceState({ ...entry, [KEY]: key, [INDEX]: next }, "");
    }
    enter(key ?? newKey(), next, url.href);
    if (navigation === undefined) {
      location.reload();
      return;
    }
    traversal = historyGo(url, navigation, "traverse", fragment, key, samePage);
  };
  addEventListener("click", onClick);
  addEventListener("popstate", onPopState);
  return () => {
    removeEventListener("click", onClick);
    removeEventListener("popstate", onPopState);
    history.scrollRestoration = restoration;
    state = undefined;
  };
}

/**
 * Goes to `url`, a fragment of the current page: the browser's, as with the Navigation API. It adds
 * (or replaces) the entry, keeps focus and scrolls to the fragment; its `popstate` commits the URL.
 * Resolves once committed.
 */
export function historyFragment(url: URL, replace: boolean): Promise<void> {
  traversal = undefined;
  replacing = replace;
  try {
    if (replace) location.replace(url.href);
    else location.assign(url.href);
  } finally {
    replacing = false;
  }
  return traversal ?? Promise.resolve();
}

/**
 * Updates the history entry for `url`, runs the navigation, then scrolls and resets focus, as the
 * Navigation API's `scroll` and `focusReset: "after-transition"` do; `keepScroll` keeps both, like
 * their `"manual"` (for a fragment navigation, the browser scrolls).
 */
export async function historyGo(
  url: URL,
  navigation: HistoryNavigation,
  kind: NavigationKind,
  keepScroll: boolean,
  entry?: string,
  keepFocus = keepScroll,
): Promise<void> {
  if (kind !== "traverse") {
    save();
    const key = newKey();
    const from = state?.index;
    const index = from === undefined ? undefined : kind === "push" ? from + 1 : from;
    const next = { [KEY]: key, [INDEX]: index };
    if (kind === "push") history.pushState(next, "", url.href);
    else history.replaceState(next, "", url.href);
    enter(key, index, url.href);
  }
  // Focus the new page moved while it loaded (an input it focused) stays, as with the Navigation API.
  let focused = false;
  const onFocus = (): void => {
    focused = true;
  };
  document.addEventListener("focusin", onFocus);
  await navigation.run().catch(() => {});
  document.removeEventListener("focusin", onFocus);
  // Only the navigation still current when it commits scrolls and moves focus.
  if (location.href !== url.href) {
    navigation.done(false);
    return;
  }
  if (!keepScroll) {
    if (kind === "traverse") {
      const [x, y] = (entry === undefined ? undefined : state?.positions.get(entry)) ?? [0, 0];
      scrollTo(x, y);
    } else {
      const id = decodeURIComponent(url.hash.slice(1));
      const anchor = id === "" ? null : document.getElementById(id);
      if (anchor !== null) anchor.scrollIntoView();
      else scrollTo(0, 0);
    }
  }
  if (!keepFocus && !focused) resetFocus();
  navigation.done(true);
}

/**
 * The Navigation API's focus reset: the first focusable `[autofocus]` element, else the body. Focusing
 * the body (focusable for a moment) also moves the sequential focus navigation starting point to the
 * top, so Tab goes to the page's first focusable element (a skip link), as after a document load; a
 * `blur()` would leave it at the link that was clicked.
 */
function resetFocus(): void {
  const options = { preventScroll: true, focusVisible: false };
  for (const element of document.querySelectorAll<HTMLElement>("[autofocus]")) {
    element.focus(options);
    if (document.activeElement === element) return;
  }
  const body = document.body;
  const tabindex = body.getAttribute("tabindex");
  body.tabIndex = -1;
  body.focus(options);
  if (tabindex === null) body.removeAttribute("tabindex");
  else body.setAttribute("tabindex", tabindex);
}
