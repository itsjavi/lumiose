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
  return link(`/docs/${topic.replace(/^diagnostics\//, "errors/")}`);
}

/** The source repository. */
export const REPOSITORY = "https://github.com/itsjavi/lumiose";

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
