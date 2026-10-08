// MPA navigation (spec §7.5, decision-24): `lumen({ viewTransitions, prefetch })` as `<head>` HTML
// of the page documents the handler renders.
//
// - View Transitions: `@view-transition { navigation: auto }` animates cross-document navigations
//   between pages that both opt in, unless the reader prefers reduced motion. Every page document
//   gets it, `spa` pages included: their client navigations are same-document, which the rule
//   does not touch, and their full-page navigations then transition too.
// - Prefetch: speculation rules that prefetch the page's same-origin links below `base` on hover
//   (`moderate` eagerness) or early (`eager`). Endpoint URLs are left out, since a GET endpoint
//   may act (`/logout`) and is no page to navigate to. `spa` documents get no rules: the client
//   router navigates their links, and `<Link prefetch>` loads the target route's modules instead.

import { jsonForScript } from "../../server/node.ts";
import type { Prefetch } from "../router/link.ts";
import type { RouteEntry } from "../routes/manifest.ts";
import type { RouteSegment } from "../routes/segments.ts";

export type { Prefetch };

/** `<head>` HTML for the documents of one app. */
export interface NavigationHead {
  /** For every page document: the View Transitions opt-in. */
  pages: string;
  /** For MPA page documents only (not `spa` pages): the speculation rules. */
  mpa: string;
}

const VIEW_TRANSITIONS =
  "<style>@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}</style>";
const EAGERNESS: Record<Exclude<Prefetch, "none">, string> = {
  hover: "moderate",
  viewport: "eager",
};

export function navigationHead(
  options: { viewTransitions?: boolean; prefetch?: Prefetch },
  routes: readonly RouteEntry[],
  base: string,
): NavigationHead {
  return {
    pages: options.viewTransitions === true ? VIEW_TRANSITIONS : "",
    mpa: speculationRules(options.prefetch ?? "none", routes, base),
  };
}

/** `<script type="speculationrules">` for the links of a page, or "" for `none`. */
export function speculationRules(
  prefetch: Prefetch,
  routes: readonly RouteEntry[],
  base: string,
): string {
  if (prefetch === "none") return "";
  // URL patterns resolve against the document's URL: a path keeps them same-origin.
  const prefix = base.slice(0, -1);
  const links = { href_matches: prefix === "" ? "/*" : `${prefix}{/*}?` };
  const endpoints = routes
    .filter((route) => route.kind === "endpoint")
    .map((route) => urlPattern(prefix, route.segments));
  const where =
    endpoints.length === 0 ? links : { and: [links, { not: { href_matches: endpoints } }] };
  const rules = { prefetch: [{ where, eagerness: EAGERNESS[prefetch] }] };
  return `<script type="speculationrules">${jsonForScript(rules)}</script>`;
}

/**
 * The URL pattern (URLPattern pathname syntax) of a route's URLs below `prefix`, with or without
 * a trailing slash, as the handler matches them: `/api/[id]` → `/api/:p1{/}?`.
 */
export function urlPattern(prefix: string, segments: readonly RouteSegment[]): string {
  let pattern = prefix;
  for (const [index, segment] of segments.entries()) {
    // `[...rest]` matches zero or more segments and is always last.
    if (segment.kind === "rest") return `${pattern}{/*}?`;
    pattern += segment.kind === "param" ? `/:p${index}` : `/${escapePattern(segment.value)}`;
  }
  return `${pattern}{/}?`;
}

/** Escapes the characters URLPattern syntax gives a meaning to. */
function escapePattern(value: string): string {
  return value.replace(/[\\:*?+(){}]/g, "\\$&");
}
