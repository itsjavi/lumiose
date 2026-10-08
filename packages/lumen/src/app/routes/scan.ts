// Scans a project's routes directory into a route manifest (spec §8).

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createRouteManifest,
  DEFAULT_ROUTES_DIR,
  type CreateRouteManifestOptions,
  type RouteManifest,
  type RouteSourceFile,
} from "./manifest.ts";
import { isRouteModuleCandidate } from "./segments.ts";

/** Reads every route module under `<root>/<routesDir>` and builds the manifest. */
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

/** Routes-relative POSIX paths of candidate route modules; empty if the directory is missing. */
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
      if (entry.name.startsWith(".") || entry.name === "node_modules") return [];
      const path = prefix + entry.name;
      if (entry.isDirectory()) return listRouteModules(join(dir, entry.name), `${path}/`);
      return entry.isFile() && isRouteModuleCandidate(entry.name) ? [path] : [];
    }),
  );
  return nested.flat();
}
