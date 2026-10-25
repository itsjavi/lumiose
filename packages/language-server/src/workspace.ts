// File URIs, Lumiose project roots and the source ↔ shadow mapping (spec §9.1):
// `<root>/src/a/B.stsx` ↔ `<root>/.lumiose/shadow/src/a/B.stsx.tsx`, or in an stsx-mode project
// (./stsx-mode.ts) `<root>/src/a/B.stsx` ↔ `<root>/.lumiose/stsx/src/a/B.stsx.tsx`. A project whose tsconfig
// extends the generated `.lumiose/tsconfig.generated.json` mirrors a wider base instead (TASK-73), e.g.
// `<base>/apps/web/src/B.stsx` ↔ `<base>/apps/web/.lumiose/shadow/apps/web/src/B.stsx.tsx`.

import { existsSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { shadowLayout, shadowPathFor, sourcePathForShadow, type ShadowLayout } from "./shadows.ts";
import { isStsxProject, stsxLayout, stsxShadowPath } from "./stsx-mode.ts";

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

const SHADOW_SEGMENT = /[/\\]\.lumiose[/\\](?:shadow|stsx)[/\\]/i;

/** Whether a URI or path names a shadow file. */
export function isShadow(uriOrPath: string): boolean {
  return SHADOW_SEGMENT.test(uriOrPath) && /\.stsx\.tsx$/i.test(uriOrPath);
}

/**
 * The source of a shadow URI or path, by removing `/.lumiose/shadow` and the `.tsx` suffix. This
 * is a pure string transform, so it keeps the URI's encoding and casing.
 */
export function shadowToSource(uriOrPath: string): string | undefined {
  if (!isShadow(uriOrPath)) return undefined;
  return uriOrPath.replace(SHADOW_SEGMENT, (segment) => segment[0]!).slice(0, -".tsx".length);
}

/** Rewrites shadow URIs and paths embedded in text (hover markdown, diagnostic messages). */
export function rewriteShadowText(text: string): string {
  if (!/\.lumiose[/\\](?:shadow|stsx)/i.test(text)) return text;
  return text.replace(
    /([/\\])\.lumiose[/\\](?:shadow|stsx)[/\\]([^\s"'`()<>[\]]*?\.stsx)\.tsx/gi,
    (_, separator: string, rest: string) => separator + rest,
  );
}

/** A shadow path or URI: the project root before `/.lumiose/shadow/`, and the rest. */
const SHADOW_PATH = /^(.*?)[/\\]\.lumiose[/\\](?:shadow|stsx)[/\\](.*\.stsx)\.tsx$/i;

/** Shadow paths embedded in text: a path or `file:` URI up to a delimiter. */
const EMBEDDED_SHADOW =
  /[^\s"'`()<>[\]]+?[/\\]\.lumiose[/\\](?:shadow|stsx)[/\\][^\s"'`()<>[\]]*?\.stsx\.tsx/gi;

/** Finds the Lumiose project root of a file: the nearest directory with a tsconfig or package.json. */
export class Projects {
  readonly folders: readonly string[];
  readonly #roots = new Map<string, string>();
  readonly #layouts = new Map<string, ShadowLayout>();

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

  /** The shadow layout of a project root (from its tsconfig), cached until {@link setLayout}. */
  layoutFor(root: string): ShadowLayout {
    let layout = this.#layouts.get(root);
    if (layout === undefined) {
      try {
        layout = isStsxProject(root) ? stsxLayout(root) : shadowLayout(root);
      } catch {
        layout = { root, base: root, mirrored: join(root, "src"), packages: [], outside: [] };
      }
      this.#layouts.set(root, layout);
    }
    return layout;
  }

  /** Records a project's layout (after a full shadow sync); `undefined` forgets it. */
  setLayout(root: string, layout: ShadowLayout | undefined): void {
    if (layout === undefined) this.#layouts.delete(root);
    else this.#layouts.set(root, layout);
  }

  /** The project roots with a known layout that shadow `path` (their own or a used package's). */
  rootsShadowing(path: string): string[] {
    const roots = new Set([this.rootFor(path)]);
    for (const [root, layout] of this.#layouts) {
      if (layout.packages.some((dir) => fileKey(path).startsWith(fileKey(dir) + sep))) {
        roots.add(root);
      }
    }
    return [...roots];
  }

  /** The shadow URI of an `.stsx` source URI, in the project of the source. */
  shadowUri(sourceUri: string, root?: string): string {
    const path = uriToPath(sourceUri);
    if (path === undefined) return sourceUri + ".tsx";
    root ??= this.rootFor(path);
    if (isStsxProject(root)) return pathToUri(stsxShadowPath(root, path));
    return pathToUri(shadowPathFor(root, path, this.layoutFor(root)));
  }

  /** The source of a shadow URI or path ({@link shadowToSource} unless the project mirrors a wider base). */
  shadowToSource(uriOrPath: string): string | undefined {
    if (!isShadow(uriOrPath)) return undefined;
    const isUri = uriOrPath.startsWith("file:");
    const path = isUri ? uriToPath(uriOrPath) : uriOrPath;
    const root = path === undefined ? undefined : SHADOW_PATH.exec(path)?.[1];
    if (path === undefined || root === undefined) return undefined;
    const layout = this.#layouts.get(root) ?? this.layoutFor(root);
    if (layout.base === root) return shadowToSource(uriOrPath);
    const source = sourcePathForShadow(root, path, layout);
    return source === undefined ? undefined : isUri ? pathToUri(source) : source;
  }

  /** Rewrites shadow URIs and paths embedded in text (hover markdown, diagnostic messages). */
  rewriteShadowText(text: string): string {
    if (!/\.lumiose[/\\](?:shadow|stsx)/i.test(text)) return text;
    return text.replace(EMBEDDED_SHADOW, (match) => this.shadowToSource(match) ?? match);
  }
}
