// The llms.txt files of the docs (generated next to them by packages/lumen/scripts/gen-llms.ts),
// served at the site root. llms.txt links the docs by their Markdown paths; here they point at the
// site's pages. llms-full.txt is served as generated.

import llms from "../../../../packages/lumen/docs/llms.txt?raw";
import llmsFull from "../../../../packages/lumen/docs/llms-full.txt?raw";
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
