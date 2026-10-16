// Fewer render-blocking stylesheets in builds (TASK-121; owner: Halo). The client build emits one
// CSS file per stylesheet module (@lumiose/vite's CSS manifest), and a page links every one its
// document, layouts and route reach: 4 to 11 files of 0.2–3 kB in the sample apps. `lumiose build`
// regroups them once the server graph is known, in each page's cascade order:
//
// - The stylesheets every page links first (the longest common prefix of the pages' lists: the
//   document's, the root layouts', shared components') are merged into one file, linked by every
//   page and cached across them.
// - Then the stylesheets a group of pages continues with, such as a route group's layout and the
//   components it renders (TASK-285). Pages are grouped by the stylesheet that follows the shared
//   file; a group of three lists or more (routes with the same stylesheets count once) gets a
//   second shared file with the run all its lists continue with, when that run is larger than
//   4 kB. A smaller run is not worth a request of its own: the group's subgroups are tried instead,
//   from the same point, and the pages they leave out keep the run in their own CSS. A page links
//   at most these two shared files.
// - A page's remaining stylesheets are inlined as one `<style>` when they total at most 4 kB
//   (Vite's default `assetsInlineLimit`), else merged into one file for that list.
//
// Measured on the three sample apps (brotli, TASK-121): a first view went from 6–8 render-blocking
// requests (2.4–3.6 kB) to one request (0.9–2.0 kB) plus 0–1 kB inline, and a visit to every page
// of an app from 11–16 requests to one, for about the same bytes (4.5–5.4 kB before, 3.6–5.5 kB
// after). One merged file per page, or inlining everything, needs 9–12 kB for the same visit.
//
// Group files (TASK-285, brotli, A/B in one process): the shared file used to be the only one, so
// a single page without the site chrome (the itsjavi.com port's fullscreen editor) moved the header
// and footer CSS into every other page's merged file. On the port, a visit to its 39 pages now
// needs 8 requests and 15.3 kB instead of 12 and 29.2 kB, for 0.8 more requests on a first view
// (2.6 on average, at most 3, and 4.7 kB instead of 4.4). The sample apps and apps/web build the
// same tags as before. The rejected rules (task notes): groups of two lists (apps/web's
// docs pages would link a third file to save 0.3 kB on a visit), more group levels (up to 4
// requests), one shared file per page holding the group's whole prefix (repeats the CSS of every
// page in each group's file: 47% more than before for a visit with a 40 kB Tailwind base), and
// sharing only a run most pages use (two route groups of similar size get nothing).
//
// Each tag lists the stylesheets it holds in `data-l-css`, so the client's preload helper does not
// link them again for an island or an SPA route (./client-runtime.ts). Merging keeps the cascade
// order: a page's shared files hold the start of its own list, the rest follows in its order. Dev
// links every stylesheet on its own, for CSS HMR.
//
// Linked files do not make a reloaded page jump: the server writes a script after them that holds
// the parser until they load (STYLESHEETS_LOADED, TASK-278). Inlining more would not have fixed
// it: with the page's own CSS inlined at any size, Chrome still jumped on 5–13 of 30 reloads of the
// sample apps, since the shared file stays linked.

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  sharedStylesheets,
  type SharedStylesheets,
  type StyleTags,
} from "lumiose/internal/app/server/stylesheets.ts";

export type { StyleTags };

/** Placeholder string of the server entry, replaced with the tags' JSON (./plugin.ts). */
export const STYLE_TAGS_PLACEHOLDER = "__LUMIOSE_STYLE_TAGS__";

/** Inline a page's own stylesheets up to this many bytes in total; share a group's run above it. */
const INLINE_LIMIT = 4096;

/**
 * The fewest lists a group's file is shared by. Between two, it saves at most one download of the
 * run, for one more request on a first view of every page of both.
 */
const MIN_GROUP = 3;

/**
 * The tags for `pages` (each route's stylesheet URLs, in cascade order) and `others` (`not-found` and
 * `error` pages, which do not shape the shared files), writing the merged files to the client
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
  const shareable = async (covers: string[]): Promise<SharedStylesheets | undefined> => {
    const href = covers.length === 1 ? covers[0] : await merge(covers, "styles");
    return href === undefined ? undefined : { href, covers };
  };

  const lists = pages.filter((page) => page.length > 0);
  // A stylesheet the output does not have counts as empty: a run that holds it is not merged.
  const sizes = new Map<string, number>();
  for (const href of new Set(lists.flat())) {
    const css = await source(href);
    sizes.set(href, css === undefined ? 0 : Buffer.byteLength(css));
  }
  const runs = sharedRuns(lists, (run) => run.reduce((sum, href) => sum + sizes.get(href)!, 0));
  const tags: {
    shared?: SharedStylesheets;
    groups?: SharedStylesheets[];
    rest: Record<string, string>;
  } = { rest: {} };
  const shared = runs.shared === undefined ? undefined : await shareable(runs.shared);
  if (shared !== undefined) tags.shared = shared;
  // Group runs start after the shared file: without it, no page would link them.
  if (runs.shared === undefined || shared !== undefined) {
    for (const run of runs.groups) {
      const group = await shareable(run);
      if (group !== undefined) (tags.groups ??= []).push(group);
    }
  }
  for (const page of [...lists, ...others]) {
    const { rest } = sharedStylesheets(page, tags);
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

/**
 * The runs of stylesheets that pages share, as the top of this file describes: `shared`, the
 * stylesheets every list starts with, and `groups`, the run each group of lists continues with
 * after it. `bytes` is a run's size.
 */
export function sharedRuns(
  lists: readonly (readonly string[])[],
  bytes: (run: readonly string[]) => number,
): { shared?: string[]; groups: string[][] } {
  // Routes with the same stylesheets already share their own file.
  const distinct = [
    ...new Map(
      lists.filter((list) => list.length > 0).map((list) => [list.join(" "), list]),
    ).values(),
  ];
  const groups: string[][] = [];
  const first = distinct[0];
  if (first === undefined) return { groups };
  const start = commonLength(distinct, 0);
  const visit = (members: readonly (readonly string[])[], from: number): void => {
    for (const group of byNext(members, from)) {
      if (group.length < MIN_GROUP) continue;
      const end = commonLength(group, from);
      const run = group[0]!.slice(start, end);
      if (bytes(run) > INLINE_LIMIT) groups.push(run);
      else visit(group, end);
    }
  };
  visit(distinct, start);
  return start > 0 ? { shared: first.slice(0, start), groups } : { groups };
}

/** Where the stylesheets all `lists` have in common end, given that they share those before `from`. */
function commonLength(lists: readonly (readonly string[])[], from: number): number {
  const [first, ...others] = lists;
  let end = first!.length;
  for (const list of others) {
    let i = from;
    while (i < end && list[i] === first![i]) i++;
    end = i;
  }
  return end;
}

/** The `lists` that go on after `from`, grouped by their stylesheet there, in order. */
function byNext(lists: readonly (readonly string[])[], from: number): (readonly string[])[][] {
  const groups = new Map<string, (readonly string[])[]>();
  for (const list of lists) {
    const next = list[from];
    if (next === undefined) continue;
    const group = groups.get(next);
    if (group === undefined) groups.set(next, [list]);
    else group.push(list);
  }
  return [...groups.values()];
}

function escapeAttr(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}
