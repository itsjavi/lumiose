// SPA pages on the server (spec §7.1, §7.5; owner: Spark): the request handler renders the part of
// an `spa` page below its first `spa` layout as one root island, which the SPA entry hydrates
// (`ssr`) or renders into an empty shell (`ssr = false`). The island ref names the leaf the client
// starts from, so the island's `modulepreload` hint is that page's module.
import type { Component } from "../../contract/client.ts";
import { createComponent } from "../../server/frame.ts";
import { island } from "../../server/island.ts";
import type { PageTree } from "../server/render.ts";
import type { RouteManifest } from "../routes/manifest.ts";
import type { RouteSegment } from "../routes/segments.ts";
import { CSR_REF, REROUTE_ATTR, SPA_REF, reroutes, spaPagePart, type SpaPart } from "./table.ts";

export { layoutChain, spaErrorPart, spaPagePart, type SpaPart } from "./table.ts";

/**
 * The page tree of an SPA page: the outer layouts, then the SPA root island. `levels` are the
 * loaded components of `part.levels` (layouts, then the leaf), or `undefined` for an `ssr = false`
 * shell, whose island the client renders. `leafProps` are the leaf's props (`{ params }`, or
 * `{ status, error, params }` for error pages); an error's status and message travel as island
 * props, so the client renders the same error page.
 */
export function spaPageTree(
  part: SpaPart,
  outer: readonly Component<any>[],
  levels: readonly Component<any>[] | undefined,
  leafProps: Record<string, unknown>,
  params: Record<string, string>,
): PageTree {
  const leaf = part.levels.at(-1)!;
  const error = leafProps.error as Error | undefined;
  const props =
    error === undefined ? {} : { status: leafProps.status as number, message: error.message };
  const SpaRoot = (): unknown =>
    levels === undefined
      ? island(`/${leaf}${CSR_REF}`, () => null, props, "only")
      : island(`/${leaf}${SPA_REF}`, () => level(levels, 0, leafProps, params), props, "load");
  return { layouts: outer, page: SpaRoot as Component<any>, props: {}, params };
}

/** Level `index` and, through its `children`, the levels below it (as `composePageTree` does). */
function level(
  levels: readonly Component<any>[],
  index: number,
  leafProps: Record<string, unknown>,
  params: Record<string, string>,
): unknown {
  if (index === levels.length - 1) return createComponent(levels[index]!, leafProps);
  return createComponent(levels[index]!, {
    params,
    get children() {
      return level(levels, index + 1, leafProps, params);
    },
  });
}

/**
 * The inline `<head>` script of a `not-found` page rendered inside the SPA `app`: when the URL matches
 * one of the SPA's pages that reroute (`reroutes()`), it hides the document before its first paint,
 * so the 404 does not flash before the router renders the page. The router shows it again once its
 * first view is on screen; so does a timeout, should the SPA never start. Without JavaScript the 404
 * shows. `""` when no page of the SPA reroutes. `base`: with leading and trailing slashes.
 */
export function rerouteScript(
  manifest: Pick<RouteManifest, "routes" | "layouts">,
  app: string,
  base: string,
): string {
  const paths: string[] = [];
  for (const route of manifest.routes) {
    if (route.kind !== "page" || !reroutes(route)) continue;
    if (spaPagePart(manifest, route.layouts, route.file, route.ssr).app !== app) continue;
    paths.push(pathSource(route.segments));
  }
  if (paths.length === 0) return "";
  const source = `^${escapeRegExp(base.slice(0, -1))}(?:${paths.join("|")})/?$`;
  return `<script>(()=>{const d=document.documentElement;if(new RegExp(${JSON.stringify(source)}).test(location.pathname)){d.setAttribute("${REROUTE_ATTR}","");d.style.visibility="hidden";setTimeout(()=>d.style.removeProperty("visibility"),${REVEAL_TIMEOUT})}})()</script>`;
}

/** The longest the document stays hidden, in ms, should the SPA not start. */
const REVEAL_TIMEOUT = 8000;

/** A regular expression source matching the (percent-encoded) pathname of a route, below `base`. */
function pathSource(segments: readonly RouteSegment[]): string {
  let source = "";
  for (const segment of segments) {
    if (segment.kind === "static") source += `/${escapeRegExp(encodeURIComponent(segment.value))}`;
    else if (segment.kind === "param") source += "/[^/]+";
    else if (segment.kind === "optional") source += "(?:/[^/]+)?";
    else if (segment.kind === "rest") source += "/.+";
    else source += "(?:/.*)?";
  }
  return source;
}

function escapeRegExp(text: string): string {
  return text.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&");
}
