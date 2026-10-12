// Project conventions shared by `lumiose dev`, `lumiose build` and `lumiose preview`: where the
// optional app files live, the Vite config lookup, and the project options of `lumiose({ … })`.

import { existsSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Plugin, PluginOption, ResolvedConfig } from "vite";
import { TRAILING_SLASH_DEFINE } from "lumiose/internal/app/routes/href.ts";
import type { RouteMode } from "lumiose/internal/app/routes/manifest.ts";
import type { HeadersOption } from "lumiose/internal/app/headers.ts";
import type { CsrfOptions } from "lumiose/internal/app/server/csrf.ts";
import type { LimitsOption } from "lumiose/internal/app/server/body.ts";
import type { TrailingSlash } from "lumiose/internal/app/server/handler.ts";
import type { Prefetch } from "lumiose/internal/app/server/navigation.ts";
import type { Adapter } from "./production/adapter.ts";

/**
 * The project root as the module graph sees it: absolute and real, with symbolic links and
 * Windows 8.3 short names (`C:\\Users\\RUNNER~1`) resolved, as Vite resolves module ids. Paths
 * relative to it (route files, island refs, the CSS manifest) are then computed from matching
 * prefixes. Falls back to the resolved path when it does not exist.
 */
export function realProjectRoot(root: string = process.cwd()): string {
  const absolute = resolve(root);
  try {
    return realpathSync.native(absolute);
  } catch {
    return absolute;
  }
}

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
 * Project options of `lumiose({ … })` (decision-21, spec §8 "Dev and config"), which the `lumiose`
 * compiler plugin (@lumiose/vite) exposes as `api.options`. Options it does not expose are unset.
 */
export interface ProjectOptions {
  mode?: RouteMode;
  ssr?: boolean;
  prerender?: boolean;
  trailingSlash?: TrailingSlash;
  csrf?: false | CsrfOptions;
  viewTransitions?: boolean;
  prefetch?: Prefetch;
  csp?: "strict";
  headers?: HeadersOption;
  limits?: LimitsOption;
  adapter?: Adapter;
}

/** MPA navigation of `lumiose({ viewTransitions, prefetch })` with its defaults (decision-24). */
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
 * The island modules the `lumiose` plugin knows (`api.islandModules()`): the module of each island
 * ref → the specifier the island manifest imports it with. Empty without the plugin.
 */
export function islandModules(config: ResolvedConfig): ReadonlyMap<string, string> {
  const compiler = config.plugins.find((plugin) => plugin.name === "lumiose");
  const api = compiler?.api as { islandModules?: () => ReadonlyMap<string, string> } | undefined;
  return api?.islandModules?.() ?? new Map();
}

/**
 * Dev: whether client code reaches the scoped state `ref` (`api.isClientState()` of the `lumiose`
 * plugin, decision-33), given the SPA route files. True without the plugin.
 */
export function isClientState(
  config: ResolvedConfig,
  ref: string,
  spaRoutes: ReadonlySet<string>,
): boolean {
  const compiler = config.plugins.find((plugin) => plugin.name === "lumiose");
  const api = compiler?.api as
    | { isClientState?: (ref: string, spaRoutes: ReadonlySet<string>) => boolean }
    | undefined;
  return api?.isClientState?.(ref, spaRoutes) ?? true;
}

/** The `define` that hands `trailingSlash` to `href()` in every environment (./routes/href.ts). */
export function hrefDefine(trailingSlash: TrailingSlash): Record<string, string> {
  return { [TRAILING_SLASH_DEFINE]: JSON.stringify(trailingSlash) };
}

/**
 * The project options in a `config` hook, before the config resolves: from `lumiose()` among the
 * user config's plugins (nested arrays included). Empty without it.
 */
export function configProjectOptions(plugins: readonly PluginOption[] | undefined): ProjectOptions {
  const compiler = findPlugin(plugins ?? [], "lumiose");
  return (compiler?.api as { options?: ProjectOptions } | undefined)?.options ?? {};
}

function findPlugin(plugins: readonly PluginOption[], name: string): Plugin | undefined {
  for (const plugin of plugins) {
    if (Array.isArray(plugin)) {
      const found = findPlugin(plugin, name);
      if (found !== undefined) return found;
    } else if (typeof plugin === "object" && plugin !== null && "name" in plugin) {
      if (plugin.name === name) return plugin;
    }
  }
  return undefined;
}

/** Reads the project options from the resolved config; throws when `lumiose()` is missing. */
export function projectOptions(config: ResolvedConfig, command: string): ProjectOptions {
  const compiler = config.plugins.find((plugin) => plugin.name === "lumiose");
  if (compiler === undefined) {
    throw new Error(
      `lumiose ${command} needs the compiler plugin: add \`lumiose()\` from "@lumiose/vite" to the plugins of your Vite config.`,
    );
  }
  return (compiler.api as { options?: ProjectOptions } | undefined)?.options ?? {};
}
