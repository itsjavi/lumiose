// Typed-route registry. `lumiose typegen` augments `RouteMap` and `LayoutMap` in
// `.lumiose/types/routes.d.ts`:
//
//   declare module "lumiose" {
//     interface RouteMap { "/blog/[slug]": { kind: "page"; params: { slug: string } } }
//     interface LayoutMap { "/blog": { params: {} } }
//   }
//
// Every route-bound type takes the route pattern literal (decision-26 §1), so an unknown or stale
// pattern is a type error. Until typegen has run, patterns are `string` and params are untyped.

import type { Renderable } from "../../contract/client.ts";

/** Route pattern → `{ kind, params }`, filled by declaration merging. */
export interface RouteMap {}

/** Layout pattern (the URL scope of a `_layout` file's directory) → `{ params }`. */
export interface LayoutMap {}

/** Union of every route pattern in the app, e.g. `"/" | "/blog/[slug]"`. */
export type Routes = [keyof RouteMap] extends [never] ? string : Extract<keyof RouteMap, string>;

/** Patterns of the routes of one kind (`page` or `endpoint`). */
type RoutesOf<Kind extends string> = [keyof RouteMap] extends [never]
  ? string
  : {
      [P in keyof RouteMap]: RouteMap[P] extends { kind: Kind } ? Extract<P, string> : never;
    }[keyof RouteMap];

/** Union of the page patterns: what `PageProps` and `ActionContext` take. */
export type PageRoutes = RoutesOf<"page">;

/** Union of the endpoint patterns: what `Endpoint` takes. */
export type EndpointRoutes = RoutesOf<"endpoint">;

/** Union of the layout patterns: what `LayoutProps` takes. */
export type LayoutRoutes = [keyof LayoutMap] extends [never]
  ? string
  : Extract<keyof LayoutMap, string>;

/** Params of a route pattern; `[...rest]` params are strings joined with "/". */
export type RouteParams<P extends Routes> = P extends keyof RouteMap
  ? RouteMap[P] extends { params: infer T }
    ? T
    : never
  : Record<string, string>;

/** Props of a page: `export default function Book(props: PageProps<"/books/[isbn]">)`. */
export interface PageProps<P extends PageRoutes> {
  params: RouteParams<P>;
}

/**
 * Props of a layout: `export default function Shell(props: LayoutProps<"/books">)`. The pattern
 * is the URL scope of the layout's directory (route groups such as `(app)` add nothing), and
 * `params` holds the params of that scope.
 */
export interface LayoutProps<P extends LayoutRoutes> {
  params: P extends keyof LayoutMap
    ? LayoutMap[P] extends { params: infer T }
      ? T
      : never
    : Record<string, string>;
  /** The page (or nested layout) to render. */
  children: Renderable;
}
