// The link a click follows (owner: Spark): shared by the History API fallback (./history.ts) and
// the `beforeNavigate` link reports of MPA pages (./hooks.ts), which must agree on what a plain
// link click is.

/**
 * The URL of the `<a href>` that `event` makes the browser load in this tab, or undefined when the
 * click is left to the browser: it was prevented, used another button or a modifier key (a new
 * tab or window, a download), or the link opens elsewhere (`target`), downloads (`download`) or
 * only moves to a fragment of the current page.
 */
export function followedLink(event: MouseEvent): URL | undefined {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return undefined;
  }
  const link = (event.target as Element | null)?.closest?.("a");
  if (
    !(link instanceof HTMLAnchorElement) ||
    link.href === "" ||
    (link.target !== "" && link.target !== "_self") ||
    link.hasAttribute("download")
  ) {
    return undefined;
  }
  const url = new URL(link.href);
  // A fragment of this page (`#`, the same one included): the browser's.
  return url.href.includes("#") &&
    url.pathname === location.pathname &&
    url.search === location.search
    ? undefined
    : url;
}
