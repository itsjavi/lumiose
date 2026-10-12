// Fewer render-blocking stylesheets in builds (TASK-121; owner: Halo). The client build emits one
// CSS file per stylesheet module (@lumiose/vite's CSS manifest), and a page links every one its
// document, layouts and route reach: 4 to 11 files of 0.2–3 kB in the sample apps. `lumiose build`
// regroups them once the server graph is known:
//
// - The stylesheets every page links first (the longest common prefix of the pages' lists: the
//   document's, the root layouts', shared components') are merged into one file, linked by every
//   page and cached across them.
// - A page's remaining stylesheets are inlined as one `<style>` when they total at most 4 kB
//   (Vite's default `assetsInlineLimit`), else merged into one file for that list.
//
// Measured on the three sample apps (brotli, TASK-121): a first view went from 6–8 render-blocking
// requests (2.4–3.6 kB) to one request (0.9–2.0 kB) plus 0–1 kB inline, and a visit to every page
// of an app from 11–16 requests to one, for about the same bytes (4.5–5.4 kB before, 3.6–5.5 kB
// after). One merged file per page, or inlining everything, needs 9–12 kB for the same visit.
//
// Each tag lists the stylesheets it holds in `data-l-css`, so the client's preload helper does not
// link them again for an island or an SPA route (./client-runtime.ts). Merging keeps the cascade
// order: the shared prefix comes first on every page, the rest in the page's own order. Dev links
// every stylesheet on its own, for CSS HMR.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { StyleTags } from "lumiose/internal/app/server/stylesheets.ts";

export type { StyleTags };

/** Placeholder string of the server entry, replaced with the tags' JSON (./plugin.ts). */
export const STYLE_TAGS_PLACEHOLDER = "__LUMIOSE_STYLE_TAGS__";

/** Inline a page's own stylesheets up to this many bytes in total. */
const INLINE_LIMIT = 4096;

/**
 * The tags for `pages` (each route's stylesheet URLs, in cascade order) and `others` (`not-found` and
 * `error` pages, which do not narrow the shared prefix), writing the merged files to the client
 * output.
 */
export async function styleTags(
  pages: readonly (readonly string[])[],
  others: readonly (readonly string[])[],
  options: {
    clientDir: string;
    base: string;
    assetsDir: string;
    /** Called with each merged file (relative to `clientDir`), named by content hash. */
    written?: (fileName: string) => void;
  },
): Promise<StyleTags> {
  const sources = new Map<string, string>();
  const source = async (href: string): Promise<string | undefined> => {
    if (!sources.has(href)) {
      if (!href.startsWith(options.base)) return undefined;
      const file = join(options.clientDir, href.slice(options.base.length));
      if (!existsSync(file)) return undefined;
      sources.set(href, await readFile(file, "utf8"));
    }
    return sources.get(href);
  };
  const merge = async (hrefs: readonly string[], name: string): Promise<string | undefined> => {
    const parts: string[] = [];
    for (const href of hrefs) {
      const css = await source(href);
      if (css === undefined) return undefined;
      parts.push(css.endsWith("\n") ? css : `${css}\n`);
    }
    const css = parts.join("");
    const hash = createHash("sha256").update(css).digest("base64url").slice(0, 8);
    const fileName = `${options.assetsDir.replace(/\/$/, "")}/${name}-${hash}.css`;
    options.written?.(fileName);
    const target = join(options.clientDir, fileName);
    if (!existsSync(target)) {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, css);
    }
    return options.base + fileName;
  };

  const lists = pages.filter((page) => page.length > 0);
  const tags: { shared?: StyleTags["shared"]; rest: Record<string, string> } = { rest: {} };
  let prefix = commonPrefix(lists);
  if (prefix.length > 1) {
    const href = await merge(prefix, "styles");
    if (href === undefined) prefix = [];
    else tags.shared = { href, covers: prefix };
  } else if (prefix.length === 1) {
    tags.shared = { href: prefix[0]!, covers: prefix };
  }
  for (const page of [...lists, ...others]) {
    const shared = prefix.length > 0 && prefix.every((href, i) => page[i] === href);
    const rest = shared ? page.slice(prefix.length) : page;
    const key = rest.join(" ");
    if (rest.length === 0 || key in tags.rest) continue;
    const css = await Promise.all(rest.map(source));
    const covers = escapeAttr(key);
    if (css.every((text) => text !== undefined && !/<\/style/i.test(text))) {
      const text = css.join("");
      if (Buffer.byteLength(text) <= INLINE_LIMIT) {
        tags.rest[key] = `<style data-l-css="${covers}">${text}</style>`;
        continue;
      }
    }
    const href = rest.length === 1 ? rest[0] : await merge(rest, "page");
    if (href !== undefined) {
      tags.rest[key] = `<link rel="stylesheet" href="${escapeAttr(href)}" data-l-css="${covers}">`;
    }
  }
  return tags;
}

/** The longest list every page's stylesheets start with. */
function commonPrefix(lists: readonly (readonly string[])[]): string[] {
  const [first, ...others] = lists;
  if (first === undefined) return [];
  let length = first.length;
  for (const list of others) {
    let i = 0;
    while (i < length && list[i] === first[i]) i++;
    length = i;
  }
  return first.slice(0, length);
}

function escapeAttr(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}
