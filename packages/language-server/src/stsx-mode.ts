// stsx mode (decision-86): a project that uses `.stsx` files through @lumiose/stsx (React, Solid…)
// without Lumiose. The same server serves it, with:
// - shadows in `.lumiose/stsx/<root-relative path>.stsx.tsx` (what `stsx typegen` and the Vite
//   plugin write, for the tsconfig's `rootDirs: [".", ".lumiose/stsx"]`), synced without writing
//   Lumiose's generated tsconfig;
// - only scanner and style diagnostics (`compileTsx`), no Lumiose runtime checks (LUM2xxx,
//   LUM4xxx), project checks or execution-contract hovers.

import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { scan, type ScanResult } from "@lumiose/compiler";
import type { ShadowLayout } from "./shadows.ts";

/** Where stsx-mode projects keep their shadows, relative to the root. */
export const STSX_SHADOW_DIR = join(".lumiose", "stsx");

const SKIPPED = new Set(["node_modules", "dist", "build", "coverage"]);
const modes = new Map<string, boolean>();

/** Whether the project at `root` uses @lumiose/stsx and not Lumiose (from its package.json). */
export function isStsxProject(root: string): boolean {
  let stsx = modes.get(root);
  if (stsx === undefined) {
    stsx = false;
    const manifest = join(root, "package.json");
    if (existsSync(manifest)) {
      try {
        const pkg = JSON.parse(readFileSync(manifest, "utf8")) as Record<string, unknown>;
        const names = new Set(
          ["dependencies", "devDependencies", "peerDependencies"].flatMap((field) =>
            Object.keys((pkg[field] as Record<string, string> | undefined) ?? {}),
          ),
        );
        stsx = names.has("@lumiose/stsx") && !names.has("lumiose");
      } catch {
        // An invalid manifest names no dependencies.
      }
    }
    modes.set(root, stsx);
  }
  return stsx;
}

/** The layout of an stsx-mode project: the root mirrored at `.lumiose/stsx`. */
export function stsxLayout(root: string): ShadowLayout {
  return { root, base: root, mirrored: root, packages: [], outside: [] };
}

/** The shadow of `path` in the stsx-mode project at `root`. */
export function stsxShadowPath(root: string, path: string): string {
  return join(root, STSX_SHADOW_DIR, relative(root, path)) + ".tsx";
}

export interface StsxShadowFile {
  source: string;
  shadow: string;
  text: string;
  scan: ScanResult;
  own: true;
}

/** Writes the shadows of `files` (default: every `.stsx` file of the project) and removes those of deleted files. */
export async function syncStsxShadows(
  root: string,
  files?: readonly string[],
): Promise<{ files: StsxShadowFile[]; layout: ShadowLayout }> {
  root = resolve(root);
  const shadowRoot = join(root, STSX_SHADOW_DIR);
  const candidates =
    files === undefined
      ? await stsxFiles(root, shadowRoot)
      : files.map((file) => resolve(root, file)).filter((file) => file.endsWith(".stsx"));
  const synced: StsxShadowFile[] = [];
  await Promise.all(
    candidates.map(async (source) => {
      const shadow = stsxShadowPath(root, source);
      const text = await readFile(source, "utf8").catch(() => undefined);
      if (text === undefined) {
        await rm(shadow, { force: true });
        return;
      }
      const scanned = scan(text, source);
      synced.push({ source, shadow, text, scan: scanned, own: true });
      const previous = await readFile(shadow, "utf8").catch(() => undefined);
      if (previous !== scanned.masked) {
        await mkdir(dirname(shadow), { recursive: true });
        await writeFile(shadow, scanned.masked);
      }
    }),
  );
  synced.sort((a, b) => (a.source < b.source ? -1 : 1));
  return { files: synced, layout: stsxLayout(root) };
}

async function stsxFiles(dir: string, shadowRoot: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED.has(entry.name) || entry.name.startsWith(".") || path === shadowRoot) continue;
      out.push(...(await stsxFiles(path, shadowRoot)));
    } else if (entry.isFile() && entry.name.endsWith(".stsx")) {
      out.push(path);
    }
  }
  return out;
}
