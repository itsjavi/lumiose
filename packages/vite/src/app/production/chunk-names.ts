// Readable file names for the chunks and stylesheets of route modules (TASK-260). Every page is
// `page.stsx` and every layout `layout.stsx` (decision-42), so Rolldown's `[name]` (the module's
// file name) cannot tell them apart: the build names them after their route folder instead,
// `about/page.stsx` → `about-page-[hash].js` and `about-page-[hash].css`. Other chunks and assets
// keep Vite's names.

import { posix } from "node:path";
import type { Rollup } from "vite";
import type { RouteManifest } from "lumiose/internal/app/routes/manifest.ts";

/**
 * The readable name of a route module: its path below the routes directory without the extension,
 * each segment reduced to letters, digits, `_` and `-` (`[slug]` → `slug`, `(app)` → `app`), joined
 * with `-`. `blog/[slug]/page.stsx` → `blog-slug-page`; the root's `page.stsx` → `page`.
 */
export function routeModuleName(file: string, routesDir: string): string {
  const path = file.slice(routesDir.length + 1);
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.indexOf(".");
  const stem = dot > 0 ? path.slice(0, path.length - base.length + dot) : path;
  return stem
    .split("/")
    .map((segment) => segment.replaceAll(/[^\w-]+/g, ""))
    .filter((segment) => segment !== "")
    .join("-");
}

/** Project-relative file of each page, endpoint, layout, `not-found` and `error` module → its name. */
export function routeModuleNames(manifest: RouteManifest): Map<string, string> {
  const files = [
    ...manifest.routes,
    ...manifest.layouts,
    ...manifest.notFoundPages,
    ...manifest.errorPages,
  ].map((entry) => entry.file);
  return new Map(files.map((file) => [file, routeModuleName(file, manifest.routesDir)]));
}

/** Rolldown output options that name route modules' chunks and stylesheets (`routeOutput()`). */
export interface RouteOutput {
  chunkFileNames: (chunk: Rollup.PreRenderedChunk) => string;
  codeSplitting: { groups: Array<{ name: (id: string) => string | null }> };
}

/**
 * The output options of a build whose chunk files go to `dir` (as Vite's default,
 * `dir/[name]-[hash].js`), with route modules named by `names`:
 *
 * - `chunkFileNames` names a route module's chunk (an `spa` page or layout) after the route.
 * - A code-splitting group puts each route module's style module (`page.stsx?lumiose&type=style…`)
 *   in a chunk named after the route, so its stylesheet is too: Vite names a chunk's CSS after the
 *   chunk, and a style module that both the CSS manifest's entry and an `spa` page import lands in a
 *   shared chunk without a facade, named after the file (`page`). Each style module already has a
 *   chunk of its own, so the chunks stay the same.
 *
 * `file(id)` maps a module id (absolute) to its project-relative file. `names` is read lazily: the
 * routes are scanned after the config resolves.
 */
export function routeOutput(
  dir: string,
  names: () => ReadonlyMap<string, string> | undefined,
  file: (id: string) => string | undefined,
): RouteOutput {
  const nameOf = (id: string | null): string | undefined => {
    if (id === null) return undefined;
    const path = file(id.split("?")[0]!);
    return path === undefined ? undefined : names()?.get(path);
  };
  return {
    chunkFileNames: (chunk) =>
      posix.join(dir, `${nameOf(chunk.facadeModuleId) ?? "[name]"}-[hash].js`),
    codeSplitting: {
      groups: [{ name: (id) => (STYLE_MODULE.test(id) ? (nameOf(id) ?? null) : null) }],
    },
  };
}

/** The style module of a Lumiose component (`?lumiose&type=style&lang.css`). */
const STYLE_MODULE = /\?lumiose&type=style\b/;
