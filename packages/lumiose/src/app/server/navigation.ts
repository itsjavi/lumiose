// MPA navigation (spec §7.5, decision-24): `lumiose({ viewTransitions, prefetch })` as `<head>` HTML
// of the page documents the handler renders.
//
// - View Transitions: `@view-transition { navigation: auto }` animates cross-document navigations
//   between pages that both opt in, unless the reader prefers reduced motion. Every page document
//   gets it, `spa` pages included: their client navigations are same-document, which the rule
//   does not touch, and their full-page navigations then transition too.
// - Prefetch: speculation rules that prefetch the page's same-origin links below `base` on hover
//   (`moderate` eagerness) or early (`eager`). Endpoint URLs are left out, since a GET endpoint
//   may act (`/logout`) and is no page to navigate to, and so is `/` with locale detection, whose
//   answer depends on a cookie that may change before the navigation (decision-44). `spa` documents get no rules: the client
//   router navigates their links, and `<Link prefetch>` loads the target route's modules instead.
// - Per link (decision-24 amendment): on MPA pages `<Link prefetch>` renders a plain `<a>` with a
//   `data-l-prefetch` marker. The rules of a page with marked links group them by level: the
//   project default's rule skips links marked with another level, each other level gets a rule
//   for its marked links, and `none` gets none. Pages without marked links keep the plain rules.
//   The server `<Link>` notes its marker in the request scope (`notePrefetchLink()`), so the
//   handler knows without searching the HTML (TASK-150): a marker in the shell picks the marked
//   rules; a streamed page may still render marked links, so its head gets the marked rules, or,
//   with `prefetch: "none"` (no rules otherwise), the rules follow the stream when a streamed
//   boundary rendered a marked link.

import { jsonForScript } from "../../server/node.ts";
import type { I18nConfig, I18nUrls } from "../i18n/config.ts";
import type { Prefetch } from "../router/link.ts";
import type { RouteEntry } from "../routes/manifest.ts";
import type { RouteSegment } from "../routes/segments.ts";

export type { Prefetch };

/** `<head>` HTML for the documents of one app. */
export interface NavigationHead {
  /** For every page document: the View Transitions opt-in. */
  pages: string;
  /** For MPA page documents only (not `spa` pages): the speculation rules. */
  mpa: MpaRules;
}

/** The speculation rules of the MPA documents of one app, without and with marked links. */
export interface MpaRules {
  prefetch: Prefetch;
  plain: string;
  marked: string;
}

/** The attribute `<Link prefetch>` marks its `<a>` with on MPA pages. */
export const PREFETCH_MARKER = "data-l-prefetch";
/** What a marked link's HTML contains. */

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
  i18n?: I18nUrls & Partial<Pick<I18nConfig, "detect">>,
): NavigationHead {
  // Endpoints may be served under the other locales' prefixes too (decision-44).
  const prefixes = i18n?.locales.filter((locale) => locale !== i18n.defaultLocale) ?? [];
  // A prefetch of the entry would keep a detection decision past a language switcher's cookie.
  const detecting = i18n?.detect !== undefined && i18n.detect !== false;
  return {
    pages: options.viewTransitions === true ? VIEW_TRANSITIONS : "",
    mpa: mpaRules(options.prefetch ?? "none", routes, base, prefixes, detecting),
  };
}

function mpaRules(
  prefetch: Prefetch,
  routes: readonly RouteEntry[],
  base: string,
  prefixes: readonly string[],
  detecting: boolean,
): MpaRules {
  return {
    prefetch,
    plain: speculationRules(prefetch, routes, base, false, prefixes, detecting),
    marked: speculationRules(prefetch, routes, base, true, prefixes, detecting),
  };
}

/**
 * The speculation rules of one MPA document: `head` for its `<head>`, and `stream` with the rules
 * appended when they wait for a marked link in the streamed boundaries. `marked()` tells whether
 * the page rendered a marked link so far (the request scope's flag).
 */
export function documentRules(
  rules: MpaRules,
  marked: () => boolean,
  stream: ReadableStream<string | Uint8Array> | null,
): { head: string; stream: ReadableStream<string | Uint8Array> | null } {
  const inShell = marked();
  if (inShell || stream === null) return { head: inShell ? rules.marked : rules.plain, stream };
  // Streamed boundaries may still render marked links.
  if (rules.prefetch !== "none") return { head: rules.marked, stream };
  return { head: "", stream: appendIfMarked(stream, rules.marked, marked) };
}

/** `stream`, followed by `html` when a marked link rendered by the time it ends. */
function appendIfMarked(
  stream: ReadableStream<string | Uint8Array>,
  html: string,
  marked: () => boolean,
): ReadableStream<string | Uint8Array> {
  return stream.pipeThrough(
    new TransformStream<string | Uint8Array, string | Uint8Array>({
      flush(controller) {
        if (marked()) controller.enqueue(html);
      },
    }),
  );
}

/**
 * `<script type="speculationrules">` for the links of a page, or "" when no link is prefetched.
 * `marked`: the page has `<Link prefetch>` links, which the rules group by their level.
 */
export function speculationRules(
  prefetch: Prefetch,
  routes: readonly RouteEntry[],
  base: string,
  marked = false,
  localePrefixes: readonly string[] = [],
  detecting = false,
): string {
  // URL patterns resolve against the document's URL: a path keeps them same-origin.
  const prefix = base.slice(0, -1);
  const links: object[] = [{ href_matches: prefix === "" ? "/*" : `${prefix}{/*}?` }];
  // An optional locale prefix: `{/(es|fr)}?` (locales are letters, digits and dashes).
  const locales = localePrefixes.length === 0 ? "" : `{/(${localePrefixes.join("|")})}?`;
  const excluded = routes
    .filter((route) => route.kind === "endpoint")
    .map((route) => urlPattern(prefix + locales, route.segments));
  // With locale detection, `/` (the base) answers per cookie: never prefetched (decision-44).
  if (detecting) excluded.push(urlPattern(prefix, []));
  if (excluded.length > 0) links.push({ not: { href_matches: excluded } });
  const rule = (level: Exclude<Prefetch, "none">, only?: object) => ({
    where:
      only !== undefined
        ? { and: [...links, only] }
        : links.length === 1
          ? links[0]
          : { and: links },
    eagerness: EAGERNESS[level],
  });
  const rules: object[] = [];
  for (const level of ["hover", "viewport"] as const) {
    if (!marked) {
      if (level === prefetch) rules.push(rule(level));
    } else if (level === prefetch) {
      // Plain links and the links marked with this level.
      const other = `[${PREFETCH_MARKER}]:not([${PREFETCH_MARKER}=${level}])`;
      rules.push(rule(level, { not: { selector_matches: other } }));
    } else {
      rules.push(rule(level, { selector_matches: `[${PREFETCH_MARKER}=${level}]` }));
    }
  }
  if (rules.length === 0) return "";
  return `<script type="speculationrules">${jsonForScript({ prefetch: rules })}</script>`;
}

/**
 * The URL pattern (URLPattern pathname syntax) of a route's URLs below `prefix`, with or without
 * a trailing slash, as the handler matches them: `/api/[id]` → `/api/:p1{/}?`.
 */
export function urlPattern(prefix: string, segments: readonly RouteSegment[]): string {
  let pattern = prefix;
  for (const [index, segment] of segments.entries()) {
    if (segment.kind === "static") pattern += `/${escapePattern(segment.value)}`;
    else if (segment.kind === "param") pattern += `/:p${index}`;
    else if (segment.kind === "optional") pattern += `{/:p${index}}?`;
    // `[...rest]` (one or more segments) and `[[...rest]]` (zero or more) are always last.
    else if (segment.kind === "rest") pattern += `/:p${index}+`;
    else pattern += `{/:p${index}}*`;
  }
  return `${pattern}{/}?`;
}

/** Escapes the characters URLPattern syntax gives a meaning to. */
function escapePattern(value: string): string {
  return value.replace(/[\\:*?+(){}]/g, "\\$&");
}
