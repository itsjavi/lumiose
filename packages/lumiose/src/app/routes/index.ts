// File routes (spec §7.1, §8): build-side entry for the request handler, the Vite plugin and the CLI.
// It pulls in node:fs through scan.ts; browser code (the SPA router) imports match.ts directly.
export { createRouteManifest, DEFAULT_ROUTES_DIR } from "./manifest.ts";
export type {
  CreateRouteManifestOptions,
  EndpointMode,
  EndpointRoute,
  LayoutEntry,
  PageRoute,
  RouteEntry,
  RouteManifest,
  RouteMode,
  RouteParam,
  RouteSourceFile,
  SpecialPage,
} from "./manifest.ts";
export { createRouteMatcher, matchSegments, splitPathname } from "./match.ts";
export type { RouteMatch, RouteMatcher, RouteParamValues } from "./match.ts";
export { readRouteModuleMeta } from "./meta.ts";
export type { ReadRouteModuleMeta, RouteModuleMeta } from "./meta.ts";
export type { RouteSegment } from "./segments.ts";
