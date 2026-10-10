// The llms.txt files of the docs (generated next to them by packages/lumiose/scripts/gen-llms.ts),
// served at the site root. llms.txt links the docs by their Markdown paths; here they point at the
// site's pages. llms-full.txt is served as generated.

import llms from "../../../../packages/lumiose/docs/llms.txt?raw";
import llmsFull from "../../../../packages/lumiose/docs/llms-full.txt?raw";
import { docHref } from "./docs.ts";

/** llms.txt with `](concepts/signals.md)` links rewritten to the pages' URLs. */
export function llmsText(text: string = llms): string {
  return text.replace(
    /\]\(([^)\s]+\.md(?:#[^)\s]*)?)\)/g,
    (_, href: string) => `](${docHref(href, "README")})`,
  );
}

export function llmsFullText(): string {
  return llmsFull;
}
