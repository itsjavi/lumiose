// A page's stylesheet tags in builds (TASK-121): the merged file every page shares, then the page's
// own stylesheets inline or merged, as `lumen build` grouped them (../production/stylesheets.ts).

import { escapeAttr } from "../../server/node.ts";

/** What the server entry knows to write a page's stylesheets (`BuiltApp.styleTags`). */
export interface StyleTags {
  /** The stylesheets every page links first, merged into one file. */
  shared?: { href: string; covers: readonly string[] };
  /** A page's stylesheet URLs after `shared`, joined by spaces → their tag. */
  rest: Readonly<Record<string, string>>;
}

/** A page's stylesheet tags: the shared file and the rest, or one link per stylesheet. */
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
  if (rest.length === 0) return html;
  const tag = tags?.rest[rest.join(" ")];
  if (tag !== undefined) return html + tag;
  for (const href of rest) html += `<link rel="stylesheet" href="${escapeAttr(href)}">`;
  return html;
}
