// @lumiose/ui's docs (decision-64): they ship in the package (`node_modules/@lumiose/ui/docs`) and
// match its own version, so `lumiose docs` and the MCP server read them from the project's install,
// below the `ui/` topic prefix (`ui/README`, `ui/dialog`). Component pages follow one template, so
// their parts, props, events and styling hooks are read from it for the MCP's `ui_components`.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Doc } from "./index.ts";

export const UI_PACKAGE = "@lumiose/ui";
/** The topic prefix of the UI pages in `lumiose docs` and the MCP. */
export const UI_PREFIX = "ui/";

/**
 * The docs directory of the @lumiose/ui installed in `root`'s `node_modules` (or a parent's), or
 * undefined. A plain lookup: `require.resolve` would also search `NODE_PATH`, which package
 * managers' bin shims set to their store, where another package's dependency may sit.
 */
export function uiDocsDir(root: string): string | undefined {
  for (let dir = root; ; dir = dirname(dir)) {
    const docs = join(dir, "node_modules", UI_PACKAGE, "docs/");
    if (existsSync(docs)) return docs;
    if (dirname(dir) === dir) return undefined;
  }
}

/** A UI docs page is a component page when it has the template's Anatomy section (decision-64). */
export function isComponentPage(doc: Doc): boolean {
  return /^## Anatomy$/m.test(doc.content);
}

export interface UiPart {
  /** `Dialog.Root`. */
  name: string;
  /** What it renders, from the Anatomy table. */
  renders: string;
}

export interface UiProp {
  part: string;
  name: string;
  type: string;
  default: string | undefined;
  description: string;
}

export interface UiEvent {
  part: string;
  /** A callback prop (`onOpenChange`) or a native event (`on:close`). */
  name: string;
  type: string | undefined;
  description: string | undefined;
}

export interface UiComponent {
  name: string;
  /** The docs topic, `ui/dialog`. */
  topic: string;
  summary: string | undefined;
  /** The import lines of the page's first code block. */
  imports: string[];
  parts: UiPart[];
  props: UiProp[];
  events: UiEvent[];
  /** Classes, attributes, selectors and custom properties the Styling section names. */
  styling: string[];
}

export interface UiCatalog {
  components: UiComponent[];
  /** The cascade layers and the default theme's custom properties, from the index and guides. */
  theme: { layers: string[]; properties: string[] };
}

/** Every component of the UI pages (topics with or without the `ui/` prefix), by name. */
export function uiCatalog(docs: readonly Doc[]): UiCatalog {
  const components = docs
    .filter(isComponentPage)
    .map(parseComponent)
    .toSorted((a, b) => a.name.localeCompare(b.name));
  // The index and the guides (Theming) name the layers and the theme's properties.
  const spans = docs
    .filter((doc) => !isComponentPage(doc))
    .flatMap((doc) => codeSpans(doc.content));
  return {
    components,
    theme: {
      layers: unique(spans.flatMap((span) => span.match(/\blu\.[a-z]+\b/g) ?? [])),
      properties: unique(spans.filter((span) => /^--lu-[\w-]+$/.test(span))),
    },
  };
}

/** The `##` section `name` of a page, without its heading. */
function section(content: string, name: string): string {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => line === `## ${name}` || line.startsWith(`## ${name} `));
  if (start === -1) return "";
  let end = start + 1;
  let fence = false;
  for (; end < lines.length; end++) {
    if (lines[end]!.startsWith("```")) fence = !fence;
    if (!fence && lines[end]!.startsWith("## ")) break;
  }
  return lines.slice(start + 1, end).join("\n");
}

/** Cells of a Markdown table row (`\|` is a pipe inside a cell). */
function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

/** `` `Root` `` → `Root`. */
function unquote(text: string): string {
  return text.replace(/^`(.*)`$/, "$1");
}

function codeSpans(markdown: string): string[] {
  const prose = markdown.replace(/^```[\s\S]*?^```/gm, "");
  return [...prose.matchAll(/`([^`\n]+)`/g)].map((match) => match[1]!);
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

/** A styling hook: a class, data attribute, selector or custom property, without spaces. */
const HOOK =
  /^(?:\.?lu-[\w-]+|data-[\w-]+(?:="[^"]*")?|--[\w-]+|::?[\w-]+(?:\(\S*\))?|\[[^\]\s]+\]|[a-z][\w-]*(?:\[[^\]\s]+\]|::?[\w-]+(?:\(\S*\))?)+)$/;

function parseComponent(doc: Doc): UiComponent {
  const name = doc.title;
  const qualify = (part: string) => (part.includes(".") ? part : `${name}.${part}`);
  const imports = (/^```ts\n([\s\S]*?)^```/m.exec(doc.content)?.[1] ?? "")
    .split("\n")
    .filter((line) => line.startsWith("import "));

  const parts: UiPart[] = [];
  for (const row of section(doc.content, "Anatomy").split("\n")) {
    if (!row.startsWith("|")) continue;
    const [part, renders] = cells(row);
    if (part === undefined || !/^`[\w.]+`$/.test(part)) continue;
    parts.push({ name: qualify(unquote(part)), renders: renders ?? "" });
  }

  const props: UiProp[] = [];
  const events: UiEvent[] = [];
  let current = name;
  for (const line of section(doc.content, "API").split("\n")) {
    const heading = /^### `?([\w.]+)`?\s*$/.exec(line);
    const bullet = /^- \*\*`([\w.]+)`\*\*/.exec(line);
    if (heading) current = qualify(heading[1]!);
    else if (bullet) current = qualify(bullet[1]!);
    if (line.startsWith("|")) {
      const [prop, type = "", fallback = "", description = ""] = cells(line);
      if (prop === undefined || !/^`[^`]+`$/.test(prop)) continue;
      const entry: UiProp = {
        part: current,
        name: unquote(prop),
        type: unquote(type),
        default: fallback === "" ? undefined : unquote(fallback),
        description,
      };
      props.push(entry);
      if (/^on[A-Z]/.test(entry.name)) {
        events.push({ part: current, name: entry.name, type: entry.type, description });
      }
    }
    for (const [, event] of line.matchAll(/`(on:[a-z]+)`/g)) {
      if (!events.some((known) => known.part === current && known.name === event)) {
        events.push({ part: current, name: event!, type: undefined, description: undefined });
      }
    }
  }

  return {
    name,
    topic: doc.topic,
    summary: doc.summary,
    imports,
    parts,
    props,
    events,
    styling: unique(codeSpans(section(doc.content, "Styling")).filter((span) => HOOK.test(span))),
  };
}
