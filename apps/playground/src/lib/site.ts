// The playground's URLs. It is served at `<site>playground/` (vite.config.ts), so links to the rest
// of the website go through `siteLink()`, and its own files through `BASE`.
import { siteFooterColumns, siteLinks, type FooterColumn, type NavLink } from "@lumiose/site-kit";

/** The playground's base URL, with a trailing slash (`/playground/`, `/lumiose/playground/`). */
export const BASE = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

/** The website's base URL: the playground's without `playground/`. */
export const SITE = BASE.replace(/playground\/$/, "");

/** A site path (`/docs`) below the site's base; other URLs pass through. */
export function siteLink(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  return SITE + path.slice(1);
}

/** The docs page of a diagnostic's docs topic (`errors/LUM2001` or `diagnostics/LUM2001`). */
export function docsLink(topic: string): string {
  return siteLink(`/docs/${topic.replace(/^diagnostics\//, "errors/")}`);
}

export const navLinks: NavLink[] = siteLinks.map((link) => ({
  ...link,
  href: siteLink(link.href),
}));

export const footerColumns: FooterColumn[] = siteFooterColumns.map((column) => ({
  ...column,
  links: column.links.map((link) => ({ ...link, href: siteLink(link.href) })),
}));

/** The source repository. */
export const REPOSITORY = "https://github.com/itsjavi/lumiose";
