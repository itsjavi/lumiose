// A page's stylesheet tags in builds (TASK-121): the merged files pages share, then the page's own
// stylesheets inline or merged, as `lumiose build` grouped them (../production/stylesheets.ts).

import { escapeAttr } from "../../server/node.ts";

/**
 * Written after a page's linked stylesheets (TASK-278). The parser runs a parser-inserted script
 * only once the stylesheets before it have loaded, so it parses the body with the page's CSS.
 * Without it, Chrome can lay out the unstyled body when parsing ends, restore a reloaded page's
 * scroll position from that layout, and paint the first frames at the wrong place until `load`.
 * Rendering waits for the stylesheets either way. The script must not be empty: an empty one is
 * skipped and does not wait.
 */
export const STYLESHEETS_LOADED = "<script>/* waits for the stylesheets above */</script>";

/** A file of stylesheets that several pages link, in their cascade order. */
export interface SharedStylesheets {
  href: string;
  /** The stylesheet URLs it holds, in order; never empty. */
  covers: readonly string[];
}

/** What the server entry knows to write a page's stylesheets (`BuiltApp.styleTags`). */
export interface StyleTags {
  /** The stylesheets every page links first, merged into one file. */
  shared?: SharedStylesheets;
  /**
   * The stylesheets a group of pages links next, such as a route group's layout (TASK-285): a page
   * links the one its stylesheets continue with, if any. No two can match the same page.
   */
  groups?: readonly SharedStylesheets[];
  /** A page's stylesheet URLs after the shared files, joined by spaces → their tag. */
  rest: Readonly<Record<string, string>>;
}

/**
 * The shared files a page links, in order (`shared`, then a group's), and its stylesheets after
 * them. The build groups each page's own stylesheets with it too, so both agree.
 */
export function sharedStylesheets(
  hrefs: readonly string[],
  tags: StyleTags | undefined,
): { files: SharedStylesheets[]; rest: readonly string[] } {
  const files: SharedStylesheets[] = [];
  let start = 0;
  const shared = tags?.shared;
  if (shared !== undefined && holds(hrefs, start, shared)) {
    files.push(shared);
    start += shared.covers.length;
  }
  const group = tags?.groups?.find((file) => holds(hrefs, start, file));
  if (group !== undefined) {
    files.push(group);
    start += group.covers.length;
  }
  return { files, rest: start === 0 ? hrefs : hrefs.slice(start) };
}

/** Whether `hrefs` continue at `start` with every stylesheet `file` holds. */
function holds(hrefs: readonly string[], start: number, file: SharedStylesheets): boolean {
  return file.covers.every((href, i) => hrefs[start + i] === href);
}

/**
 * A page's stylesheet tags: the shared files and the rest, or one link per stylesheet, then
 * `STYLESHEETS_LOADED` when any of them is linked.
 */
export function stylesheetTags(hrefs: readonly string[], tags: StyleTags | undefined): string {
  let html = "";
  const { files, rest } = sharedStylesheets(hrefs, tags);
  for (const file of files) {
    const covers =
      file.covers.length > 1 ? ` data-l-css="${escapeAttr(file.covers.join(" "))}"` : "";
    html += `<link rel="stylesheet" href="${escapeAttr(file.href)}"${covers}>`;
  }
  let linked = html !== "";
  if (rest.length > 0) {
    const tag = tags?.rest[rest.join(" ")];
    if (tag !== undefined) {
      html += tag;
      linked ||= tag.startsWith("<link");
    } else {
      for (const href of rest) html += `<link rel="stylesheet" href="${escapeAttr(href)}">`;
      linked = true;
    }
  }
  return linked ? html + STYLESHEETS_LOADED : html;
}
