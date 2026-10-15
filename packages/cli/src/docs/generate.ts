// Generated docs (TASK-32): the `errors/LUMxxxx.md` pages from the compiler's diagnostics registry,
// and `llms.txt` / `llms-full.txt` from the docs index. Pure functions over file contents, so the
// scripts (`scripts/gen-error-docs.ts`, `scripts/gen-llms.ts`) write them and a test checks that
// the committed files are current.
//
// An error page has a generated header (code, title, severity, category) and a hand-written body
// below `END_MARKER`, which regeneration keeps. A code without a page gets a stub body.

import type { Doc } from "./index.ts";
import { isComponentPage } from "./ui.ts";

/** The single source of truth for diagnostic codes (spec §5.4). */
export const REGISTRY_PATH = "crates/lumiose_compiler/src/diagnostics/registry.rs";

export interface RegistryEntry {
  /** `LUM1004`. */
  id: string;
  /** The Rust variant name, such as `UnclosedStyle`. */
  variant: string;
  severity: string;
  title: string;
  /** The range comment above the entry, such as `1xxx file format`. */
  category: string;
}

const ENTRY = /^\s*(\w+)\s*=\s*"(LUM\d{4})",\s*(\w+),\s*"((?:[^"\\]|\\.)*)";/;
const CATEGORY = /^\s*\/\/\s*(\d)xxx\s+(.+?)\s*$/;

/** Reads the entries of the `registry! { … }` table in `registry.rs`. */
export function parseRegistry(source: string): RegistryEntry[] {
  const start = source.indexOf("registry! {");
  if (start === -1) throw new Error(`No "registry! {" table in ${REGISTRY_PATH}.`);
  const end = source.indexOf("\n}", start);
  const entries: RegistryEntry[] = [];
  let category = "";
  for (const line of source.slice(start, end).split("\n")) {
    const range = CATEGORY.exec(line);
    if (range) {
      category = `${range[2]} (${range[1]}xxx)`;
      continue;
    }
    const match = ENTRY.exec(line);
    if (match) {
      entries.push({
        variant: match[1]!,
        id: match[2]!,
        severity: match[3]!.toLowerCase(),
        title: match[4]!.replace(/\\(.)/g, "$1"),
        category,
      });
    }
  }
  if (entries.length === 0) throw new Error(`The registry table in ${REGISTRY_PATH} is empty.`);
  return entries;
}

export const START_MARKER =
  "<!-- Generated from crates/lumiose_compiler/src/diagnostics/registry.rs by packages/lumiose/scripts/gen-error-docs.ts. Edit the explanation below the end marker. -->";
export const END_MARKER = "<!-- end of generated header -->";

function header(entry: RegistryEntry): string {
  return [
    START_MARKER,
    "",
    `# ${entry.id}: ${entry.title}`,
    "",
    `**Severity:** ${entry.severity} · **Category:** ${entry.category}`,
    "",
    END_MARKER,
  ].join("\n");
}

function stub(entry: RegistryEntry): string {
  return [
    "",
    `> ${entry.title}.`,
    "",
    "## What it means",
    "",
    "Not documented yet.",
    "",
    "## How to fix it",
    "",
    "Not documented yet.",
    "",
  ].join("\n");
}

/** The page for `entry`, keeping the hand-written body of `existing`. */
export function renderErrorPage(entry: RegistryEntry, existing: string | undefined): string {
  const at = existing?.indexOf(END_MARKER) ?? -1;
  const body = at === -1 ? stub(entry) : existing!.slice(at + END_MARKER.length);
  return header(entry) + body;
}

/** `errors/README.md`: every code by category, fully generated. */
export function renderErrorIndex(entries: readonly RegistryEntry[]): string {
  const lines = [
    START_MARKER,
    "",
    "# Diagnostics",
    "",
    "> Every `LUMxxxx` code the Lumiose tools report, with its long-form explanation.",
    "",
    "Codes are stable forever and never reused. Print one with `lumiose explain LUM1004`, or open",
    "`errors/LUM1004.md`. Each diagnostic carries `{ code, severity, message, span, labels, help,",
    "fix?, docs }`; `lumiose check --format json` prints them.",
  ];
  const categories = [...new Set(entries.map((entry) => entry.category))];
  for (const category of categories) {
    const rows = entries
      .filter((entry) => entry.category === category)
      .map((entry) => [`[${entry.id}](${entry.id}.md)`, entry.severity, entry.title]);
    const name = category.charAt(0).toUpperCase() + category.slice(1);
    lines.push("", `## ${name}`, "", ...table(["Code", "Severity", "Title"], rows));
  }
  return `${lines.join("\n")}\n`;
}

/** A Markdown table with aligned columns, as oxfmt prints it (so formatting keeps it current). */
function table(head: string[], rows: string[][]): string[] {
  const widths = head.map((cell, column) =>
    Math.max(cell.length, ...rows.map((row) => row[column]!.length)),
  );
  const line = (cells: string[]) =>
    `| ${cells.map((cell, column) => cell.padEnd(widths[column]!)).join(" | ")} |`;
  return [line(head), line(widths.map((width) => "-".repeat(width))), ...rows.map(line)];
}

export interface GeneratedFiles {
  /** Docs-relative path → content. */
  files: Map<string, string>;
  /** Docs-relative error pages that no registry entry generates. */
  orphans: string[];
}

/**
 * The generated error docs. `existing` holds the current docs-relative files under `errors/`
 * (path → content), so hand-written bodies survive.
 */
export function generateErrorDocs(
  registry: string,
  existing: ReadonlyMap<string, string>,
): GeneratedFiles {
  const entries = parseRegistry(registry);
  const files = new Map<string, string>();
  for (const entry of entries) {
    const path = `errors/${entry.id}.md`;
    files.set(path, renderErrorPage(entry, existing.get(path)));
  }
  files.set("errors/README.md", renderErrorIndex(entries));
  const orphans = [...existing.keys()].filter((path) => !files.has(path)).toSorted();
  return { files, orphans };
}

// --- llms.txt ---------------------------------------------------------------------------------

interface IndexSection {
  heading: string;
  links: { title: string; path: string; description: string | undefined }[];
}

const LINK = /^\s*[-*]\s+\[([^\]]+)\]\(([^)]+\.md|https?:[^)\s]+)\)(?:\s*(?::|—|-)\s*(.+))?$/;

/**
 * The `## Section` → `- [Title](path): description` lists of the docs index. A link is a docs
 * path, or an absolute URL (another package's docs, such as @lumiose/ui's llms.txt).
 */
export function parseIndex(readme: string): IndexSection[] {
  const sections: IndexSection[] = [];
  for (const line of readme.split("\n")) {
    if (line.startsWith("## ")) {
      sections.push({ heading: line.slice(3).trim(), links: [] });
      continue;
    }
    const match = LINK.exec(line);
    if (match && sections.length > 0) {
      sections.at(-1)!.links.push({
        title: match[1]!,
        path: match[2]!.replace(/^\.\//, ""),
        description: match[3]?.trim(),
      });
    }
  }
  return sections.filter((section) => section.links.length > 0);
}

/**
 * `llms.txt` (llmstxt.org) and `llms-full.txt` for the docs in `docs`: the index's sections in
 * order, then every diagnostic. Links are relative to the docs directory.
 */
export function generateLlms(docs: readonly Doc[], version: string): Map<string, string> {
  const byPath = new Map(docs.map((doc) => [`${doc.topic}.md`, doc]));
  const readme = byPath.get("README.md");
  if (!readme) throw new Error("The docs have no README.md index.");
  const sections = parseIndex(readme.content).filter((section) =>
    section.links.every((link) => link.path !== "errors/README.md"),
  );
  const errors = docs.filter((doc) => /^errors\/LUM\d{4}$/.test(doc.topic));

  const intro = [
    "# Lumiose",
    "",
    `> ${readme.summary ?? "Docs for the Lumiose web framework."}`,
    "",
    `These docs match lumiose ${version}. Installed projects have them in \`node_modules/lumiose/docs\`;`,
    "`lumiose docs <topic>` prints one and `lumiose explain <code>` explains a diagnostic.",
  ];
  const index = [...intro];
  const ordered: Doc[] = [readme];
  for (const section of sections) {
    index.push("", `## ${section.heading}`, "");
    for (const link of section.links) {
      const external = /^https?:/.test(link.path);
      const doc = external ? undefined : byPath.get(link.path);
      if (!external && !doc) throw new Error(`docs/README.md links to a missing doc: ${link.path}`);
      if (doc && !ordered.includes(doc)) ordered.push(doc);
      const description = link.description ?? doc?.summary;
      index.push(`- [${link.title}](${link.path})${description ? `: ${description}` : ""}`);
    }
  }
  index.push("", "## Diagnostics", "");
  for (const doc of errors) {
    index.push(`- [${doc.title}](${doc.topic}.md)`);
    ordered.push(doc);
  }
  for (const doc of docs) {
    if (!ordered.includes(doc)) ordered.push(doc);
  }
  return llmsFiles(index, intro, ordered);
}

/** An index entry of the UI llms.txt. */
function uiEntry(doc: Doc): string {
  return `- [${doc.title}](${doc.topic}.md)${doc.summary ? `: ${doc.summary}` : ""}`;
}

/** `llms.txt` from its lines, and `llms-full.txt`: the intro, then every doc in `ordered`. */
function llmsFiles(
  index: readonly string[],
  intro: readonly string[],
  ordered: readonly Doc[],
): Map<string, string> {
  const full = [...intro, ""];
  for (const doc of ordered) {
    full.push("", `<!-- source: ${doc.topic}.md -->`, "", doc.content.trim(), "");
  }
  return new Map([
    ["llms.txt", `${index.join("\n")}\n`],
    ["llms-full.txt", `${full.join("\n").replace(/\n{3,}/g, "\n\n")}\n`],
  ]);
}

/**
 * `llms.txt` and `llms-full.txt` of @lumiose/ui's docs (decision-64): the index (`README`) and
 * any other guide under Overview, then every component page by title. Links are relative to the
 * UI docs directory. The docs ship in the package, so they match the installed version without
 * naming it: a release of @lumiose/ui does not regenerate them.
 */
export function generateUiLlms(docs: readonly Doc[]): Map<string, string> {
  const readme = docs.find((doc) => doc.topic === "README");
  if (!readme) throw new Error("The UI docs have no README.md index.");
  const guides = docs.filter((doc) => doc !== readme && !isComponentPage(doc));
  const components = docs
    .filter(isComponentPage)
    .toSorted((a, b) => a.title.localeCompare(b.title));
  const intro = [
    "# Lumiose UI",
    "",
    `> ${readme.summary ?? "Docs for @lumiose/ui."}`,
    "",
    "These docs ship in `@lumiose/ui` and match the installed version: `node_modules/@lumiose/ui/docs`.",
    "In a project that depends on it, `lumiose docs ui` prints the index and `lumiose docs dialog` a",
    "component's page; the Lumiose MCP server's `ui_components` tool lists every component's parts,",
    "props, events and styling hooks. The Lumiose docs: `node_modules/lumiose/docs/llms.txt`.",
  ];
  const index = [
    ...intro,
    "",
    "## Overview",
    "",
    ...[readme, ...guides].map(uiEntry),
    "",
    "## Components",
    "",
    ...components.map(uiEntry),
  ];
  return llmsFiles(index, intro, [readme, ...guides, ...components]);
}
