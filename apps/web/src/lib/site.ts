// Site-wide constants and the base path. The site may be served below a path (a GitHub Pages
// project site: `LUMIOSE_BASE=/<repo>/`): route URLs come from `href()`, which adds the base; other site URLs
// (public files such as the playground's generated assets) go through `link()`.
import type { FooterColumn, NavLink } from "@lumiose/site-kit";
import { href } from "lumiose";

/** Vite's `base`, always with a trailing slash ("/" or "/lumiose/"). */
export const BASE = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

/** A site path (`/docs/concepts/signals`, `#top` and external URLs pass through) below the base. */
export function link(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  return BASE + path.slice(1);
}

/** A request path without the base: `/lumiose/docs/x` → `/docs/x`. */
export function sitePath(pathname: string): string {
  return pathname.startsWith(BASE) ? `/${pathname.slice(BASE.length)}` : pathname;
}

/** The docs page of a diagnostic's docs topic (`errors/LUM2001` or `diagnostics/LUM2001`). */
export function docsLink(topic: string): string {
  return href("/docs/[[...path]]", { path: topic.replace(/^diagnostics\//, "errors/") });
}

/** The source repository. */
export const REPOSITORY = "https://github.com/itsjavi/lumiose";

/** The site's public origin (the GitHub Pages custom domain), for absolute URLs in the head. */
export const SITE_URL = "https://lumiose.dev";

/** The absolute URL of a site path: canonical links and Open Graph URLs must be absolute. */
export function absoluteUrl(path: string): string {
  return new URL(link(path), SITE_URL).href;
}

/**
 * The canonical URL of a request path: GitHub Pages serves a page from its folder's index.html and
 * redirects the path without a trailing slash, so pages get one (as in sitemap.xml).
 */
export function canonicalUrl(pathname: string): string {
  const path = sitePath(pathname);
  return absoluteUrl(path.endsWith("/") || /\.[a-z0-9]+$/i.test(path) ? path : `${path}/`);
}

/**
 * A meta description of at most `max` characters: whole sentences when at least 100 characters of
 * them fit, else the text cut at a word, with "…". Search results show about 160.
 */
export function metaDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  let end = 0;
  for (const match of clean.matchAll(/[.!?](?=\s)/g)) {
    if (match.index + 1 > max) break;
    end = match.index + 1;
  }
  if (end >= 100) return clean.slice(0, end);
  const cut = clean.slice(0, clean.lastIndexOf(" ", max - 1)).replace(/[\s,;:(–-]+$/, "");
  return `${cut}…`;
}

/** An Open Graph image in public/og (1200×630, scripts/og-images.ts). */
export interface OgImage {
  path: string;
  alt: string;
}

/** The home page's image is every page's default; /stsx and /ui have their own. */
export const ogImages = {
  home: {
    path: "/og/home.png",
    alt: "Lumiose: Feels like React. Runs like vanilla JS. TSX with scoped CSS, signals, and 0 kB of JavaScript until a page needs it.",
  },
  stsx: {
    path: "/og/stsx.png",
    alt: "STSX: scoped CSS in your TSX. Plain-CSS style blocks, scoped by placement, compiled at build time, next to a React counter component.",
  },
  ui: {
    path: "/og/ui.png",
    alt: "Lumiose UI: accessible UI on native HTML. Dialogs, menus, comboboxes and more, server-rendered without hydration.",
  },
} satisfies Record<string, OgImage>;

export const site = {
  name: "Lumiose",
  tagline: "Feels like React. Runs like vanilla JS.",
  /** The meta and OG description: the search terms first, at most 160 characters. */
  description:
    "Lumiose: one web framework for static sites, server-side rendering, islands and SPAs. TSX with scoped CSS, signals, and 0 kB of JS until a page needs it.",
};

export const navLinks: NavLink[] = [
  { href: href("/docs/[[...path]]", { path: "" }), label: "Docs" },
  { href: href("/stsx/[[...path]]", { path: "" }), label: "STSX" },
  { href: href("/ui/[[...path]]", { path: "" }), label: "UI" },
  { href: href("/showcase"), label: "Showcase" },
  { href: href("/benchmarks"), label: "Benchmarks" },
  { href: href("/playground"), label: "Playground" },
];

export const footerColumns: FooterColumn[] = [
  {
    title: "Learn",
    links: [
      { href: href("/docs/[[...path]]", { path: "getting-started" }), label: "Getting started" },
      {
        href: href("/docs/[[...path]]", { path: "coming-from/react" }),
        label: "Coming from React",
      },
      { href: href("/docs/[[...path]]", { path: "concepts/components" }), label: "Components" },
      { href: href("/docs/[[...path]]", { path: "concepts/styles" }), label: "Styles" },
      { href: href("/docs/[[...path]]", { path: "concepts/islands" }), label: "Islands" },
      { href: href("/stsx/[[...path]]", { path: "" }), label: "STSX outside Lumiose" },
      { href: href("/ui/[[...path]]", { path: "" }), label: "UI components" },
    ],
  },
  {
    title: "Reference",
    links: [
      { href: href("/docs/[[...path]]", { path: "reference/cli" }), label: "CLI" },
      { href: href("/docs/[[...path]]", { path: "reference/vite" }), label: "@lumiose/vite" },
      { href: href("/docs/[[...path]]", { path: "errors" }), label: "Diagnostics" },
      { href: href("/docs/[[...path]]", { path: "concepts/security" }), label: "Security" },
      { href: href("/docs/[[...path]]", { path: "stability" }), label: "Stability" },
    ],
  },
  {
    title: "See it run",
    links: [
      { href: href("/showcase"), label: "Showcase" },
      { href: `${href("/showcase")}#used-by`, label: "Used by" },
      { href: href("/benchmarks"), label: "Benchmarks" },
      { href: href("/benchmarks/js-framework-benchmark"), label: "js-framework-benchmark" },
      { href: href("/benchmarks/fullstack-comparison"), label: "Fullstack comparison" },
      { href: href("/playground"), label: "Playground" },
    ],
  },
  {
    title: "For agents",
    links: [
      { href: href("/llms.txt"), label: "llms.txt" },
      { href: href("/llms-full.txt"), label: "llms-full.txt" },
      { href: href("/stsx/llms.txt"), label: "STSX llms.txt" },
      { href: href("/ui/llms.txt"), label: "UI llms.txt" },
      { href: href("/docs/[[...path]]", { path: "reference/mcp" }), label: "MCP server" },
      { href: REPOSITORY, label: "GitHub" },
    ],
  },
];
