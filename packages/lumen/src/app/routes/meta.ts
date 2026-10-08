// Static reading of route module exports (`export const mode`, `export const ssr`, endpoint
// method exports).
// A lightweight, comment-aware scan for now; the Rust compiler will provide module meta
// later, so callers depend on the `ReadRouteModuleMeta` signature, not on this parser.

export interface RouteModuleMeta {
  /** The declared `mode` string, unvalidated. */
  mode?: string;
  ssr?: boolean;
  /** HTTP method exports (`GET`, `POST`, …) found by name; re-exports from other modules are missed. */
  methods?: string[];
  /** Exports that exist but cannot be read statically. */
  problems: string[];
}

export type ReadRouteModuleMeta = (source: string) => RouteModuleMeta;

const DECLARATION = /^[ \t]*export[ \t]+(const|let|var)[ \t]+(mode|ssr)\b[^=\n]*=[ \t]*([^;\n]*)/gm;
const STRING_VALUE = /^(["'`])(\w*)\1(?:\s+(?:as\s+const|satisfies\s+[\w.]+))?\s*$/;
const BOOLEAN_VALUE = /^(true|false)(?:\s+(?:as\s+const|satisfies\s+[\w.]+))?\s*$/;
const HTTP_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const METHOD_DECLARATION =
  /^[ \t]*export[ \t]+(?:(?:async[ \t]+)?function\*?|const|let|var)[ \t]+([A-Z]+)\b/gm;
const EXPORT_LIST = /\bexport[ \t]*(?:type[ \t]*)?\{([^}]*)\}/g;

export const readRouteModuleMeta: ReadRouteModuleMeta = (source) => {
  const meta: RouteModuleMeta = { problems: [] };
  const code = stripComments(source);
  const methods = new Set<string>();
  for (const [, name] of code.matchAll(METHOD_DECLARATION)) {
    if (HTTP_METHODS.has(name!)) methods.add(name!);
  }
  for (const [list, names] of code.matchAll(EXPORT_LIST)) {
    if (/^export\s*type\b/.test(list)) continue;
    for (const item of names!.split(",")) {
      const exported = item
        .trim()
        .split(/\s+as\s+/)
        .at(-1)!
        .trim();
      if (HTTP_METHODS.has(exported)) methods.add(exported);
    }
  }
  if (methods.size > 0) meta.methods = [...methods];
  for (const [, keyword, name, rawValue] of code.matchAll(DECLARATION)) {
    const value = (rawValue ?? "").trim();
    if (keyword !== "const") {
      meta.problems.push(`"export ${keyword} ${name}" must be declared with const.`);
      continue;
    }
    if (name === "mode") {
      if (meta.mode !== undefined) continue;
      const match = STRING_VALUE.exec(value);
      if (match === null) {
        meta.problems.push(`"export const mode" must be a string literal, for example "server".`);
      } else {
        meta.mode = match[2] ?? "";
      }
    } else if (meta.ssr === undefined) {
      const match = BOOLEAN_VALUE.exec(value);
      if (match === null) {
        meta.problems.push(`"export const ssr" must be the literal true or false.`);
      } else {
        meta.ssr = match[1] === "true";
      }
    }
  }
  return meta;
};

/**
 * Blanks out `//` and `/* *\/` comments, keeping string and template literals intact and
 * every newline in place. Quoted strings end at a newline so stray apostrophes in JSX text
 * or CSS cannot swallow the rest of the file.
 */
function stripComments(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const char = source[i]!;
    const next = source[i + 1];
    if (char === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") {
        out += " ";
        i++;
      }
    } else if (char === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? source.length : end + 2;
      for (; i < stop; i++) out += source[i] === "\n" ? "\n" : " ";
    } else if (char === '"' || char === "'" || char === "`") {
      const start = i;
      i = literalEnd(source, start);
      const literal = source.slice(start, i);
      // Blank literals that span lines (templates, or quotes left open by JSX text): only
      // they can hide a line that looks like a declaration.
      out += literal.includes("\n") ? literal.replace(/[^\n]/g, " ") : literal;
    } else {
      out += char;
      i++;
    }
  }
  return out;
}

/** Index just past a string or template literal starting at `start` (or past its line). */
function literalEnd(source: string, start: number): number {
  const quote = source[start];
  for (let i = start + 1; i < source.length; i++) {
    const char = source[i];
    if (char === "\\") i++;
    else if (char === quote || (char === "\n" && quote !== "`")) return i + 1;
  }
  return source.length;
}
