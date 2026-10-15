// The docs content layer: the version-matched Markdown of `packages/lumiose/docs` (the single source
// that `lumiose docs` prints and the package ships), rendered for /docs. @lumiose/ui ships its own
// docs (`packages/ui/docs`, decision-64): they are the /ui section (TASK-387), in the order of their
// llms.txt, with topics below `ui/` (`ui/dialog`), and also fill the docs index's UI section. Their
// `tsx check` examples carry the id of their live demo (./ui-demos.ts).
//
// This is the only module that knows the docs are Markdown files read through Vite: it loads them
// as raw strings with `import.meta.glob(…, { query: "?raw" })` and renders them with `marked`.
// Pages, endpoints and tests use the API below, so moving to `.md` imports (decision-22, TASK-69)
// only changes this file. Server-only in practice: the search island gets the prebuilt
// `search.json` index instead, so `marked` never reaches the browser.

import { highlight } from "@lumiose/site-kit/highlight";
import { href as routeHref } from "lumiose";
import { Marked, Renderer, type Token, type Tokens } from "marked";
import uiIndex from "../../../../packages/ui/docs/llms.txt?raw";
import { link } from "../lib/site.ts";
import { isCheckedTsx, uiDemos } from "./ui-demos.ts";

const sources = import.meta.glob<string>("../../../../packages/lumiose/docs/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});
const DOCS_DIR = "../../../../packages/lumiose/docs/";
const uiSources = import.meta.glob<string>("../../../../packages/ui/docs/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});
const UI_DOCS_DIR = "../../../../packages/ui/docs/";
/** The UI pages link Lumiose's pages by their URLs on this site (they ship in another package). */
const SITE_DOCS = "https://itsjavi.com/lumiose/docs/";
/** …and Lumiose's pages link the UI section by its URL. */
const SITE_UI = "https://itsjavi.com/lumiose/ui/";

export interface DocHeading {
  depth: 2 | 3;
  id: string;
  text: string;
}

/**
 * A run of rendered Markdown, a code block (rendered by the kit's CodeBlock, with copy), or the
 * default theme's palette (after the table of its custom properties, on a UI page).
 */
export type DocBlock =
  | { kind: "html"; html: string }
  | {
      kind: "code";
      code: string;
      lang: string;
      title?: string;
      /** A UI page's example with a live demo: its id (`dialog-1`) and whether it is an island. */
      demo?: { id: string; island: boolean };
    }
  | { kind: "palette" };

export interface DocPage {
  /** The docs path without `.md`: `concepts/signals`, `errors/LUM1001`, `README`. */
  topic: string;
  /**
   * The URL path below /docs (`concepts/signals`, `errors/LUM1001`), or below /ui for a UI page
   * (`dialog`); "" for an index.
   */
  path: string;
  /** The site URL (base included). */
  url: string;
  /** The first `#` heading, as plain text. */
  title: string;
  /** The label in the navigation (the index's link text, else the title). */
  label: string;
  /** The page's one-line summary (its first `>` quote), as plain text. */
  summary: string;
  /** The summary as inline HTML (code spans and links kept). */
  summaryHtml: string;
  /** The navigation section: Start here, Concepts, Reference or Diagnostics; Overview or Components. */
  section: string;
  blocks: DocBlock[];
  /** `##` and `###` headings, for the table of contents. */
  headings: DocHeading[];
  /** Plain text of the page, for search. */
  text: string;
}

export interface NavSection {
  title: string;
  pages: DocPage[];
}

const DIAGNOSTICS = "Diagnostics";

interface Collection {
  pages: DocPage[];
  byPath: Map<string, DocPage>;
}

let cache: { docs: Collection; ui: Collection; nav: NavSection[] } | undefined;

function load() {
  if (cache !== undefined) return cache;
  const texts = new Map<string, string>();
  for (const [file, text] of Object.entries(sources)) {
    texts.set(file.slice(DOCS_DIR.length, -".md".length), text);
  }
  for (const [file, text] of Object.entries(uiSources)) {
    texts.set(`ui/${file.slice(UI_DOCS_DIR.length, -".md".length)}`, text);
  }
  const index = texts.get("README");
  if (index === undefined) throw new Error(`No docs index at ${DOCS_DIR}README.md.`);

  // The UI's llms.txt gives its reading order: the overview and guides, then the components.
  const ui = collect(
    texts,
    readOutline(uiIndex).flatMap((section) =>
      section.entries.map((entry) => ({
        topic: `ui/${entry.topic}`,
        section: section.title,
        label: entry.topic === "README" ? "Introduction" : entry.label,
      })),
    ),
  );

  // The index's sections give the reading order and the navigation labels. Its UI section links
  // the UI's llms.txt: there the navigation lists the UI pages, at their /ui URLs.
  const outline = readOutline(index);
  const placed = new Set(outline.flatMap((section) => section.entries.map((entry) => entry.topic)));
  const diagnostics = [...texts.keys()]
    .filter((topic) => topic.startsWith("errors/") && !placed.has(topic))
    .toSorted();
  const docs = collect(texts, [
    { topic: "README", section: "Start here", label: "Overview" },
    ...outline.flatMap((section) =>
      section.entries.map((entry) => ({ ...entry, section: section.title })),
    ),
    ...diagnostics.map((topic) => ({ topic, section: DIAGNOSTICS })),
  ]);

  const nav: NavSection[] = [];
  for (const page of docs.pages) {
    const last = nav.at(-1);
    if (last?.title === page.section) last.pages.push(page);
    else nav.push({ title: page.section, pages: [page] });
  }
  const at = outline.findIndex((section) => section.title === "UI");
  if (at !== -1) {
    const after = [...outline.slice(at + 1).map((section) => section.title), DIAGNOSTICS];
    const before = nav.findIndex((section) => after.includes(section.title));
    nav.splice(before === -1 ? nav.length : before, 0, { title: "UI", pages: [...ui.pages] });
  }
  cache = { docs, ui, nav };
  return cache;
}

function collect(
  texts: ReadonlyMap<string, string>,
  order: readonly { topic: string; section: string; label?: string }[],
): Collection {
  const pages: DocPage[] = [];
  for (const { topic, section, label } of order) {
    const text = texts.get(topic);
    if (text === undefined || pages.some((page) => page.topic === topic)) continue;
    pages.push(renderDoc(topic, text, section, label));
  }
  return { pages, byPath: new Map(pages.map((page) => [page.path, page])) };
}

/** Every docs page, in reading order (the index's order, then the diagnostics by code). */
export function docPages(): readonly DocPage[] {
  return load().docs.pages;
}

/** The page at a URL path below /docs (`""` is the index). */
export function findDoc(path: string): DocPage | undefined {
  return load().docs.byPath.get(path.replace(/^\/+|\/+$/g, ""));
}

/** The docs navigation: the index's sections, the UI pages included. */
export function docNav(): readonly NavSection[] {
  return load().nav;
}

/** Every page of the /ui section (packages/ui/docs), in the order of the UI's llms.txt. */
export function uiPages(): readonly DocPage[] {
  return load().ui.pages;
}

/** The UI page at a URL path below /ui (`""` is the introduction). */
export function findUiPage(path: string): DocPage | undefined {
  return load().ui.byPath.get(path.replace(/^\/+|\/+$/g, ""));
}

/** The /ui navigation: the UI's llms.txt sections (Overview, Components). */
export function uiNav(): readonly NavSection[] {
  const nav: NavSection[] = [];
  for (const page of uiPages()) {
    const last = nav.at(-1);
    if (last?.title === page.section) last.pages.push(page);
    else nav.push({ title: page.section, pages: [page] });
  }
  return nav;
}

/** The pages before and after `page` in reading order, in its own section of the site. */
export function adjacentDocs(page: DocPage): { prev?: DocPage; next?: DocPage } {
  const pages = isUiTopic(page.topic) ? uiPages() : docPages();
  const at = pages.indexOf(page);
  return { prev: pages[at - 1], next: pages[at + 1] };
}

/** The diagnostic codes with a page (`LUM1001`, …), for the /errors/LUMxxxx redirects. */
export function diagnosticCodes(): string[] {
  return docPages()
    .map((page) => /^errors\/(LUM\d{4})$/.exec(page.topic)?.[1])
    .filter((code) => code !== undefined);
}

// --- The index outline -------------------------------------------------------------------------

interface OutlineSection {
  title: string;
  entries: { topic: string; label: string }[];
}

/** `## Section` headings with `- [Label](topic.md): …` items, in order (sections may be empty). */
export function readOutline(index: string): OutlineSection[] {
  const sections: OutlineSection[] = [];
  for (const line of index.split("\n")) {
    const heading = /^## (.+)$/.exec(line);
    if (heading) {
      sections.push({ title: heading[1]!.trim(), entries: [] });
      continue;
    }
    const item = /^- \[([^\]]+)\]\(([^)#]+)\.md\)/.exec(line);
    if (item && sections.length > 0) {
      sections.at(-1)!.entries.push({ topic: item[2]!, label: plain(item[1]!) });
    }
  }
  return sections;
}

// --- Rendering ---------------------------------------------------------------------------------

function isUiTopic(topic: string): boolean {
  return topic === "ui" || topic.startsWith("ui/");
}

/**
 * URL path of a topic, below /docs (`README` → "", `errors/README` → `errors`), or below /ui for a
 * UI topic (`ui/README` → "", `ui/dialog` → `dialog`).
 */
export function topicPath(topic: string): string {
  const path = isUiTopic(topic) ? topic.replace(/^ui\/?/, "") : topic;
  return path === "README" ? "" : path.replace(/\/README$/, "");
}

/** The site URL of a topic, with an optional `#hash`. */
export function topicUrl(topic: string, hash = ""): string {
  const path = topicPath(topic);
  return (
    (isUiTopic(topic)
      ? routeHref("/ui/[[...path]]", { path })
      : routeHref("/docs/[[...path]]", { path })) + hash
  );
}

/**
 * Rewrites a link of a page: a relative `.md` link becomes the site URL of that topic (keeping
 * its `#hash`); other links are left alone.
 */
export function docHref(href: string, from: string): string {
  if (href.startsWith(SITE_DOCS)) {
    const [path = "", hash] = href.slice(SITE_DOCS.length).split("#");
    return topicUrl(path.replace(/\/$/, "") || "README", hash === undefined ? "" : `#${hash}`);
  }
  if (href.startsWith(SITE_UI)) {
    const [path = "", hash] = href.slice(SITE_UI.length).split("#");
    if (path.endsWith(".txt")) return link(`/ui/${path}`);
    return topicUrl(
      `ui/${path.replace(/\/$/, "") || "README"}`,
      hash === undefined ? "" : `#${hash}`,
    );
  }
  if (/^[a-z][a-z0-9+.-]*:|^\/\/|^#/i.test(href)) return href;
  const match = /^([^#?]*?)\.md(#.*)?$/.exec(href);
  if (match === null) return href;
  const parts = from.split("/").slice(0, -1);
  for (const segment of match[1]!.split("/")) {
    if (segment === "..") parts.pop();
    else if (segment !== "." && segment !== "") parts.push(segment);
  }
  return topicUrl(parts.join("/"), match[2] ?? "");
}

/** GitHub's heading anchors: lowercase, punctuation dropped, spaces to hyphens. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s/g, "-");
}

/** Markdown inline syntax to plain text (titles, summaries, labels). */
function plain(markdown: string): string {
  return markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_]/g, "")
    .trim();
}

const headingIds = new WeakMap<Tokens.Heading, string>();
let currentTopic = "README";
const defaults = new Renderer();

const markdown = new Marked({
  gfm: true,
  renderer: {
    heading(token) {
      const inner = this.parser.parseInline(token.tokens);
      const id = headingIds.get(token);
      if (id === undefined) return `<h${token.depth}>${inner}</h${token.depth}>\n`;
      return `<h${token.depth} id="${id}"><a class="anchor" href="#${id}" aria-label="Link to this section">#</a>${inner}</h${token.depth}>\n`;
    },
    link(token) {
      const href = docHref(token.href, currentTopic);
      const inner = this.parser.parseInline(token.tokens);
      const external = /^https?:/i.test(href);
      return `<a href="${escapeAttr(href)}"${external ? ' rel="noopener"' : ""}>${inner}</a>`;
    },
    table(token) {
      // Wide reference tables scroll on their own instead of widening the page. The scroll box is a
      // focusable, named region, so keyboard users can scroll it too (WCAG 2.1.1).
      const columns = token.header.map((cell) => cell.text.replaceAll("`", "")).join(", ");
      return `<div class="table" role="region" tabindex="0" aria-label="${escapeAttr(`Table: ${columns}`)}">${defaults.table.call(this, token)}</div>\n`;
    },
    code(token) {
      // Top-level code blocks become CodeBlocks (renderDoc); these are nested ones (in lists).
      const lang = (token.lang ?? "").split(/\s+/)[0] || "text";
      return `<pre class="nested-code"><code class="language-${escapeAttr(lang)}">${highlight(token.text, lang)}</code></pre>\n`;
    },
    blockquote(token) {
      const body = this.parser.parse(token.tokens);
      const status = /^\s*<p><strong>Status:<\/strong>/.test(body);
      return `<blockquote${status ? ' class="status"' : ""}>\n${body}</blockquote>\n`;
    },
  },
});

function renderDoc(topic: string, source: string, section: string, label?: string): DocPage {
  // Generated pages carry HTML comments (generator notes and markers).
  const tokens = markdown.lexer(source.replace(/<!--[\s\S]*?-->\n?/g, ""));
  let title = topic;
  let summary = "";
  let summaryHtml = "";
  const headings: DocHeading[] = [];
  const used = new Map<string, number>();
  const body: Token[] = [];
  let beforeSections = true;
  for (const token of tokens) {
    if (token.type === "heading" && token.depth === 1 && title === topic) {
      title = plain(token.text);
      continue;
    }
    if (token.type === "heading" && token.depth >= 2) beforeSections = false;
    // The first quote before any section is the page's summary (the lead).
    if (token.type === "blockquote" && beforeSections && summary === "") {
      const quote = token.text.replace(/\n/g, " ");
      summary = plain(quote);
      currentTopic = topic;
      summaryHtml = markdown.parseInline(quote) as string;
      continue;
    }
    if (token.type === "heading" && (token.depth === 2 || token.depth === 3)) {
      const base = slugify(plain(token.text));
      const count = used.get(base) ?? 0;
      used.set(base, count + 1);
      const id = count === 0 ? base : `${base}-${count}`;
      headingIds.set(token as Tokens.Heading, id);
      headings.push({ depth: token.depth, id, text: plain(token.text) });
    }
    body.push(token);
  }

  currentTopic = topic;
  const blocks: DocBlock[] = [];
  let run: Token[] = [];
  const flush = () => {
    if (run.length === 0) return;
    blocks.push({
      kind: "html",
      html: markdown.parser(Object.assign(run, { links: tokens.links })),
    });
    run = [];
  };
  // A UI page's examples that have a live demo, and their count among its `tsx check` blocks.
  const ui = isUiTopic(topic);
  const name = topic.slice("ui/".length);
  const demos = new Map(ui ? uiDemos(name, source).map((demo) => [demo.id, demo.island]) : []);
  let examples = 0;
  for (const token of body) {
    if (token.type !== "code") {
      run.push(token);
      // The default theme's palette follows the table of its custom properties.
      if (ui && token.type === "table" && token.raw.includes("`--lu-background`")) {
        flush();
        blocks.push({ kind: "palette" });
      }
      continue;
    }
    flush();
    const code = token as Tokens.Code;
    const [lang = "text", ...meta] = (code.lang ?? "").split(/\s+/).filter(Boolean);
    const file = meta.find((part) => part.startsWith("file="))?.slice("file=".length);
    const id = ui && isCheckedTsx(code.lang) ? `${name}-${++examples}` : "";
    const island = demos.get(id);
    blocks.push({
      kind: "code",
      code: code.text,
      lang,
      ...(file ? { title: file } : {}),
      ...(island === undefined ? {} : { demo: { id, island } }),
    });
  }
  flush();

  return {
    topic,
    path: topicPath(topic),
    url: topicUrl(topic),
    title,
    label: label ?? title,
    summary,
    summaryHtml,
    section,
    blocks,
    headings,
    text: searchText(body),
  };
}

/** The page's words: text of every token, code included (API names are search terms). */
function searchText(tokens: readonly Token[]): string {
  const parts: string[] = [];
  const visit = (list: readonly Token[]) => {
    for (const token of list) {
      if (token.type === "code") parts.push(token.text);
      else if ("tokens" in token && Array.isArray(token.tokens)) visit(token.tokens);
      else if (token.type === "table") {
        const table = token as Tokens.Table;
        for (const cell of [...table.header, ...table.rows.flat()]) visit(cell.tokens);
      } else if (token.type === "list") {
        for (const item of (token as Tokens.List).items) visit(item.tokens);
      } else if ("text" in token && typeof token.text === "string") parts.push(token.text);
    }
  };
  visit(tokens);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
