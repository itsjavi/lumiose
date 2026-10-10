// How `submit()` redirects and `invalidate()` refreshes (spec §8 Actions): a full page load, unless
// the SPA router (TASK-25) installs its hooks. Apart from ./client.ts so that the router installs
// them without bundling the form helpers (TASK-91).

/** How `submit()` redirects and `invalidate()` refresh. The SPA router replaces the MPA default. */
export interface ClientNavigation {
  /**
   * Whether pages are client-routed, so that `invalidate()` re-runs async components without a
   * reload. Only then does a successful `submit()` invalidate on its own (decision-20 amendment).
   */
  clientRouted: boolean;
  navigate(href: string): void | Promise<void>;
  invalidate(): void | Promise<void>;
}

export let navigation: ClientNavigation = {
  clientRouted: false,
  navigate: (href) => location.assign(navigationUrl(href)),
  // The page is going away: the promise never settles, so nothing waiting on it (an optimistic
  // overlay held until the refresh, TASK-196) acts on the old page before it unloads.
  invalidate: () => {
    location.reload();
    return new Promise(() => {});
  },
};

/**
 * `href` resolved against the document, for a navigation: only `http:` and `https:` URLs (relative
 * ones included) navigate. Anything else, such as a `javascript:` URL from a redirect, throws a
 * `TypeError` instead of running in the page.
 */
export function navigationUrl(href: string | URL): URL {
  const url = new URL(href, document.baseURI);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError(
      `Refusing to navigate to a ${url.protocol} URL: only http(s) URLs navigate.`,
    );
  }
  return url;
}

/** Installs navigation hooks (the SPA router does, TASK-25). Returns a function that undoes it. */
export function setClientNavigation(hooks: ClientNavigation): () => void {
  const previous = navigation;
  navigation = hooks;
  return () => {
    navigation = previous;
  };
}
