// The route modules rendered only on the server (TASK-109): pages and layouts whose route mode is
// `static` or `server`. Their default export's props are plain values (no reactive reads), which
// the compiler needs to know (`compile(…, { serverRoute })`) for LUM2001/LUM2003. @lumiose/vite,
// `lumiose check` and the language server share this so they report the same diagnostics.

import { join } from "node:path";
import type {
  CreateRouteManifestOptions,
  RouteManifest,
} from "lumiose/internal/app/routes/manifest.ts";
import { scanRoutes } from "./app/routes/scan.ts";

/** Absolute files (`/` separators) of the server-rendered pages and layouts of `manifest`. */
export function serverRouteFiles(root: string, manifest: RouteManifest): Set<string> {
  const path = (file: string) => join(root, file).replaceAll("\\", "/");
  const files = new Set<string>();
  for (const route of manifest.routes) {
    if (route.kind === "page" && route.mode !== "spa") files.add(path(route.file));
  }
  for (const layout of manifest.layouts) {
    if (layout.mode !== "spa") files.add(path(layout.file));
  }
  return files;
}

/**
 * Absolute files (`/` separators) of the client-rendered pages and layouts of `manifest` (route
 * mode `spa`): client code, like island modules (scoped state, ./states.ts).
 */
export function spaRouteFiles(root: string, manifest: RouteManifest): Set<string> {
  const path = (file: string) => join(root, file).replaceAll("\\", "/");
  const files = new Set<string>();
  for (const route of manifest.routes) {
    if (route.kind === "page" && route.mode === "spa") files.add(path(route.file));
  }
  for (const layout of manifest.layouts) {
    if (layout.mode === "spa") files.add(path(layout.file));
  }
  return files;
}

/** Scans the project's routes; an unreadable routes directory has no server routes. */
export async function scanServerRoutes(
  root: string,
  options: CreateRouteManifestOptions,
): Promise<Set<string>> {
  try {
    return serverRouteFiles(root, await scanRoutes(root, options));
  } catch {
    return new Set();
  }
}
