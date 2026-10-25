// The llms.txt files of the docs (generated next to them by packages/lumiose/scripts/gen-llms.ts),
// served at the site root, @lumiose/ui's (packages/ui/scripts/gen-llms.ts, decision-64), served
// at /ui, and @lumiose/stsx's (packages/stsx/scripts/gen-llms.ts), served at /stsx. llms.txt links
// the docs by their Markdown paths; here they point at the site's pages.
// llms-full.txt is served as generated.

import llms from "../../../../packages/lumiose/docs/llms.txt?raw";
import llmsFull from "../../../../packages/lumiose/docs/llms-full.txt?raw";
import stsxLlms from "../../../../packages/stsx/docs/llms.txt?raw";
import stsxLlmsFull from "../../../../packages/stsx/docs/llms-full.txt?raw";
import uiLlms from "../../../../packages/ui/docs/llms.txt?raw";
import uiLlmsFull from "../../../../packages/ui/docs/llms-full.txt?raw";
import { docHref } from "./docs.ts";

/**
 * llms.txt with `](concepts/signals.md)` links rewritten to the pages' URLs; `from` is the topic
 * the links are relative to (`ui/README` for the UI's).
 */
export function llmsText(text: string = llms, from = "README"): string {
  return text.replace(
    /\]\(([^)\s]+\.md(?:#[^)\s]*)?)\)/g,
    (_, href: string) => `](${docHref(href, from)})`,
  );
}

export function llmsFullText(): string {
  return llmsFull;
}

export function uiLlmsText(): string {
  return llmsText(uiLlms, "ui/README");
}

export function uiLlmsFullText(): string {
  return uiLlmsFull;
}

export function stsxLlmsText(): string {
  return llmsText(stsxLlms, "stsx/README");
}

export function stsxLlmsFullText(): string {
  return stsxLlmsFull;
}
