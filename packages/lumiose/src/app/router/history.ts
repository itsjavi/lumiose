// History API fallback of the client router (owner: Spark): link clicks, back/forward, scroll
// restoration and focus reset in browsers without the Navigation API. ./router.ts loads it only
// there, so browsers with the Navigation API never download it.

/**
 * What the router does for a URL: `undefined` when the SPA does not own it (a document
 * navigation), else the function that loads and shows it (resolves once it is on screen).
 */
export type Route = (url: URL) => (() => Promise<void>) | undefined;

type NavigationKind = "push" | "replace" | "traverse";

/** `history.state` key of an entry, for scroll restoration. */
const KEY = "lumiose:key";

/** Scroll positions of history entries, while the fallback runs. */
let state:
  | {
      save(): void;
      enter(key: string): void;
      position(key: string): [number, number] | undefined;
    }
  | undefined;

const entryKey = (): string | undefined =>
  (history.state as Record<string, unknown> | null)?.[KEY] as string | undefined;

function newKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Starts intercepting link clicks and back/forward; returns the function that stops. */
export function listenHistory(route: Route): () => void {
  const positions = new Map<string, [number, number]>();
  let key = entryKey();
  if (key === undefined) {
    key = newKey();
    history.replaceState({ ...(history.state as object | null), [KEY]: key }, "");
  }
  const restoration = history.scrollRestoration;
  history.scrollRestoration = "manual";
  state = {
    save() {
      positions.set(key!, [scrollX, scrollY]);
    },
    enter(next) {
      key = next;
    },
    position: (entry) => positions.get(entry),
  };

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
    // An in-page anchor: the browser scrolls to it.
    if (url.hash !== "" && url.pathname === location.pathname && url.search === location.search) {
      return;
    }
    const run = route(url);
    if (run === undefined) return;
    event.preventDefault();
    void historyGo(url, run, url.href === location.href ? "replace" : "push", false);
  };
  const onPopState = (): void => {
    state?.save();
    const entry = entryKey();
    state?.enter(entry ?? newKey());
    const url = new URL(location.href);
    const run = route(url);
    if (run === undefined) {
      location.reload();
      return;
    }
    void historyGo(url, run, "traverse", false, entry);
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

/** Updates the history entry for `url`, runs the navigation, then scrolls and resets focus. */
export async function historyGo(
  url: URL,
  run: () => Promise<void>,
  kind: NavigationKind,
  keepScroll: boolean,
  entry?: string,
): Promise<void> {
  if (kind !== "traverse") {
    state?.save();
    const key = newKey();
    const next = { [KEY]: key };
    if (kind === "push") history.pushState(next, "", url.href);
    else history.replaceState(next, "", url.href);
    state?.enter(key);
  }
  await run().catch(() => {});
  // Only the navigation still current when it commits scrolls and moves focus.
  if (location.href !== url.href) return;
  if (kind === "traverse") {
    const [x, y] = (entry === undefined ? undefined : state?.position(entry)) ?? [0, 0];
    scrollTo(x, y);
  } else if (!keepScroll) {
    const id = decodeURIComponent(url.hash.slice(1));
    const anchor = id === "" ? null : document.getElementById(id);
    if (anchor !== null) anchor.scrollIntoView();
    else scrollTo(0, 0);
  }
  if (!keepScroll) resetFocus();
}

/** Like the Navigation API's focus reset: the first `autofocus` element, else the body. */
function resetFocus(): void {
  const autofocus = document.querySelector<HTMLElement>("[autofocus]");
  if (autofocus !== null) {
    autofocus.focus();
  } else {
    (document.activeElement as HTMLElement | null)?.blur?.();
  }
}
