// Files of lumiose runtime modules that the plugin names by path (virtual-module entries, the
// runtime chunk). Resolved through `lumiose/internal/*`, so they follow the installed lumiose: its
// TypeScript sources in this workspace, its built JavaScript once published.
import { createRequire } from "node:module";
import { normalizePath } from "vite";

const require = createRequire(import.meta.url);

/** The file of lumiose runtime module `path` (relative to its `src/`, with the `.ts` extension). */
export function runtimeFile(path: string): string {
  return normalizePath(require.resolve(`lumiose/internal/${path}`));
}

/** Lumiose's runtime directory (every runtime module the client imports lives below it), with a trailing slash. */
export const LUMIOSE_SRC = runtimeFile("index.ts").replace(/index\.[jt]s$/, "");
