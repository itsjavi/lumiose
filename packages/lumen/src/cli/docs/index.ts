// `lumen docs [topic]` and `lumen explain <code>` (spec §10, decision-10): print and search the
// version-matched Markdown docs shipped in `lumen/docs`. Also the docs API that the MCP server's
// `docs_get` / `docs_search` tools build on (TASK-34).
//
// A topic is a docs path without `.md`: `concepts/signals`, `reference/app`, `errors/LUM1004`.
// Lookups also accept a bare name (`signals`), a code (`LUM1004`) and the older
// `diagnostics/LUM1004` form; an exported name (`fetchJSON`) prints its reference section;
// anything else is searched.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXIT_FAILURE,
  EXIT_OK,
  EXIT_PROBLEMS,
  formatEnvelope,
  type Failure,
  type OutputFormat,
} from "../output.ts";

/** The docs shipped with this version of `lumen`. */
export const DOCS_DIR = fileURLToPath(new URL("../../../docs/", import.meta.url));

export interface DocEntry {
  /** Docs path without `.md`, such as `concepts/signals`; the index is `README`. */
  topic: string;
  /** The first `#` heading. */
  title: string;
  /** The first `>` line after the title, if any. */
  summary: string | undefined;
}

export interface Doc extends DocEntry {
  content: string;
}

export interface SearchResult extends DocEntry {
  score: number;
  /** The first line that matches the query. */
  snippet: string;
}

/** Sections in reading order; topics sort by section, then by path. */
const SECTIONS = ["README", "getting-started", "concepts/", "reference/", "errors/"];

function sectionRank(topic: string): number {
  const rank = SECTIONS.findIndex((section) =>
    section.endsWith("/") ? topic.startsWith(section) : topic === section,
  );
  return rank === -1 ? SECTIONS.length : rank;
}

/** The sort key within a section: a section's README comes before its pages. */
function sortKey(topic: string): string {
  return topic.endsWith("/README") ? "" : topic;
}

function compareTopics(a: string, b: string): number {
  return sectionRank(a) - sectionRank(b) || sortKey(a).localeCompare(sortKey(b));
}

/** Every Markdown doc under `dir`, in reading order. */
export function loadDocs(dir: string = DOCS_DIR): Doc[] {
  if (!existsSync(dir)) return [];
  const topics: string[] = [];
  const walk = (prefix: string) => {
    for (const file of readdirSync(join(dir, prefix), { withFileTypes: true })) {
      if (file.isDirectory()) walk(`${prefix}${file.name}/`);
      else if (file.name.endsWith(".md")) topics.push(prefix + file.name.slice(0, -3));
    }
  };
  walk("");
  return topics
    .toSorted(compareTopics)
    .map((topic) => parseDoc(topic, readFileSync(join(dir, `${topic}.md`), "utf8")));
}

export function parseDoc(topic: string, content: string): Doc {
  const lines = content.split("\n");
  const titleIndex = lines.findIndex((line) => line.startsWith("# "));
  const title = titleIndex === -1 ? topic : stripMarkdown(lines[titleIndex]!.slice(2));
  let summary: string | undefined;
  for (const line of lines.slice(titleIndex + 1)) {
    if (line.startsWith("> ")) {
      summary = stripMarkdown(line.slice(2));
      break;
    }
    if (line.startsWith("#")) break;
  }
  return { topic, title, summary, content };
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1")
    .trim();
}

const CODE = /^(?:(?:errors|diagnostics)\/)?(lum\d{4})$/i;

/** The canonical form of a diagnostic code (`lum1004` → `LUM1004`), or undefined. */
export function diagnosticCode(text: string): string | undefined {
  return CODE.exec(text.trim())?.[1]?.toUpperCase();
}

/**
 * The doc for `query`: an exact topic, a diagnostic code, or a unique-by-priority bare name
 * (`jsx` → `concepts/jsx` before `reference/jsx`). Undefined when nothing matches exactly.
 */
export function resolveTopic(query: string, docs: readonly Doc[] = loadDocs()): Doc | undefined {
  const normalized = query
    .trim()
    .replace(/^\.?\/?(?:docs\/)?/, "")
    .replace(/\.md$/, "")
    .replace(/\/$/, "")
    .toLowerCase();
  if (normalized === "" || normalized === "index")
    return docs.find((doc) => doc.topic === "README");
  const code = diagnosticCode(normalized);
  const wanted = code === undefined ? normalized : `errors/${code}`.toLowerCase();
  const exact = docs.find((doc) => doc.topic.toLowerCase() === wanted);
  if (exact) return exact;
  if (normalized === "errors" || normalized === "diagnostics") {
    return docs.find((doc) => doc.topic === "errors/README");
  }
  // Docs are in reading order, so concepts win over reference pages of the same name.
  return docs.find((doc) => doc.topic.toLowerCase().split("/").pop() === normalized);
}

export interface ExportSection {
  /** The reference page, such as `reference/reactivity`. */
  topic: string;
  /** The section heading, such as `createContext, provide, inject`. */
  heading: string;
  /** The section's Markdown, from its heading to the next heading of the same or a higher level. */
  content: string;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * The reference section of an exported name (`signal`, `fetchJSON`, `Link`): a `##`/`###` heading
 * of a `reference/` page that lists it (`fail, ActionFailure`, `lumen()`). Case-sensitive, and
 * only for names no topic is called (`jsx` stays a topic) that one page documents.
 */
export function resolveExport(
  query: string,
  docs: readonly Doc[] = loadDocs(),
): ExportSection | undefined {
  const name = query.trim().replace(/\(\)$/, "");
  if (!IDENTIFIER.test(name)) return undefined;
  if (docs.some((doc) => doc.topic.split("/").pop() === name)) return undefined;
  const found: ExportSection[] = [];
  for (const doc of docs) {
    if (!doc.topic.startsWith("reference/")) continue;
    const lines = doc.content.split("\n");
    let fence = false;
    for (const [index, line] of lines.entries()) {
      if (line.startsWith("```")) fence = !fence;
      const heading = fence ? null : /^(#{2,3}) (.+)$/.exec(line);
      if (!heading) continue;
      const names = heading[2]!.split(",").map((part) => part.trim().replace(/^`|`$/g, ""));
      if (!names.some((candidate) => candidate.replace(/\(\)$/, "") === name)) continue;
      const level = heading[1]!.length;
      let end = index + 1;
      let inFence = false;
      for (; end < lines.length; end++) {
        if (lines[end]!.startsWith("```")) inFence = !inFence;
        const next = inFence ? null : /^(#+) /.exec(lines[end]!);
        if (next && next[1]!.length <= level) break;
      }
      found.push({
        topic: doc.topic,
        heading: heading[2]!,
        content: `${lines.slice(index, end).join("\n").trimEnd()}\n`,
      });
    }
  }
  return found.length === 1 ? found[0] : undefined;
}

/** Other topics with the same bare name as `doc` (`reference/jsx` for `concepts/jsx`). */
export function relatedTopics(doc: DocEntry, docs: readonly Doc[] = loadDocs()): string[] {
  const name = doc.topic.split("/").pop();
  return docs
    .filter((other) => other.topic !== doc.topic && other.topic.split("/").pop() === name)
    .map((other) => other.topic);
}

/** Terms of a query: whitespace-separated, without surrounding quotes or punctuation. */
function terms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/^[`'"(<[{]+|[`'",.;!?)>\]}]+$/g, ""))
    .filter((term) => term.length > 0);
}

function count(haystack: string, needle: string, cap: number): number {
  let n = 0;
  for (
    let at = haystack.indexOf(needle);
    at !== -1 && n < cap;
    at = haystack.indexOf(needle, at + 1)
  ) {
    n++;
  }
  return n;
}

/**
 * Full-text search: every term must occur in the doc. Title hits weigh most, then headings,
 * then the body (capped, so long pages do not win by length alone).
 */
export function searchDocs(
  query: string,
  docs: readonly Doc[] = loadDocs(),
  limit = 10,
): SearchResult[] {
  const words = terms(query);
  if (words.length === 0) return [];
  const results: SearchResult[] = [];
  for (const doc of docs) {
    const body = doc.content.toLowerCase();
    const title = `${doc.topic} ${doc.title}`.toLowerCase();
    const headings = doc.content
      .split("\n")
      .filter((line) => line.startsWith("#"))
      .join("\n")
      .toLowerCase();
    let score = 0;
    let all = true;
    for (const word of words) {
      const inBody = count(body, word, 10);
      if (inBody === 0 && !title.includes(word)) {
        all = false;
        break;
      }
      score += 10 * count(title, word, 2) + 4 * count(headings, word, 3) + inBody;
    }
    if (!all) continue;
    const line =
      doc.content
        .split("\n")
        .find((text) => !text.startsWith("#") && text.toLowerCase().includes(words[0]!)) ?? "";
    const snippet = stripMarkdown(line.trim().replace(/^(?:[-*>|]\s+)+/, ""));
    results.push({
      topic: doc.topic,
      title: doc.title,
      summary: doc.summary,
      score,
      snippet: snippet.length > 160 ? `${snippet.slice(0, 157)}...` : snippet,
    });
  }
  return results
    .toSorted((a, b) => b.score - a.score || compareTopics(a.topic, b.topic))
    .slice(0, limit);
}

/** Severity and category of an error page, read from its generated header. */
export function errorPageMeta(doc: Doc): { severity: string; category: string } | undefined {
  const match = /\*\*Severity:\*\* (\w+) · \*\*Category:\*\* ([^\n]+)/.exec(doc.content);
  return match ? { severity: match[1]!, category: match[2]!.trim() } : undefined;
}

// --- commands -------------------------------------------------------------------------------------

export interface DocsCommandOptions {
  /** The topic or search query; empty prints the index. */
  query: string;
  format: OutputFormat;
  write: (text: string) => void;
  writeError: (text: string) => void;
  /** Docs directory (tests). */
  dir?: string;
}

/** Writes a failure: the JSON envelope (with `payload`) on stdout, or the message on stderr. */
function fail(
  command: string,
  options: Pick<DocsCommandOptions, "format" | "write" | "writeError">,
  code: number,
  failure: Failure,
  payload: object = {},
): number {
  if (options.format === "json") {
    options.write(formatEnvelope(command, false, { ...payload, failure }));
  } else {
    options.writeError(`lumen: ${failure.message}${failure.help ? ` ${failure.help}` : ""}\n`);
  }
  return code;
}

/** A doc as printed: without HTML comments (the generated-page markers), ending in a newline. */
export function printable(content: string): string {
  return `${content
    .replace(/^<!--.*-->\n/gm, "")
    .replace(/^\n+/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()}\n`;
}

function entry(doc: DocEntry): DocEntry {
  return { topic: doc.topic, title: doc.title, summary: doc.summary };
}

/** `lumen docs [topic]`: prints a topic, or the search results for the query. */
export function docsCommand(options: DocsCommandOptions): number {
  const docs = loadDocs(options.dir);
  if (docs.length === 0) {
    return fail("docs", options, EXIT_FAILURE, {
      message: `no docs found in ${options.dir ?? DOCS_DIR}.`,
    });
  }
  const query = options.query.trim();
  if (query === "" && options.format === "json") {
    options.write(formatEnvelope("docs", true, { topics: docs.map(entry) }));
    return EXIT_OK;
  }
  const exported = resolveExport(query, docs);
  if (exported) {
    if (options.format === "json") {
      options.write(formatEnvelope("docs", true, { ...exported }));
    } else {
      options.write(exported.content);
      options.write(`\nFrom ${exported.topic}: lumen docs ${exported.topic}\n`);
    }
    return EXIT_OK;
  }
  const doc = resolveTopic(query, docs);
  if (doc) {
    const related = relatedTopics(doc, docs);
    if (options.format === "json") {
      options.write(
        formatEnvelope("docs", true, { ...entry(doc), related, content: printable(doc.content) }),
      );
    } else {
      options.write(printable(doc.content));
      if (related.length > 0) {
        options.write(`\nSee also: ${related.map((topic) => `lumen docs ${topic}`).join(", ")}\n`);
      }
    }
    return EXIT_OK;
  }
  const code = diagnosticCode(query);
  const results = code === undefined ? searchDocs(query, docs) : [];
  if (results.length === 0) {
    return fail(
      "docs",
      options,
      EXIT_PROBLEMS,
      code === undefined
        ? { message: `no docs match "${query}".`, help: "List the topics with: lumen docs" }
        : {
            message: `unknown diagnostic code ${code}.`,
            help: "List the codes with: lumen docs errors",
          },
      { query, results },
    );
  }
  if (options.format === "json") {
    options.write(formatEnvelope("docs", true, { query, results }));
    return EXIT_OK;
  }
  const width = Math.max(...results.map((result) => result.topic.length));
  options.write(`No topic "${query}". Docs that mention it:\n\n`);
  for (const result of results) {
    options.write(`  ${result.topic.padEnd(width)}  ${result.title}\n`);
    if (result.snippet) options.write(`  ${" ".repeat(width)}  ${result.snippet}\n`);
  }
  options.write(`\nPrint one with: lumen docs <topic>\n`);
  return EXIT_OK;
}

export interface ExplainCommandOptions {
  code: string;
  format: OutputFormat;
  write: (text: string) => void;
  writeError: (text: string) => void;
  dir?: string;
}

/** `lumen explain <code>`: prints the long-form explanation of a diagnostic code. */
export function explainCommand(options: ExplainCommandOptions): number {
  const code = diagnosticCode(options.code);
  if (code === undefined) {
    return fail("explain", options, EXIT_FAILURE, {
      message: `"${options.code}" is not a diagnostic code.`,
      help: "Codes look like LUM1004.",
    });
  }
  const docs = loadDocs(options.dir);
  const doc = docs.find((candidate) => candidate.topic === `errors/${code}`);
  if (!doc) {
    return fail(
      "explain",
      options,
      EXIT_PROBLEMS,
      {
        message: `unknown diagnostic code ${code}.`,
        help: "List the codes with: lumen docs errors",
      },
      { code },
    );
  }
  if (options.format === "json") {
    const meta = errorPageMeta(doc);
    options.write(
      formatEnvelope("explain", true, {
        code,
        title: doc.title.replace(/^LUM\d{4}: /, ""),
        severity: meta?.severity,
        category: meta?.category,
        topic: doc.topic,
        content: printable(doc.content),
      }),
    );
  } else {
    options.write(printable(doc.content));
  }
  return EXIT_OK;
}
