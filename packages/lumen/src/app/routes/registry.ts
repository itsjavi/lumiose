// Typed-route registry. `lumen typegen` augments `RouteMap` in `.lumen/types/routes.d.ts`:
//
//   declare module "lumen" {
//     interface RouteMap { "/blog/[slug]": { kind: "page"; params: { slug: string } } }
//   }
//
// Until typegen has run, `Routes` is `string` and params are untyped.

/** Route pattern → `{ kind, params }`, filled by declaration merging. */
export interface RouteMap {}

/** Union of every route pattern in the app, e.g. `"/" | "/blog/[slug]"`. */
export type Routes = [keyof RouteMap] extends [never] ? string : Extract<keyof RouteMap, string>;

/** Params of a route pattern; `[...rest]` params are strings joined with "/". */
export type RouteParams<P extends Routes> = P extends keyof RouteMap
  ? RouteMap[P] extends { params: infer T }
    ? T
    : never
  : Record<string, string>;

/** Props of a page component for the given route pattern. */
export interface RouteProps<P extends Routes> {
  params: RouteParams<P>;
}
