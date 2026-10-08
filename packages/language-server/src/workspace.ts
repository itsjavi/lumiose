// File URIs, Lumen project roots and the source ↔ shadow mapping (spec §9.1):
// `<root>/src/a/B.stsx` ↔ `<root>/.lumen/shadow/src/a/B.stsx.tsx`.

import { existsSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { shadowPathFor } from "./shadows.ts";

/** macOS and Windows file systems are case-insensitive; TypeScript may report lowercased paths. */
const caseInsensitive = process.platform === "darwin" || process.platform === "win32";

export function uriToPath(uri: string): string | undefined {
  if (!uri.startsWith("file:")) return undefined;
  try {
    return fileURLToPath(uri);
  } catch {
    return undefined;
  }
}

export function pathToUri(path: string): string {
  return pathToFileURL(path).href;
}

/** A comparison key for a URI or path: the file path, lowercased on case-insensitive systems. */
export function fileKey(uriOrPath: string): string {
  const path = uriToPath(uriOrPath) ?? uriOrPath;
  return caseInsensitive ? path.toLowerCase() : path;
}

export function isStsx(uriOrPath: string): boolean {
  return /\.stsx$/i.test(uriOrPath);
}

const SHADOW_SEGMENT = /[/\\]\.lumen[/\\]shadow[/\\]/i;

/** Whether a URI or path names a shadow file. */
export function isShadow(uriOrPath: string): boolean {
  return SHADOW_SEGMENT.test(uriOrPath) && /\.stsx\.tsx$/i.test(uriOrPath);
}

/**
 * The source of a shadow URI or path, by removing `/.lumen/shadow` and the `.tsx` suffix. This
 * is a pure string transform, so it keeps the URI's encoding and casing.
 */
export function shadowToSource(uriOrPath: string): string | undefined {
  if (!isShadow(uriOrPath)) return undefined;
  return uriOrPath.replace(SHADOW_SEGMENT, (segment) => segment[0]!).slice(0, -".tsx".length);
}

/** Rewrites shadow URIs and paths embedded in text (hover markdown, diagnostic messages). */
export function rewriteShadowText(text: string): string {
  if (!/\.lumen[/\\]shadow/i.test(text)) return text;
  return text.replace(
    /([/\\])\.lumen[/\\]shadow[/\\]([^\s"'`()<>[\]]*?\.stsx)\.tsx/gi,
    (_, separator: string, rest: string) => separator + rest,
  );
}

/** Finds the Lumen project root of a file: the nearest directory with a tsconfig or package.json. */
export class Projects {
  readonly folders: readonly string[];
  readonly #roots = new Map<string, string>();

  constructor(folders: readonly string[]) {
    this.folders = folders;
  }

  rootFor(path: string): string {
    const start = dirname(path);
    const cached = this.#roots.get(start);
    if (cached !== undefined) return cached;
    let root: string | undefined;
    for (let dir = start; ; dir = dirname(dir)) {
      if (existsSync(join(dir, "tsconfig.json")) || existsSync(join(dir, "package.json"))) {
        root = dir;
        break;
      }
      if (dirname(dir) === dir) break;
    }
    root ??=
      this.folders.find((folder) => fileKey(path).startsWith(fileKey(folder) + sep)) ?? start;
    this.#roots.set(start, root);
    return root;
  }

  /** The shadow URI of an `.stsx` source URI. */
  shadowUri(sourceUri: string): string {
    const path = uriToPath(sourceUri);
    if (path === undefined) return sourceUri + ".tsx";
    return pathToUri(shadowPathFor(this.rootFor(path), path));
  }
}
