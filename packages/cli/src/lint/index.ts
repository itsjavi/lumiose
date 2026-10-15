// `lumiose lint` (spec §9.3): oxlint cannot parse `.stsx`, so it lints their shadow TSX
// (`.lumiose/shadow/<path>.stsx.tsx`, offset-identical masked text) next to the project's own files.
// - Shadows are linted with a copy of the project's oxlint config written to the shadow root, whose
//   layout mirrors the project root, so `overrides` and `ignorePatterns` globs keep matching.
// - Positions map back to the `.stsx` source; diagnostics inside style blocks are dropped (they
//   are about masking artefacts), except on `$` references, which are real TS expressions — but
//   `no-unused-expressions` on the `;ref;` statements of top-level blocks is masking too.
// - If the project installs stylelint (and configures it), each block's CSS is linted with
//   references replaced by same-length identifiers.

import type { StyleBlock } from "@lumiose/compiler";
import { realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  CheckFailure,
  normalizeDiagnostics,
  summarize,
  type CheckDiagnostic,
  type CheckSummary,
  type DiagnosticSeverity,
} from "../check/diagnostics.ts";
import { formatHuman, formatJson, type CheckReport } from "../check/report.ts";
import { SHADOW_DIR, syncShadows, type ShadowFile } from "../check/shadow.ts";
import { SourceText } from "../check/text.ts";
import { virtualCss } from "../style-css.ts";
import { binPath, findConfig, parseJsonc, requirePackage, runNode } from "../tools.ts";

const OXLINT_CONFIGS = [".oxlintrc.json", ".oxlintrc.jsonc"];
/** Rules that report the masking itself rather than the code. */
const MASKING_RULES = new Set(["no-unused-expressions"]);
/** Shadow paths per oxlint run, to stay far below command-line length limits. */
const CHUNK = 200;

/** The subset of stylelint's Node API that `lumiose lint` uses. */
export interface Stylelint {
  lint(options: { code: string; codeFilename?: string; cwd?: string }): Promise<{
    results: { warnings: StylelintWarning[] }[];
  }>;
}

export interface StylelintWarning {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  rule: string;
  severity: "error" | "warning";
  text: string;
}

export interface LintOptions {
  root: string;
  /** Overrides stylelint discovery (tests); `null` turns it off. */
  stylelint?: Stylelint | null;
}

export interface LintResult {
  diagnostics: CheckDiagnostic[];
  summary: CheckSummary;
  /** Source texts by root-relative path, for code frames. */
  sources: Map<string, SourceText>;
  /** What was skipped and why (e.g. stylelint without a configuration). */
  notes: string[];
}

interface OxlintDiagnostic {
  message: string;
  code?: string;
  severity: string;
  help?: string;
  filename: string;
  labels?: { span: { offset: number; length: number } }[];
}

/** Lints the project. Throws {@link CheckFailure} when a tool cannot run. */
export async function lint(options: LintOptions): Promise<LintResult> {
  const root = realRoot(options.root);
  const oxlint = binPath(requirePackage(root, "oxlint", "lumiose lint runs it"), "oxlint");
  // Only the project's own `.stsx` files: a used package's are linted by its own `lumiose lint`.
  const files = (await syncShadows(root)).files.filter((file) => file.own);
  const byShadow = new Map(files.map((file) => [file.shadow, file]));
  const sources = new Map<string, SourceText>();
  const diagnostics: CheckDiagnostic[] = [];
  const notes: string[] = [];
  const fileKey = (file: string) => relative(root, file).split(sep).join("/");

  // oxlint walks into node_modules (and through its symlinks, a whole workspace) unless told not to.
  const reports = await runOxlint(oxlint, root, [
    "--ignore-pattern=**/.lumiose/**",
    "--ignore-pattern=**/node_modules/**",
  ]);
  if (files.length > 0) {
    const config = await writeShadowConfig(root);
    for (let i = 0; i < files.length; i += CHUNK) {
      const shadows = files.slice(i, i + CHUNK).map((file) => relative(root, file.shadow));
      reports.push(...(await runOxlint(oxlint, root, ["-c", config, ...shadows])));
    }
  }

  const bytes = new Map<string, Buffer>();
  for (const report of reports) {
    const linted = resolve(root, report.filename);
    const shadow = byShadow.get(linted);
    const file = shadow?.source ?? linted;
    const key = fileKey(file);
    let text = sources.get(key);
    if (!text) {
      text = new SourceText(shadow?.text ?? (await readFile(file, "utf8")));
      sources.set(key, text);
    }
    // oxlint spans are UTF-8 byte offsets into the text it linted (the shadow: masked CSS has
    // other bytes than the source, but the same UTF-16 offsets).
    const lintedText = shadow?.scan.masked ?? text.text;
    let buffer = bytes.get(linted);
    if (!buffer) bytes.set(linted, (buffer = Buffer.from(lintedText, "utf8")));
    const span = report.labels?.[0]?.span;
    const start = span ? utf16Offset(buffer, span.offset) : 0;
    const end = span ? utf16Offset(buffer, span.offset + span.length) : 0;
    if (shadow && !keepInShadow(shadow.scan.blocks, start, report.code)) continue;
    const from = text.positionAt(start);
    const to = text.positionAt(end);
    diagnostics.push({
      source: "oxlint",
      code: report.code ?? "oxlint",
      severity: severity(report.severity),
      file: key,
      line: from.line,
      column: from.column,
      endLine: to.line,
      endColumn: to.column,
      message: report.message,
      ...(report.help ? { help: report.help } : {}),
    });
  }

  const stylelint = options.stylelint === undefined ? await loadStylelint(root) : options.stylelint;
  if (stylelint) {
    const styled = await lintStyles(stylelint, root, files, fileKey, sources);
    diagnostics.push(...styled.diagnostics);
    notes.push(...styled.notes);
  }

  const normalized = normalizeDiagnostics(diagnostics);
  return { diagnostics: normalized, summary: summarize(normalized), sources, notes };
}

/** Outside blocks: kept. Inside: kept only on a `$` reference, unless the rule is about masking. */
function keepInShadow(blocks: readonly StyleBlock[], offset: number, code?: string): boolean {
  const block = blocks.find((b) => offset >= b.span.start && offset < b.span.end);
  if (block === undefined) return true;
  const onRef = block.refs.some((ref) => offset >= ref.span.start && offset <= ref.span.end);
  const rule = /\(([^)]+)\)$/.exec(code ?? "")?.[1] ?? code ?? "";
  return onRef && !MASKING_RULES.has(rule);
}

async function runOxlint(bin: string, root: string, args: string[]): Promise<OxlintDiagnostic[]> {
  const { exitCode, stdout, stderr } = await runNode(bin, ["-f", "json", ...args], root);
  // A "No files found" line may precede the JSON report.
  const start = stdout.indexOf("{");
  if (start !== -1) {
    try {
      return (JSON.parse(stdout.slice(start)) as { diagnostics: OxlintDiagnostic[] }).diagnostics;
    } catch {
      // Reported below.
    }
  }
  throw new CheckFailure(`oxlint exited with code ${exitCode} without a JSON report.`, {
    help: `${stdout}${stderr}`.trim() || undefined,
  });
}

/**
 * The nearest oxlint config, copied to the shadow root (`extends` and plugin paths made absolute):
 * shadows sit at the same paths relative to it as their sources relative to the project root.
 */
async function writeShadowConfig(root: string): Promise<string> {
  const found = findConfig(root, OXLINT_CONFIGS);
  const config = found ? parseJsonc(await readFile(found, "utf8"), found) : {};
  delete config["$schema"];
  if (found) {
    const base = dirname(found);
    const absolute = (value: unknown) =>
      typeof value === "string" && /^\.\.?\//.test(value) ? resolve(base, value) : value;
    if (Array.isArray(config["extends"])) config["extends"] = config["extends"].map(absolute);
    if (Array.isArray(config["jsPlugins"])) {
      config["jsPlugins"] = config["jsPlugins"].map((plugin: unknown) =>
        typeof plugin === "object" && plugin !== null && "specifier" in plugin
          ? { ...plugin, specifier: absolute(plugin.specifier) }
          : absolute(plugin),
      );
    }
  }
  const path = join(root, SHADOW_DIR, ".oxlintrc.json");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
  return path;
}

async function loadStylelint(root: string): Promise<Stylelint | undefined> {
  let entry: string;
  try {
    entry = createRequire(join(root, "package.json")).resolve("stylelint");
  } catch {
    return undefined;
  }
  const module = (await import(pathToFileURL(entry).href)) as { default?: Stylelint } & Stylelint;
  return typeof module.default?.lint === "function" ? module.default : module;
}

async function lintStyles(
  stylelint: Stylelint,
  root: string,
  files: readonly ShadowFile[],
  fileKey: (file: string) => string,
  sources: Map<string, SourceText>,
): Promise<{ diagnostics: CheckDiagnostic[]; notes: string[] }> {
  const diagnostics: CheckDiagnostic[] = [];
  for (const file of files) {
    const key = fileKey(file.source);
    let text = sources.get(key);
    if (!text) sources.set(key, (text = new SourceText(file.text)));
    for (const block of file.scan.blocks) {
      if (block.svg) continue;
      let results;
      try {
        // The virtual CSS keeps the source's lines and columns; `.css` lets CSS overrides apply.
        ({ results } = await stylelint.lint({
          code: virtualCss(file.text, block),
          codeFilename: `${file.source}.css`,
          cwd: root,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/no configuration/i.test(message)) {
          return {
            diagnostics: [],
            notes: ["stylelint is installed but not configured; skipped."],
          };
        }
        throw new CheckFailure(`stylelint failed: ${message}`, { cause: error });
      }
      for (const warning of results.flatMap((result) => result.warnings)) {
        const start = text.offsetAt({ line: warning.line, column: warning.column });
        // A warning on a reference is about its placeholder identifier, not the code.
        if (block.refs.some((ref) => start >= ref.span.start && start < ref.span.end)) continue;
        diagnostics.push({
          source: "stylelint",
          code: warning.rule,
          severity: warning.severity === "error" ? "error" : "warning",
          file: key,
          line: warning.line,
          column: warning.column,
          endLine: warning.endLine ?? warning.line,
          endColumn: warning.endColumn ?? warning.column,
          message: warning.text.replace(` (${warning.rule})`, ""),
        });
      }
    }
  }
  return { diagnostics, notes: [] };
}

function severity(value: string): DiagnosticSeverity {
  return value === "error" ? "error" : value === "warning" ? "warning" : "hint";
}

/** The UTF-16 offset of a UTF-8 byte offset. */
function utf16Offset(buffer: Buffer, byteOffset: number): number {
  return buffer.subarray(0, Math.max(0, byteOffset)).toString("utf8").length;
}

function realRoot(root: string): string {
  try {
    return realpathSync(resolve(root));
  } catch (cause) {
    throw new CheckFailure(`Project root ${resolve(root)} does not exist.`, { cause });
  }
}

export interface LintCommandOptions extends LintOptions {
  format?: "human" | "json";
  color?: boolean;
  write?: (text: string) => void;
  writeError?: (text: string) => void;
}

/** `lumiose lint`: prints the report and returns the exit code (0 ok, 1 errors, 2 tool failure). */
export async function lintCommand(options: LintCommandOptions): Promise<number> {
  const write = options.write ?? ((text: string) => void process.stdout.write(text));
  const writeError = options.writeError ?? ((text: string) => void process.stderr.write(text));
  const json = options.format === "json";
  try {
    const result = await lint(options);
    const report: CheckReport = { diagnostics: result.diagnostics, summary: result.summary };
    for (const note of result.notes) writeError(`lumiose lint: ${note}\n`);
    write(
      json
        ? formatJson(report, "lint")
        : formatHuman(report, { sources: result.sources, color: options.color ?? false }),
    );
    return result.summary.errors > 0 ? 1 : 0;
  } catch (error) {
    const failure = {
      message: error instanceof Error ? error.message : String(error),
      ...(error instanceof CheckFailure && error.help !== undefined ? { help: error.help } : {}),
    };
    if (json) write(formatJson({ diagnostics: [], summary: summarize([]), failure }, "lint"));
    else
      writeError(
        `lumiose lint failed: ${failure.message}\n${failure.help ? `${failure.help}\n` : ""}`,
      );
    return 2;
  }
}
