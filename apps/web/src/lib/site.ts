// Site-wide constants and the base path. The site may be served below a path (GitHub Pages:
// `LUMEN_BASE=/lumen/`): route URLs come from `href()`, which adds the base; other site URLs
// (public files, the playground app) go through `link()`.
import type { FooterColumn, NavLink } from "@lumen/site-kit";
import { href } from "lumen";

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
  { href: href("/docs/[...path]", { path: "" }), label: "Docs" },
  { href: link("/playground"), label: "Playground" },
];

export const footerColumns: FooterColumn[] = [
  {
    title: "Learn",
    links: [
      { href: href("/docs/[...path]", { path: "getting-started" }), label: "Getting started" },
      { href: href("/docs/[...path]", { path: "concepts/components" }), label: "Components" },
      { href: href("/docs/[...path]", { path: "concepts/styles" }), label: "Styles" },
      { href: href("/docs/[...path]", { path: "concepts/islands" }), label: "Islands" },
    ],
  },
  {
    title: "Reference",
    links: [
      { href: href("/docs/[...path]", { path: "reference/cli" }), label: "CLI" },
      { href: href("/docs/[...path]", { path: "reference/vite" }), label: "lumen/vite" },
      { href: href("/docs/[...path]", { path: "errors" }), label: "Diagnostics" },
    ],
  },
  {
    title: "For agents",
    links: [
      { href: href("/llms.txt"), label: "llms.txt" },
      { href: href("/llms-full.txt"), label: "llms-full.txt" },
      { href: link("/playground"), label: "Playground" },
    ],
  },
];
