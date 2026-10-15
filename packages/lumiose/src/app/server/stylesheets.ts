// A page's stylesheet tags in builds (TASK-121): the merged file every page shares, then the page's
// own stylesheets inline or merged, as `lumiose build` grouped them (../production/stylesheets.ts).

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

/** What the server entry knows to write a page's stylesheets (`BuiltApp.styleTags`). */
export interface StyleTags {
  /** The stylesheets every page links first, merged into one file. */
  shared?: { href: string; covers: readonly string[] };
  /** A page's stylesheet URLs after `shared`, joined by spaces → their tag. */
  rest: Readonly<Record<string, string>>;
}

/**
 * A page's stylesheet tags: the shared file and the rest, or one link per stylesheet, then
 * `STYLESHEETS_LOADED` when any of them is linked.
 */
export function stylesheetTags(hrefs: readonly string[], tags: StyleTags | undefined): string {
  let html = "";
  let rest = hrefs;
  const shared = tags?.shared;
  if (shared !== undefined && shared.covers.every((href, i) => hrefs[i] === href)) {
    const covers =
      shared.covers.length > 1 ? ` data-l-css="${escapeAttr(shared.covers.join(" "))}"` : "";
    html += `<link rel="stylesheet" href="${escapeAttr(shared.href)}"${covers}>`;
    rest = hrefs.slice(shared.covers.length);
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
