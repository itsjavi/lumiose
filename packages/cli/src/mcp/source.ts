// What the MCP server's `compile` and `components` tools report about a source file (TASK-34):
// the compiler's client and server output, and its metadata (components with their props
// parameter, islands, style scopes), with positions as 1-based lines and columns.

import type { CompileMeta, CompileResult, Span } from "@lumiose/compiler";
import { existsSync } from "node:fs";
import { readFile, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  CheckFailure,
  fromCompilerDiagnostic,
  type CheckDiagnostic,
} from "../check/diagnostics.ts";
import { compileWithModules } from "../check/compile.ts";
import { ModuleHost } from "../check/modules.ts";
import { listFiles, loadCompiler, SOURCE_DIR } from "../check/shadow.ts";
import { SourceText } from "../check/text.ts";

export interface SourceInput {
  /** Project-relative (or absolute) path of a `.stsx` / `.tsx` file. */
  file?: string | undefined;
  /** Source text to use instead of the file's contents (the file need not exist). */
  source?: string | undefined;
}

interface LoadedSource {
  /** Absolute path. */
  path: string;
  /** Root-relative POSIX path. */
  key: string;
  text: SourceText;
}

/** Resolves a tool's `file`/`source` input to a path and text. */
export async function loadSource(root: string, input: SourceInput): Promise<LoadedSource> {
  if (input.file === undefined && input.source === undefined) {
    throw new CheckFailure("Pass `file` (a project-relative path) or `source`.");
  }
  const path = resolve(root, input.file ?? "src/components/Playground.stsx");
  if (!/\.(?:stsx|tsx)$/.test(path)) {
    throw new CheckFailure(`${input.file} is not a .stsx or .tsx file.`);
  }
  if (!within(root, path)) throw outside(input.file);
  let text = input.source;
  if (text === undefined) {
    if (!existsSync(path)) {
      throw new CheckFailure(`${input.file} does not exist.`, {
        help: "Paths are relative to the project root; list the routes with the routes tool.",
      });
    }
    // A symlink inside the root may point anywhere: the real path must stay inside too.
    if (!within(await realpath(root), await realpath(path))) throw outside(input.file);
    text = await readFile(path, "utf8");
  }
  return { path, key: keyOf(root, path), text: new SourceText(text) };
}

/** Whether `path` is `root` itself or below it. */
function within(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function outside(file: string | undefined): CheckFailure {
  return new CheckFailure(`${file} is outside the project root.`, {
    help: "The MCP tools only read files of the project; pass a path relative to its root.",
  });
}

function keyOf(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}

export interface CompiledFile {
  file: string;
  client?: { code: string; css: string | null; cssDeps: string[] };
  server?: { code: string };
  diagnostics: CheckDiagnostic[];
}

/** Compiles a file for the client and/or the server, folding imported `$` constants. */
export async function compileSource(
  root: string,
  input: SourceInput & { target?: "client" | "server" | "both" | undefined },
): Promise<CompiledFile> {
  const source = await loadSource(root, input);
  const target = input.target ?? "both";
  const host = new ModuleHost({
    root,
    read: (path) => (path === source.path ? source.text.text : undefined),
  });
  const run = (which: "client" | "server") =>
    compileWithModules(
      source.text.text,
      source.path,
      { target: which, sourceMap: false, styleImport: false, root },
      host,
    );
  const client = target === "server" ? undefined : await run("client");
  const server = target === "client" ? undefined : await run("server");
  const diagnostics = (client ?? server)!.diagnostics.map((diagnostic) =>
    fromCompilerDiagnostic(source.key, source.text, diagnostic),
  );
  return {
    file: source.key,
    ...(client === undefined
      ? {}
      : {
          client: {
            code: client.code,
            css: client.css ?? null,
            cssDeps: client.cssDeps.map((dep) => (isAbsolute(dep) ? keyOf(root, dep) : dep)),
          },
        }),
    ...(server === undefined ? {} : { server: { code: server.code } }),
    diagnostics,
  };
}

export interface Location {
  line: number;
  column: number;
}

export interface ComponentInfo {
  name: string;
  exported: boolean;
  async: boolean;
  location: Location;
  /**
   * The props parameter as written (`props: CardProps`, `{ title }: { title: string }`); null
   * without one. `type` is the declaration of a props type named in the same file, if any.
   */
  props: { parameter: string; type?: string } | null;
  /** The scope marker (`data-lum-*` attribute or `lum-*` class) of each element that holds `<style>` blocks. */
  styleScopes: { attribute: string; location: Location }[];
}

export interface FileComponents {
  file: string;
  components: ComponentInfo[];
  islands: { ref: string; module: string; export: string; strategy: string; location: Location }[];
  /** The scope attribute of the file's top-level `<style>` blocks, if any. */
  fileScope: string | null;
  hasStyles: boolean;
  /** Errors that may make the metadata incomplete. */
  errors: CheckDiagnostic[];
}

/**
 * Compiler metadata of one file, or of every `.stsx` / `.tsx` file under `src/` when `file` is
 * omitted (files without components or islands are left out then).
 */
export async function listComponents(
  root: string,
  input: SourceInput = {},
): Promise<FileComponents[]> {
  const { compile } = await loadCompiler();
  const sources =
    input.file !== undefined || input.source !== undefined
      ? [await loadSource(root, input)]
      : await Promise.all(
          (await listFiles(join(root, SOURCE_DIR), (name) => /\.(?:stsx|tsx)$/.test(name))).map(
            (path) => loadSource(root, { file: path }),
          ),
        );
  const results: FileComponents[] = [];
  for (const source of sources.toSorted((a, b) => (a.key < b.key ? -1 : 1))) {
    const result: CompileResult = compile(source.text.text, source.path, {
      target: "client",
      sourceMap: false,
      styleImport: false,
      emitCss: false,
      root,
    });
    const info = fileComponents(source, result.meta, result);
    const single = sources.length === 1;
    if (single || info.components.length > 0 || info.islands.length > 0) results.push(info);
  }
  return results;
}

function fileComponents(
  source: LoadedSource,
  meta: CompileMeta,
  result: CompileResult,
): FileComponents {
  const at = (span: Span): Location => source.text.positionAt(span.start);
  return {
    file: source.key,
    components: meta.components.map((component) => ({
      name: component.name,
      exported: component.exported,
      async: component.isAsync,
      location: at(component.span),
      props: propsOf(source.text.text, component.name, component.span),
      styleScopes: (meta.scopeTokens.components[component.name] ?? []).map((scope) => ({
        attribute: scope.attribute,
        location: at(scope.span),
      })),
    })),
    islands: meta.islands.map((island) => ({
      ref: island.ref,
      module: island.module,
      export: island.export,
      strategy: island.strategy,
      location: at(island.span),
    })),
    fileScope: meta.scopeTokens.file ?? null,
    hasStyles: meta.hasStyles,
    errors: result.diagnostics
      .filter((diagnostic) => diagnostic.severity === "error")
      .map((diagnostic) => fromCompilerDiagnostic(source.key, source.text, diagnostic)),
  };
}

// --- props --------------------------------------------------------------------------------------

/**
 * The first parameter of a component, read from its source: the parameter list follows the name
 * (`function Card(`, `const Card = (`), possibly after type parameters.
 */
export function propsOf(
  text: string,
  name: string,
  span: Span,
): { parameter: string; type?: string } | null {
  const body = text.slice(span.start, span.end);
  const nameAt = body.search(new RegExp(`\\b${name}\\b`));
  if (nameAt === -1) return null;
  let open = nameAt + name.length;
  while (open < body.length && body[open] !== "(") {
    if (body[open] === "{" || body[open] === ";") return null;
    open = body[open] === "<" ? matching(body, open) : open + 1;
  }
  if (open >= body.length) return null;
  const close = matching(body, open) - 1;
  const parameter = firstParameter(body.slice(open + 1, close)).trim();
  if (parameter === "") return null;
  const typeName = /:\s*([A-Za-z_$][\w$]*)(?:<[^>]*>)?\s*$/.exec(parameter)?.[1];
  const type = typeName === undefined ? undefined : typeDeclaration(text, typeName);
  return type === undefined ? { parameter } : { parameter, type };
}

const PAIRS: Record<string, string> = { "(": ")", "[": "]", "{": "}", "<": ">" };

/**
 * The index after the bracket that closes the one at `open`, skipping strings. `<` counts as a
 * bracket (type arguments); a stray one (a comparison) is dropped at the next other closer.
 */
function matching(text: string, open: number): number {
  const stack: string[] = [];
  for (let i = open; i < text.length; i++) {
    const char = text[i]!;
    if (char === '"' || char === "'" || char === "`") {
      for (i++; i < text.length && text[i] !== char; i++) if (text[i] === "\\") i++;
    } else if (char === "=" && text[i + 1] === ">") {
      i++;
    } else if (char in PAIRS) {
      stack.push(PAIRS[char]!);
    } else if (char === ">" || char === ")" || char === "]" || char === "}") {
      if (char !== ">") while (stack.at(-1) === ">") stack.pop();
      if (char !== stack.at(-1)) continue;
      stack.pop();
      if (stack.length === 0) return i + 1;
    }
  }
  return text.length;
}

/** The text before the first top-level comma. */
function firstParameter(list: string): string {
  for (let i = 0; i < list.length; i++) {
    const char = list[i]!;
    if (char === ",") return list.slice(0, i);
    if (char === '"' || char === "'" || char === "`") {
      for (i++; i < list.length && list[i] !== char; i++) if (list[i] === "\\") i++;
    } else if (char in PAIRS) {
      i = matching(list, i) - 1;
    }
  }
  return list;
}

/** `interface Name …{…}` or `type Name = …;` declared in `text`. */
function typeDeclaration(text: string, name: string): string | undefined {
  const match = new RegExp(
    `(?:^|\\n)\\s*(?:export\\s+)?(?:interface\\s+${name}\\b[^{]*|type\\s+${name}\\b[^=]*=\\s*)`,
  ).exec(text);
  if (!match) return undefined;
  const start = match.index + match[0].length - match[0].trimStart().length;
  let end = match.index + match[0].length;
  while (end < text.length && /\s/.test(text[end]!)) end++;
  if (text[end] === "{") end = matching(text, end);
  else end = text.indexOf(";", end) === -1 ? text.length : text.indexOf(";", end);
  const declaration = text.slice(start, end).trim();
  return declaration.length > 2000 ? `${declaration.slice(0, 2000)}…` : declaration;
}
