// The project as the CLI sees it: its root and the options of `lumiose({ … })` in its Vite config
// (decision-21), which set the default route mode that route diagnostics and `lumiose routes` use.

import { existsSync, realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { findViteConfig, projectOptions, type ProjectOptions } from "../app/project.ts";
import type { CreateRouteManifestOptions } from "../app/routes/manifest.ts";
import { CheckFailure } from "./check/diagnostics.ts";

/** The real path of an existing project root directory; a tool failure otherwise. */
export function projectRoot(root: string): string {
  const path = resolve(root);
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    throw new CheckFailure(`Project root ${path} does not exist.`, {
      help: "Pass the project directory with --root <dir>, or run the command inside it.",
    });
  }
  return realpathSync(path);
}

/**
 * The project options of `lumiose({ … })`, read by resolving the project's Vite config; `{}` (the
 * defaults) when the project has no Vite config. Vite is loaded only when there is one.
 */
export async function loadProjectOptions(root: string, command: string): Promise<ProjectOptions> {
  const configFile = findViteConfig(root);
  if (configFile === false) return {};
  const { resolveConfig } = await import("vite");
  let config;
  try {
    config = await resolveConfig({ root, configFile, logLevel: "silent" }, "serve");
  } catch (error) {
    throw new CheckFailure(
      `Could not load ${configFile}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  try {
    return projectOptions(config, command);
  } catch (error) {
    throw new CheckFailure((error as Error).message);
  }
}

/** Route manifest options with the project's default mode and `ssr`. */
export async function routeOptions(
  root: string,
  command = "check",
): Promise<CreateRouteManifestOptions> {
  const options = await loadProjectOptions(root, command);
  return {
    ...(options.mode === undefined ? {} : { defaultMode: options.mode }),
    ...(options.ssr === undefined ? {} : { defaultSsr: options.ssr }),
  };
}
