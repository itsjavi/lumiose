// `lumiose typegen` (spec §4.7): writes generated declarations under `.lumiose/types`.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CreateRouteManifestOptions, RouteManifest } from "../routes/manifest.ts";
import { scanRoutes } from "../routes/scan.ts";
import { generateRouteTypes } from "./routes.ts";

export { generateRouteTypes };

export const ROUTE_TYPES_FILE = ".lumiose/types/routes.d.ts";

export interface TypegenResult {
  manifest: RouteManifest;
  /** Absolute path of the routes declaration file. */
  file: string;
  /** Whether the file content changed (unchanged files are not rewritten). */
  changed: boolean;
}

/** Scans `<root>/src/routes` and writes `<root>/.lumiose/types/routes.d.ts`. */
export async function typegen(
  root: string,
  options: CreateRouteManifestOptions = {},
): Promise<TypegenResult> {
  const manifest = await scanRoutes(root, options);
  const file = join(root, ROUTE_TYPES_FILE);
  const changed = await writeIfChanged(file, generateRouteTypes(manifest));
  return { manifest, file, changed };
}

async function writeIfChanged(file: string, content: string): Promise<boolean> {
  const current = await readFile(file, "utf8").catch(() => undefined);
  if (current === content) return false;
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
  return true;
}
