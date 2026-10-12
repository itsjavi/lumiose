// Scans a project's routes directory into a route manifest (spec §8).

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createRouteManifest,
  DEFAULT_ROUTES_DIR,
  type CreateRouteManifestOptions,
  type RouteManifest,
  type RouteSourceFile,
} from "lumiose/internal/app/routes/manifest.ts";
import {
  isIgnoredRouteFolder,
  isRouteModuleCandidate,
} from "lumiose/internal/app/routes/segments.ts";

/**
 * Reads every route file (`page`, `route`, `layout`, …) under `<root>/<routesDir>` and builds the
 * manifest. Colocated modules and private (`_`) folders are skipped without reading them.
 */
export async function scanRoutes(
  root: string,
  options: CreateRouteManifestOptions = {},
): Promise<RouteManifest> {
  const routesDir = options.routesDir ?? DEFAULT_ROUTES_DIR;
  const absoluteDir = join(root, routesDir);
  const paths = await listRouteModules(absoluteDir);
  const files: RouteSourceFile[] = await Promise.all(
    paths.map(async (path) => ({ path, source: await readFile(join(absoluteDir, path), "utf8") })),
  );
  return createRouteManifest(files, { ...options, routesDir });
}

/** Routes-relative POSIX paths of candidate route files; empty if the directory is missing. */
async function listRouteModules(dir: string, prefix = ""): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (prefix === "" && (error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = prefix + entry.name;
      if (entry.isDirectory()) {
        return isIgnoredRouteFolder(entry.name)
          ? []
          : listRouteModules(join(dir, entry.name), `${path}/`);
      }
      return entry.isFile() && isRouteModuleCandidate(entry.name) ? [path] : [];
    }),
  );
  return nested.flat();
}
