// Project conventions shared by `lumen dev`, `lumen build` and `lumen preview`: where the
// optional app files live, the Vite config lookup, and the project options of `lumen({ … })`.

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ResolvedConfig } from "vite";
import type { RouteMode } from "./routes/manifest.ts";
import type { CsrfOptions } from "./server/csrf.ts";
import type { TrailingSlash } from "./server/handler.ts";
import type { Prefetch } from "./server/navigation.ts";

export const MIDDLEWARE_FILES = ["src/middleware.ts", "src/middleware.js"];
export const DOCUMENT_FILES = ["src/document.stsx", "src/document.tsx"];

/** Vite's default config file names, in its lookup order. */
const VITE_CONFIG_FILES = [
  "vite.config.js",
  "vite.config.mjs",
  "vite.config.ts",
  "vite.config.cjs",
  "vite.config.mts",
  "vite.config.cts",
];

/** The Vite config file of a project root, or `false` when it has none. */
export function findViteConfig(root: string): string | false {
  return (
    VITE_CONFIG_FILES.map((name) => join(root, name)).find((file) => existsSync(file)) ?? false
  );
}

/** The first of `files` (project-relative) that exists in `root`. */
export function findAppFile(root: string, files: readonly string[]): string | undefined {
  return files.find((file) => existsSync(join(root, file)));
}

/**
 * Project options of `lumen({ … })` (decision-21, spec §8 "Dev and config"), which the `lumen`
 * compiler plugin (lumen/vite) exposes as `api.options`. Options it does not expose are unset.
 */
export interface ProjectOptions {
  mode?: RouteMode;
  ssr?: boolean;
  trailingSlash?: TrailingSlash;
  csrf?: false | CsrfOptions;
  viewTransitions?: boolean;
  prefetch?: Prefetch;
}

/** MPA navigation of `lumen({ viewTransitions, prefetch })` with its defaults (decision-24). */
export function navigationOptions(project: ProjectOptions): {
  viewTransitions: boolean;
  prefetch: Prefetch;
} {
  return {
    viewTransitions: project.viewTransitions ?? false,
    prefetch: project.prefetch ?? "hover",
  };
}

/**
 * The island modules the `lumen` plugin knows (`api.islandModules()`): the module of each island
 * ref → the specifier the island manifest imports it with. Empty without the plugin.
 */
export function islandModules(config: ResolvedConfig): ReadonlyMap<string, string> {
  const compiler = config.plugins.find((plugin) => plugin.name === "lumen");
  const api = compiler?.api as { islandModules?: () => ReadonlyMap<string, string> } | undefined;
  return api?.islandModules?.() ?? new Map();
}

/** Reads the project options from the resolved config; throws when `lumen()` is missing. */
export function projectOptions(config: ResolvedConfig, command: string): ProjectOptions {
  const compiler = config.plugins.find((plugin) => plugin.name === "lumen");
  if (compiler === undefined) {
    throw new Error(
      `lumen ${command} needs the compiler plugin: add \`lumen()\` from "lumen/vite" to the plugins of your Vite config.`,
    );
  }
  return (compiler.api as { options?: ProjectOptions } | undefined)?.options ?? {};
}
