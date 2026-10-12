// The `hreflang` alternates and canonical of SPA views (decision-44, TASK-263; owner: Spark). The
// server writes a `<link rel="alternate" hreflang>` per locale and a `<link rel="canonical">` to the
// page's own locale for a page that declares more than one locale, the canonical unless the page or
// a layout renders its own. After each navigation the router does the same for the committed view,
// with `location.origin`: it removes the links it manages and writes the view's. At start it
// manages the server's links: the alternates of the configured locales, and the canonical whose
// path is the first view's own (a page's own canonical has another).
//
// The SPA entry passes it to the router (`SpaConfig.followLocaleLinks`) only with
// `lumiose({ i18n })`, so SPAs without locales leave this module out.
import { effect } from "../../core/effect.ts";
import { localizePath, splitLocale, type I18nUrls } from "../i18n/config.ts";
import { appPath, envTrailingSlash } from "../routes/href.ts";
import type { View } from "./router.ts";

/** A link's properties, for `Object.assign()` on a `<link>`. */
interface Link {
  rel: string;
  hreflang?: string;
  href: string;
}

/** Keeps the links of the committed view (`current()`) in `<head>`, from the server's. */
export function followLocaleLinks(i18n: I18nUrls, base: string, current: () => View): void {
  let links: Element[] | undefined;
  let written = "[]";
  effect(() => {
    const next = linksOf(i18n, base, current());
    const key = JSON.stringify(next);
    if (links === undefined) {
      // The first view is the server's: its links are in `<head>` already, unless the server
      // rendered another page there (a `not-found` page the router reroutes, ./table.ts).
      const own = next.at(-1)?.href;
      links = Array.from(
        document.head.querySelectorAll<HTMLLinkElement>("link[hreflang],link[rel=canonical]"),
      ).filter((el) =>
        el.hreflang
          ? i18n.locales.includes(el.hreflang)
          : own !== undefined && new URL(el.href).pathname === new URL(own).pathname,
      );
      if (links.length > 0) written = key;
    }
    if (key === written) return;
    written = key;
    for (const el of links) el.remove();
    // A canonical the new page renders with `<Head>` replaces Lumiose's, as on the server.
    const own = document.head.querySelector("link[rel=canonical]");
    links = next
      .filter((link) => link.hreflang || !own)
      .map((link) =>
        document.head.appendChild(Object.assign(document.createElement("link"), link)),
      );
  });
}

/**
 * The links of `view`, the canonical last: none for a page that declares fewer than two locales,
 * or an error page. The paths are the view's URL in each locale, in the form `href()` gives them
 * (`trailingSlash`), like the server's.
 */
function linksOf(i18n: I18nUrls, base: string, view: View): Link[] {
  const locales = view.error ? undefined : view.locales;
  if (!locales || locales.length < 2) return [];
  // The router commits views below `base` only.
  const { locale, path } = splitLocale(view.url.pathname.slice(base.length - 1) || "/", i18n);
  const bare = path.replace(/(.)\/$/, "$1");
  const slash = envTrailingSlash() === "always";
  const href = (each: string) =>
    location.origin + appPath(localizePath(bare, each, i18n), base, slash);
  return [
    ...locales.map((hreflang) => ({ rel: "alternate", hreflang, href: href(hreflang) })),
    { rel: "canonical", href: href(locale) },
  ];
}
