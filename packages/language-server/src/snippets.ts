// `.stsx` snippets, offered by the server (not contributed by the editor extension) so that they
// appear only where they fit: declarations at a statement start at the module's top level, the
// island tag in JSX children. Never inside `<style>` tags or blocks, strings, comments or JSX
// tags.

import { basename } from "node:path";
import {
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
  type CompletionItem,
  type Range,
} from "vscode-languageserver";
import type { JsxStructure } from "./jsx.ts";

interface Snippet {
  prefix: string;
  description: string;
  context: "statement" | "jsx";
  /** The body; `NAME` is replaced by a component name derived from the file name. */
  body: string[];
}

const SNIPPETS: Snippet[] = [
  {
    prefix: "comp",
    description: "A component with a scoped style block",
    context: "statement",
    body: [
      "export function ${1:NAME}(props: { ${2:children?: JSX.Element} }) {",
      "\treturn (",
      '\t\t<div class="${3:root}">',
      "\t\t\t${0:{props.children\\}}",
      "\t\t\t<style>",
      "\t\t\t\t.${3:root} {",
      "\t\t\t\t\t${4:display: block;}",
      "\t\t\t\t}",
      "\t\t\t</style>",
      "\t\t</div>",
      "\t);",
      "}",
    ],
  },
  {
    prefix: "acomp",
    description: "An async component that awaits data (wrap its usage in <Suspense>)",
    context: "statement",
    body: [
      "export async function ${1:NAME}(props: { ${2:id: string} }) {",
      "\tconst ${3:data} = await fetchJSON<${4:unknown}>(`${5:/api/items/\\${props.id\\}}`);",
      "\treturn (",
      '\t\t<div class="${6:root}">',
      "\t\t\t$0",
      "\t\t\t<style>",
      "\t\t\t\t.${6:root} {",
      "\t\t\t\t}",
      "\t\t\t</style>",
      "\t\t</div>",
      "\t);",
      "}",
    ],
  },
  {
    prefix: "route",
    description: "A route page module with its render mode and a file-level style block",
    context: "statement",
    body: [
      'export const mode = "${1|static,server,spa|}";',
      "",
      "export default async function ${2:Page}() {",
      "\treturn (",
      '\t\t<main class="page">',
      "\t\t\t<h1>${3:Title}</h1>",
      "\t\t\t$0",
      "\t\t</main>",
      "\t);",
      "}",
      "",
      "<style>",
      "\t.page {",
      "\t\tmargin-inline: auto;",
      "\t}",
      "</style>",
    ],
  },
  {
    prefix: "island",
    description: "Render a component as an island (hydrated on the client)",
    context: "jsx",
    body: ["<${1:Component} client:${2|load,idle,visible,only|} $0/>"],
  },
];

/**
 * Snippet completions at `offset` of the masked TSX `text`, replacing the word typed before it;
 * none outside a snippet context.
 */
export function snippetCompletions(
  text: string,
  offset: number,
  jsx: JsxStructure,
  path: string,
  rangeOf: (start: number, end: number) => Range,
): CompletionItem[] {
  let start = offset;
  while (start > 0 && /[\w$]/.test(text[start - 1]!)) start--;
  const region = jsx.contextAt(offset);
  let context: Snippet["context"] | undefined;
  if (region?.kind === "jsx-children") context = "jsx";
  else if (region === undefined) {
    // A statement start: nothing but indentation before the word on its line.
    const line = text.lastIndexOf("\n", start - 1) + 1;
    if (/^[ \t]*$/.test(text.slice(line, start))) context = "statement";
  }
  if (context === undefined) return [];
  const name = componentName(path);
  const range = rangeOf(start, offset);
  return SNIPPETS.filter((snippet) => snippet.context === context).map((snippet) => {
    const body = snippet.body.join("\n").replace("NAME", name);
    return {
      label: snippet.prefix,
      kind: CompletionItemKind.Snippet,
      detail: snippet.description,
      documentation: {
        kind: MarkupKind.Markdown,
        value: "```stsx\n" + preview(body) + "\n```",
      },
      insertTextFormat: InsertTextFormat.Snippet,
      textEdit: { range, newText: body },
      data: { lumen: "snippet" },
    };
  });
}

/** `my-card.stsx` → `mycard`, `Card.stsx` → `Card`: the file name without non-alphanumerics. */
function componentName(path: string): string {
  const base = basename(path).replace(/\.[^.]*$/, "");
  return base.replace(/[^A-Za-z0-9]/g, "") || "Component";
}

/** The snippet's text with placeholders resolved to their defaults. */
function preview(body: string): string {
  let text = body;
  for (let previous = ""; previous !== text;) {
    previous = text;
    text = text
      .replace(/\$\{\d+\|([^,|]*)[^|]*\|\}/g, "$1")
      .replace(/\$\{\d+:((?:[^{}]|\{[^{}]*\})*)\}/g, "$1")
      .replace(/\$\d+/g, "");
  }
  return text.replace(/\\([$}\\])/g, "$1").replace(/\t/g, "  ");
}
