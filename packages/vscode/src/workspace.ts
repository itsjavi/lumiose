// Workspace probes without the `vscode` API (unit-tested): where the language server lives and
// whether a folder uses Lumiose.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";

export const SERVER_PACKAGE = "@lumiose/language-server";
const SERVER_BIN = "lumiose-language-server";

export type ServerSource = "setting" | "workspace" | "bundled";

export interface ServerEntry {
  /** Absolute path of the script that `node` runs (`… --stdio`). */
  path: string;
  source: ServerSource;
}

export interface ResolveServerOptions {
  /** The `lumiose.server.path` setting: absolute, or relative to the first folder. */
  configured?: string | undefined;
  /** Workspace folder paths. */
  folders: readonly string[];
  /** The extension's install directory (a bundled server lives in `server/`, see `BUNDLED_SERVER`). */
  extensionPath: string;
}

/**
 * The language server to launch: the `lumiose.server.path` setting, else `@lumiose/language-server`
 * resolved from a workspace folder (directly or through its `lumiose` dependency), else a server
 * bundled with the extension. `undefined` when none exists.
 */
export function resolveServerEntry(options: ResolveServerOptions): ServerEntry | undefined {
  const configured = options.configured?.trim();
  if (configured) {
    const base = options.folders[0] ?? process.cwd();
    const path = isAbsolute(configured) ? configured : resolve(base, configured);
    return existsSync(path) ? { path, source: "setting" } : undefined;
  }
  for (const folder of options.folders) {
    const path = workspaceServer(folder);
    if (path !== undefined) return { path, source: "workspace" };
  }
  const bundled = join(options.extensionPath, BUNDLED_SERVER);
  return existsSync(bundled) ? { path: bundled, source: "bundled" } : undefined;
}

/** The server bundled into the .vsix by scripts/build.ts: one ESM file plus the native compiler. */
export const BUNDLED_SERVER = "server/bin.mjs";

/** How to run the server: VS Code's own Node.js, or an executable such as `node`. */
export type ServerRuntime = { kind: "vscode" } | { kind: "executable"; command: string };

/**
 * The `lumiose.server.runtime` setting when set; otherwise VS Code's own Node.js for the bundled
 * server (plain JS, nothing to install), and `node` from PATH for a workspace or configured server,
 * which runs from TypeScript sources and so needs Node ≥ 24.
 */
export function serverRuntime(entry: ServerEntry, configured: string | undefined): ServerRuntime {
  const command = configured?.trim();
  if (command) return { kind: "executable", command };
  return entry.source === "bundled" ? { kind: "vscode" } : { kind: "executable", command: "node" };
}

function workspaceServer(folder: string): string | undefined {
  const bases = [folder];
  const lumiose = findPackageJson(folder, "lumiose");
  if (lumiose !== undefined) bases.push(dirname(lumiose));
  for (const base of bases) {
    const manifest = findPackageJson(base, SERVER_PACKAGE);
    if (manifest === undefined) continue;
    const bin = readJson(manifest)?.["bin"];
    const relative = typeof bin === "string" ? bin : (bin as Record<string, unknown>)?.[SERVER_BIN];
    if (typeof relative !== "string") continue;
    const path = join(dirname(manifest), relative);
    if (existsSync(path)) return path;
  }
  return undefined;
}

/** Whether the folder depends on `lumiose` (declared in package.json or installed). */
export function usesLumiose(folder: string): boolean {
  if (existsSync(join(folder, "node_modules", "lumiose", "package.json"))) return true;
  const manifest = readJson(join(folder, "package.json"));
  if (manifest === undefined) return false;
  if (manifest["name"] === "lumiose") return true;
  return ["dependencies", "devDependencies", "peerDependencies"].some((field) => {
    const deps = manifest[field];
    return typeof deps === "object" && deps !== null && "lumiose" in deps;
  });
}

export type TakeoverSetting = "prompt" | "auto" | "off";

export interface TakeoverState {
  setting: TakeoverSetting;
  /** Whether a TypeScript extension that would duplicate the server's features is enabled. */
  typescriptExtensionActive: boolean;
  /** Whether any workspace folder uses Lumiose. */
  usesLumiose: boolean;
}

/** Whether the server also handles `.ts`/`.tsx`/`.js`/`.jsx` (takeover mode). */
export function takeoverActive(state: TakeoverState): boolean {
  return state.setting !== "off" && !state.typescriptExtensionActive;
}

/** Whether to offer to disable the built-in TypeScript extension. */
export function shouldPromptTakeover(state: TakeoverState): boolean {
  return state.setting === "prompt" && state.typescriptExtensionActive && state.usesLumiose;
}

/** The languages the client sends to the server. */
export function documentLanguages(takeover: boolean): string[] {
  return takeover
    ? ["stsx", "typescript", "typescriptreact", "javascript", "javascriptreact"]
    : ["stsx"];
}

/**
 * `<name>/package.json` as Node's node_modules lookup finds it from `dir` (its real path, so pnpm's
 * symlinked packages see their own dependencies). Unlike `require.resolve`, it ignores NODE_PATH
 * and global folders.
 */
function findPackageJson(dir: string, name: string): string | undefined {
  let current: string;
  try {
    current = realpathSync(dir);
  } catch {
    return undefined;
  }
  for (;;) {
    if (basename(current) !== "node_modules") {
      const manifest = join(current, "node_modules", name, "package.json");
      if (existsSync(manifest)) return manifest;
    }
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function readJson(path: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(readFileSync(path, "utf8"));
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}
