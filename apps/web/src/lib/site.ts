// Site-wide constants and the base path. The site may be served below a path (GitHub Pages:
// `LUMEN_BASE=/lumen/`), and `href()` builds root-relative paths, so every internal URL goes
// through `link()`.
import type { FooterColumn, NavLink } from "@lumen/site-kit";

/** Vite's `base`, always with a trailing slash ("/" or "/lumen/"). */
export const BASE = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

/** A site path (`/docs/concepts/signals`, `#top` and external URLs pass through) below the base. */
export function link(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  return BASE + path.slice(1);
}

/** A request path without the base: `/lumen/docs/x` → `/docs/x`. */
export function sitePath(pathname: string): string {
  return pathname.startsWith(BASE) ? `/${pathname.slice(BASE.length)}` : pathname;
}

export const site = {
  name: "Lumen",
  tagline: "Signals, islands and scoped styles, compiled. Light by default.",
  description:
    "Lumen is a TypeScript 7-first web framework: .stsx components (TSX plus plain CSS), fine-grained signals without a virtual DOM, and server-first rendering with islands.",
};

export const navLinks: NavLink[] = [
  { href: link("/docs"), label: "Docs" },
  { href: link("/playground"), label: "Playground" },
];

export const footerColumns: FooterColumn[] = [
  {
    title: "Learn",
    links: [
      { href: link("/docs/getting-started"), label: "Getting started" },
      { href: link("/docs/concepts/components"), label: "Components" },
      { href: link("/docs/concepts/styles"), label: "Styles" },
      { href: link("/docs/concepts/islands"), label: "Islands" },
    ],
  },
  {
    title: "Reference",
    links: [
      { href: link("/docs/reference/cli"), label: "CLI" },
      { href: link("/docs/reference/vite"), label: "lumen/vite" },
      { href: link("/docs/errors"), label: "Diagnostics" },
    ],
  },
  {
    title: "For agents",
    links: [
      { href: link("/llms.txt"), label: "llms.txt" },
      { href: link("/llms-full.txt"), label: "llms-full.txt" },
      { href: link("/playground"), label: "Playground" },
    ],
  },
];
