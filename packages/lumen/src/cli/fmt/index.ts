// `lumen fmt` (spec §9.3): oxfmt cannot parse `.stsx`, so each file is formatted in parts.
// 1. The TSX, with every style block replaced by a placeholder (`<__lumen_style_0__ />` in JSX, a
//    `/*__lumen_style_0__*/` comment at the top level), is formatted by oxfmt as `.tsx`.
// 2. Each block's CSS is formatted by oxfmt as `.css`, with `$` references protected by
//    same-length identifiers.
// 3. The blocks are re-indented to their placeholder's indentation and stitched back.
// Files with scanner errors (unclosed blocks, invalid attributes, …) or syntax errors are reported
// and left unchanged. Blocks sharing a line with other JSX are kept verbatim.

import type { StyleBlock } from "@lumen/compiler";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, matchesGlob, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { CheckFailure } from "../check/diagnostics.ts";
import { loadCompiler } from "../check/shadow.ts";
import {
  EXIT_FAILURE,
  EXIT_OK,
  EXIT_PROBLEMS,
  failureOf,
  formatEnvelope,
  type OutputFormat,
} from "../output.ts";
import { protectRefs } from "../style-css.ts";
import { findConfig, parseJsonc, requirePackage } from "../tools.ts";

/** oxfmt's options (`FormatConfig`), as read from `.oxfmtrc.json`. */
export type FormatConfig = Record<string, unknown>;

export interface FormatResult {
  code: string;
  errors: readonly { message: string }[];
}

/** oxfmt's `format()` API. */
export type Formatter = (
  fileName: string,
  sourceText: string,
  options?: FormatConfig,
) => Promise<FormatResult>;

export type FormatStsxResult =
  | { ok: true; code: string; warnings: string[] }
  | { ok: false; error: string };

const CONFIG_FILES = [".oxfmtrc.json", ".oxfmtrc.jsonc"];
/** Config keys that are not formatting options. */
const NON_FORMAT_KEYS = ["$schema", "ignorePatterns", "overrides"];

/** Formats one `.stsx` source. */
export async function formatStsx(
  source: string,
  file: string,
  format: Formatter,
  config: FormatConfig = {},
): Promise<FormatStsxResult> {
  const { scan } = await loadCompiler();
  const scanned = scan(source, file);
  const errors = scanned.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length > 0) {
    return { ok: false, error: errors.map((d) => `${d.code}: ${d.message}`).join("; ") };
  }

  const blocks = scanned.blocks;
  if (blocks.some((block) => block.placement === "expression")) {
    return { ok: false, error: "LUM3011: a <style> block is in an expression position" };
  }
  let tsx = "";
  let last = 0;
  blocks.forEach((block, index) => {
    tsx += source.slice(last, block.span.start) + placeholder(block, index);
    last = block.span.end;
  });
  tsx += source.slice(last);

  const formatted = await format(file.replace(/\.stsx$/, ".tsx"), tsx, config);
  if (formatted.errors.length > 0) {
    return { ok: false, error: formatted.errors.map((error) => error.message).join("; ") };
  }

  const eol = config["endOfLine"] === "crlf" ? "\r\n" : config["endOfLine"] === "cr" ? "\r" : "\n";
  const unit = config["useTabs"] === true ? "\t" : " ".repeat(numberOption(config, "tabWidth", 2));
  const printWidth = numberOption(config, "printWidth", 100);
  const warnings: string[] = [];
  let code = formatted.code;
  for (let index = blocks.length - 1; index >= 0; index--) {
    const block = blocks[index]!;
    const marker = placeholder(block, index);
    const at = code.indexOf(marker);
    if (at === -1 || code.indexOf(marker, at + 1) !== -1) {
      return { ok: false, error: `style block ${index + 1} could not be placed back` };
    }
    const lineStart = Math.max(code.lastIndexOf("\n", at - 1), code.lastIndexOf("\r", at - 1)) + 1;
    const before = code.slice(lineStart, at);
    const lineEnd = code.slice(at + marker.length).search(/\r|\n|$/) + at + marker.length;
    const after = code.slice(at + marker.length, lineEnd);
    const ownLine = /^[ \t]*$/.test(before) && /^[ \t]*$/.test(after);

    let replacement: string;
    let from = at;
    let to = at + marker.length;
    if (block.placement === "jsx" && !ownLine) {
      replacement = source.slice(block.span.start, block.span.end);
    } else {
      const indent = ownLine ? before : "";
      const width = Math.max(40, printWidth - columns(indent + unit));
      const css = await formatCss(source, block, format, { ...config, printWidth: width });
      if (typeof css !== "string") {
        warnings.push(`style block ${index + 1}: ${css.error}; left unchanged`);
        replacement = source.slice(block.span.start, block.span.end);
      } else {
        replacement = stitch(block, source, css, indent, unit, eol);
      }
      if (!ownLine) {
        // A top-level block sharing a line with code moves to a line of its own.
        from -= before.length - before.trimEnd().length;
        to += after.length - after.trimStart().length;
        replacement = `${before.trim() ? eol : ""}${replacement}${after.trim() ? eol : ""}`;
      }
    }
    code = code.slice(0, from) + replacement + code.slice(to);
  }
  return { ok: true, code, warnings };
}

function placeholder(block: StyleBlock, index: number): string {
  return block.placement === "jsx"
    ? `<__lumen_style_${index}__ />`
    : `/*__lumen_style_${index}__*/`;
}

async function formatCss(
  source: string,
  block: StyleBlock,
  format: Formatter,
  config: FormatConfig,
): Promise<string | { error: string }> {
  const { start, end } = block.content;
  const content = source.slice(start, end);
  if (content.trim() === "") return "";
  const refs = block.refs.map((ref) => ({
    start: ref.span.start - start,
    end: ref.span.end - start,
  }));
  // Without the source indentation: oxfmt keeps the continuation lines of a multi-line comment
  // as they are, and `stitch` indents every line again.
  const dedented = dedent(content);
  const guarded = protectRefs(dedented.text, dedented.mapRefs(refs));
  const result = await format("style.css", guarded.css, config);
  if (result.errors.length > 0) return { error: result.errors.map((e) => e.message).join("; ") };
  const restored = guarded.restore(result.code);
  if (restored === undefined) return { error: "a $ reference was lost while formatting" };
  return restored.replace(/\s+$/, "");
}

/**
 * `css` without the leading whitespace its lines share (the text on the `<style>` line itself
 * excepted), and a mapping of offsets in `css` to offsets in the result.
 */
function dedent(css: string): {
  text: string;
  mapRefs: (refs: { start: number; end: number }[]) => { start: number; end: number }[];
} {
  const lines = css.split(/(?<=\r\n|\r(?!\n)|\n)/);
  let common: string | undefined;
  for (const line of lines.slice(1)) {
    if (line.trim() === "") continue;
    const lead = /^[ \t]*/.exec(line)![0];
    if (common === undefined) common = lead;
    else {
      let n = 0;
      while (n < common.length && n < lead.length && common[n] === lead[n]) n++;
      common = common.slice(0, n);
    }
  }
  const cut = common?.length ?? 0;
  if (cut === 0) return { text: css, mapRefs: (refs) => refs };
  // Where each line starts in `css`, and how many characters are removed up to its content.
  const starts: { at: number; removed: number }[] = [];
  let at = 0;
  let removed = 0;
  let text = "";
  lines.forEach((line, index) => {
    // Non-blank lines all start with `common`; blank lines lose what whitespace they have.
    const strip = index === 0 ? 0 : Math.min(cut, /^[ \t]*/.exec(line)![0].length);
    starts.push({ at, removed: removed + strip });
    removed += strip;
    text += line.slice(strip);
    at += line.length;
  });
  const map = (offset: number) => {
    let entry = starts[0]!;
    for (const start of starts) {
      if (start.at > offset) break;
      entry = start;
    }
    return offset - entry.removed;
  };
  return {
    text,
    mapRefs: (refs) => refs.map((ref) => ({ start: map(ref.start), end: map(ref.end) })),
  };
}

/** The block's text: open tag, CSS one level deeper than `indent`, close tag at `indent`. */
function stitch(
  block: StyleBlock,
  source: string,
  css: string,
  indent: string,
  unit: string,
  eol: string,
): string {
  const bareGlobal = block.attributes.every(
    (a) => a.name === "global" && a.valueKind === undefined,
  );
  const open = bareGlobal
    ? `<style${block.global ? " global" : ""}>`
    : source.slice(block.openTag.start, block.openTag.end);
  if (css === "") return `${open}</style>`;
  const lines = css.split(/\r\n|\r|\n/).map((line) => (line === "" ? "" : indent + unit + line));
  return [open, ...lines, `${indent}</style>`].join(eol);
}

function numberOption(config: FormatConfig, key: string, fallback: number): number {
  const value = config[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function columns(indent: string): number {
  return indent.replace(/\t/g, "  ").length;
}

// --- Project formatting -------------------------------------------------------------------------

export interface FmtOptions {
  /** Project root (the oxfmt config is looked up from here). */
  root: string;
  /** Files or directories, relative to the root. Default: `src`. */
  paths?: readonly string[];
  /** Report instead of writing. */
  check?: boolean;
  /** Overrides the project's oxfmt (tests). */
  formatter?: Formatter;
}

export interface FmtFileResult {
  /** Root-relative POSIX path. */
  file: string;
  status: "formatted" | "unchanged" | "error";
  error?: string;
  warnings: string[];
}

/** Formats (or checks) the `.stsx` files under `paths`. Throws {@link CheckFailure} if oxfmt is missing. */
export async function fmt(options: FmtOptions): Promise<FmtFileResult[]> {
  const root = resolve(options.root);
  const format = options.formatter ?? (await loadOxfmt(root));
  const { config, ignore } = await loadFormatConfig(root);
  const files = (
    await Promise.all(
      (options.paths?.length ? options.paths : ["src"]).map((path) =>
        listStsx(resolve(root, path), root, ignore),
      ),
    )
  ).flat();

  const results: FmtFileResult[] = [];
  for (const path of [...new Set(files)].toSorted()) {
    const file = relative(root, path).split(sep).join("/");
    const source = await readFile(path, "utf8");
    const result = await formatStsx(source, path, format, config);
    if (!result.ok) {
      results.push({ file, status: "error", error: result.error, warnings: [] });
      continue;
    }
    const changed = result.code !== source;
    if (changed && !options.check) await writeFile(path, result.code);
    results.push({ file, status: changed ? "formatted" : "unchanged", warnings: result.warnings });
  }
  return results;
}

async function loadOxfmt(root: string): Promise<Formatter> {
  const oxfmt = requirePackage(root, "oxfmt", "lumen fmt formats with it");
  const module = (await import(pathToFileURL(join(oxfmt.dir, "dist/index.js")).href)) as {
    format?: Formatter;
  };
  if (typeof module.format !== "function") {
    throw new CheckFailure(`oxfmt ${oxfmt.manifest.version ?? ""} has no format() API.`, {
      help: "Update it: `pnpm add -D oxfmt@latest`.",
    });
  }
  return module.format;
}

/** The nearest `.oxfmtrc.json(c)`: its formatting options and an ignore matcher. */
async function loadFormatConfig(
  root: string,
): Promise<{ config: FormatConfig; ignore: (relativePath: string) => boolean }> {
  const path = findConfig(root, CONFIG_FILES);
  if (path === undefined) return { config: {}, ignore: () => false };
  const raw = parseJsonc(await readFile(path, "utf8"), path);
  const config = Object.fromEntries(
    Object.entries(raw).filter(([key]) => !NON_FORMAT_KEYS.includes(key)),
  );
  const patterns = Array.isArray(raw["ignorePatterns"])
    ? raw["ignorePatterns"].filter((p): p is string => typeof p === "string").map(toGlob)
    : [];
  const base = join(path, "..");
  return {
    config,
    ignore: (relativePath) => {
      const fromConfig = relative(base, resolve(root, relativePath)).split(sep).join("/");
      return patterns.some((pattern) => matchesGlob(fromConfig, pattern));
    },
  };
}

/**
 * A gitignore-style pattern as a glob relative to the config's directory: a pattern without an
 * inner slash matches at any depth, a trailing slash means a directory and everything in it.
 */
function toGlob(pattern: string): string {
  const directory = pattern.endsWith("/");
  let glob = directory ? pattern.slice(0, -1) : pattern;
  const anchored = glob.includes("/");
  if (glob.startsWith("/")) glob = glob.slice(1);
  if (!anchored) glob = `**/${glob}`;
  return directory ? `${glob}/**` : glob;
}

async function listStsx(
  path: string,
  root: string,
  ignore: (relativePath: string) => boolean,
): Promise<string[]> {
  const rel = relative(root, path);
  if (rel !== "" && !rel.startsWith("..") && !isAbsolute(rel) && ignore(rel)) return [];
  const entries = await readdir(path, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOTDIR") return undefined;
      if (error.code === "ENOENT") throw new CheckFailure(`${path} does not exist.`);
      throw error;
    },
  );
  if (entries === undefined) return path.endsWith(".stsx") ? [path] : [];
  const nested = await Promise.all(
    entries.map((entry) => {
      if (entry.name.startsWith(".") || entry.name === "node_modules") return [];
      const child = join(path, entry.name);
      if (entry.isDirectory()) return listStsx(child, root, ignore);
      return entry.isFile() && entry.name.endsWith(".stsx") && !ignore(relative(root, child))
        ? [child]
        : [];
    }),
  );
  return nested.flat();
}

export interface FmtCommandOptions extends FmtOptions {
  format?: OutputFormat;
  write?: (text: string) => void;
  writeError?: (text: string) => void;
}

/**
 * `lumen fmt [--check] [paths…]`: formats `.stsx` files (exit 0), or with `--check` lists those that
 * are not formatted (exit 1 if any). Files that cannot be formatted exit 1; tool failures exit 2.
 * With `--check`, a `formatted` file in the JSON report is one that is not formatted yet.
 */
export async function fmtCommand(options: FmtCommandOptions): Promise<number> {
  const write = options.write ?? ((text: string) => void process.stdout.write(text));
  const writeError = options.writeError ?? ((text: string) => void process.stderr.write(text));
  const json = options.format === "json";
  let results: FmtFileResult[];
  try {
    results = await fmt(options);
  } catch (error) {
    const failure = failureOf(error);
    if (json) write(formatEnvelope("fmt", false, { check: options.check ?? false, failure }));
    else
      writeError(
        `lumen fmt failed: ${failure.message}\n${failure.help ? `${failure.help}\n` : ""}`,
      );
    return EXIT_FAILURE;
  }
  const changed = results.filter((result) => result.status === "formatted");
  const failed = results.filter((result) => result.status === "error").length;
  const code = failed > 0 || (options.check && changed.length > 0) ? EXIT_PROBLEMS : EXIT_OK;
  if (json) {
    write(
      formatEnvelope("fmt", code === EXIT_OK, {
        check: options.check ?? false,
        files: results,
        summary: { files: results.length, formatted: changed.length, errors: failed },
      }),
    );
    return code;
  }
  for (const result of results) {
    if (result.error) writeError(`${result.file}: could not format: ${result.error}\n`);
    for (const warning of result.warnings) writeError(`${result.file}: ${warning}\n`);
  }
  const total = plural(results.length, ".stsx file");
  if (options.check) {
    for (const result of changed) write(`${result.file}\n`);
    write(
      changed.length > 0
        ? `${plural(changed.length, "file")} not formatted (of ${total}). Run \`lumen fmt\`.\n`
        : `All ${total} formatted.\n`,
    );
  } else {
    write(`Formatted ${plural(changed.length, "file")} (of ${total}).\n`);
  }
  return code;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
