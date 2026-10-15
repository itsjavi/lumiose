// Stylesheets that another plugin renamed after Lumiose recorded them (TASK-342). The CSS manifest
// (@lumiose/vite) records each stylesheet's CSS assets in the client build's `generateBundle`; a
// plugin whose own `generateBundle` runs later may still rewrite an asset under a new hash and
// delete the old one (StyleX appends its rules to one CSS file that way), which would leave pages
// linking a file the output does not contain. `lumiose build` compares the client bundle's CSS
// before the plugins' `generateBundle` hooks with the final output, and links the renamed files.

import type { Rollup } from "vite";

/** The CSS of a client bundle at one point: its CSS assets (with their names), and each chunk's. */
export interface CssSnapshot {
  /** File name → the asset's `names` (the `name` it was emitted with). */
  assets: Map<string, readonly string[]>;
  chunks: Map<string, readonly string[]>;
}

export function snapshotCss(bundle: Rollup.OutputBundle): CssSnapshot {
  const assets = new Map<string, readonly string[]>();
  const chunks = new Map<string, readonly string[]>();
  for (const file of Object.values(bundle)) {
    if (file.type === "asset") {
      if (file.fileName.endsWith(".css")) assets.set(file.fileName, file.names);
    } else {
      const css = file.viteMetadata?.importedCss;
      if (css !== undefined && css.size > 0) chunks.set(file.fileName, [...css]);
    }
  }
  return { assets, chunks };
}

/**
 * The CSS assets of `before` missing from `after`, mapped to the files that replaced them, by the
 * best evidence first: a chunk that imported the old file now imports the new one (paired in order
 * when it swapped several), the new asset was emitted under the old one's name (StyleX does both),
 * or it is the one CSS asset added to the bundle. Files none of these explain are left out.
 */
export function cssRenames(before: CssSnapshot, after: CssSnapshot): Map<string, string> {
  const renames = new Map<string, string>();
  const isNew = (file: string) => after.assets.has(file) && !before.assets.has(file);
  const removed = [...before.assets.keys()].filter((file) => !after.assets.has(file));
  const added = [...after.assets.keys()].filter(isNew);
  for (const [chunk, old] of before.chunks) {
    const now = after.chunks.get(chunk);
    if (now === undefined) continue;
    const gone = old.filter((file) => !now.includes(file) && !after.assets.has(file));
    const replacing = now.filter((file) => !old.includes(file) && isNew(file));
    if (gone.length === 0) continue;
    if (replacing.length === gone.length) {
      gone.forEach((file, i) => renames.set(file, replacing[i]!));
    } else if (replacing.length === 1) {
      for (const file of gone) renames.set(file, replacing[0]!);
    }
  }
  for (const file of removed) {
    if (renames.has(file)) continue;
    const name = before.assets.get(file)![0];
    const named = added.filter((each) => name !== undefined && after.assets.get(each)![0] === name);
    if (named.length === 1) renames.set(file, named[0]!);
    else if (added.length === 1) renames.set(file, added[0]!);
  }
  return renames;
}
