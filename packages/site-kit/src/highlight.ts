// A small syntax highlighter for the Lumen websites, used as CodeBlock's `highlight` hook. It knows
// TS/TSX/JS/JSON, `.stsx` (TSX whose `<style>` blocks are highlighted as CSS, `$token` references
// included), CSS and shell. It returns HTML made of escaped text and `<span class="tok-…">`
// tokens, which CodeBlock colors with the theme's syntax tokens. Another highlighter (Shiki, …)
// can be plugged into the same hook; it must return safe HTML too.

/** Turns source code into HTML. It must escape the code (see {@link escapeHtml}). */
export type Highlighter = (code: string, lang: string) => string;

/** Token classes produced by {@link highlight}, as `tok-<kind>`. */
export type TokenKind =
  | "comment"
  | "keyword"
  | "string"
  | "number"
  | "tag"
  | "type"
  | "attr"
  | "fn"
  | "prop"
  | "ref"
  | "punct";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => ESCAPES[char]!);
}

function token(kind: TokenKind, text: string): string {
  return `<span class="tok-${kind}">${escapeHtml(text)}</span>`;
}

const SCRIPT = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "typescript",
  "javascript",
  "stsx",
  "json",
]);
const SHELL = new Set(["sh", "bash", "zsh", "shell", "console"]);

/** The default highlighter. Unknown languages come back escaped, without tokens. */
export const highlight: Highlighter = (code, lang) => {
  const name = lang.toLowerCase();
  if (SCRIPT.has(name)) return highlightScript(code);
  if (name === "css") return highlightCss(code);
  if (SHELL.has(name)) return highlightShell(code);
  return escapeHtml(code);
};

// --- TS / TSX / STSX ----------------------------------------------------------------------------

const KEYWORDS = new Set(
  (
    "as async await break case catch class const continue debugger default delete do else enum " +
    "export extends false finally for from function if implements import in instanceof interface " +
    "keyof let new null of readonly return satisfies static super switch this throw true try " +
    "type typeof undefined var void while yield"
  ).split(" "),
);

/** Tokens after which `<` starts JSX rather than a comparison or type arguments. */
const JSX_AFTER = new Set([
  "",
  "(",
  ",",
  "=",
  ":",
  "?",
  "{",
  "}",
  "[",
  "!",
  "&&",
  "||",
  "??",
  "=>",
  ";",
  ">",
]);
const JSX_AFTER_KEYWORD = new Set(["return", "default", "yield", "await", "else", "case"]);

type Context =
  | { kind: "js"; depth: number }
  | { kind: "tag"; closing: boolean; name: string }
  | { kind: "text" };

const WS = /\s+/y;
const COMMENT = /\/\/[^\n]*|\/\*[\s\S]*?\*\//y;
const STRING = /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\[\s\S])*`?/y;
const NUMBER = /(?:0[xob][\da-f_]+|\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?)n?\b/iy;
const IDENT = /[A-Za-z_$][\w$]*/y;
const TAG_OPEN = /<(\/?)([A-Za-z][\w.:-]*)?/y;
const OPERATOR = /=>|&&|\|\||\?\?|[=!<>]=?=?|[^\s\w]/y;
const ATTR = /[A-Za-z_$][\w$:.-]*/y;
const TEXT = /[^<{]+/y;

function match(pattern: RegExp, source: string, at: number): string | undefined {
  pattern.lastIndex = at;
  return pattern.exec(source)?.[0];
}

function highlightScript(source: string): string {
  const stack: Context[] = [{ kind: "js", depth: 0 }];
  let out = "";
  let at = 0;
  let previous = "";

  const openTag = (text: string, closing: boolean, name: string) => {
    out += token("punct", closing ? "</" : "<");
    if (name) out += token(/^[A-Z]/.test(name) ? "type" : "tag", name);
    stack.push({ kind: "tag", closing, name });
    at += text.length;
  };

  while (at < source.length) {
    const context = stack[stack.length - 1]!;
    let text: string | undefined;

    if (context.kind === "text") {
      if (source.startsWith("<", at)) {
        text = match(TAG_OPEN, source, at)!;
        openTag(text, text.startsWith("</"), text.replace(/^<\/?/, ""));
      } else if (source[at] === "{") {
        out += token("punct", "{");
        stack.push({ kind: "js", depth: 0 });
        previous = "{";
        at++;
      } else {
        text = match(TEXT, source, at)!;
        out += escapeHtml(text);
        at += text.length;
      }
      continue;
    }

    if (context.kind === "tag") {
      if ((text = match(WS, source, at))) {
        out += text;
      } else if (source.startsWith("/>", at)) {
        text = "/>";
        out += token("punct", text);
        stack.pop();
        previous = ")";
      } else if (source[at] === ">") {
        text = ">";
        out += token("punct", text);
        stack.pop();
        if (context.closing) {
          stack.pop(); // the element's children
          previous = ")";
        } else {
          stack.push({ kind: "text" });
          if (context.name === "style") {
            // A style block: CSS up to the closing tag.
            const end = source.indexOf("</style", at + 1);
            const css = source.slice(at + 1, end === -1 ? source.length : end);
            out += highlightCss(css);
            at += css.length;
          }
        }
      } else if (source[at] === "{") {
        text = "{";
        out += token("punct", text);
        stack.push({ kind: "js", depth: 0 });
        previous = "{";
      } else if ((text = match(STRING, source, at))) {
        out += token("string", text);
      } else if ((text = match(ATTR, source, at))) {
        out += token("attr", text);
      } else {
        text = source[at]!;
        out += token("punct", text);
      }
      at += text.length;
      continue;
    }

    // JS code.
    if ((text = match(WS, source, at))) {
      out += text;
    } else if ((text = match(COMMENT, source, at))) {
      out += token("comment", text);
    } else if ((text = match(STRING, source, at))) {
      out += token("string", text);
      previous = "string";
    } else if ((text = match(NUMBER, source, at))) {
      out += token("number", text);
      previous = "number";
    } else if ((text = match(IDENT, source, at))) {
      const next = source.slice(at + text.length).match(/^\s*(.)/)?.[1];
      const kind: TokenKind | undefined = KEYWORDS.has(text)
        ? "keyword"
        : next === "("
          ? "fn"
          : /^[A-Z]/.test(text)
            ? "type"
            : undefined;
      out += kind ? token(kind, text) : escapeHtml(text);
      previous = KEYWORDS.has(text) && JSX_AFTER_KEYWORD.has(text) ? "" : "ident";
    } else if (
      source[at] === "<" &&
      JSX_AFTER.has(previous) &&
      (text = match(TAG_OPEN, source, at)) &&
      (text.length > 1 || source[at + 1] === ">")
    ) {
      openTag(text, text.startsWith("</"), text.replace(/^<\/?/, ""));
      continue;
    } else if (source[at] === "{") {
      text = "{";
      context.depth++;
      out += token("punct", text);
      previous = "{";
    } else if (source[at] === "}") {
      text = "}";
      out += token("punct", text);
      if (context.depth === 0 && stack.length > 1) stack.pop();
      else context.depth--;
      previous = "}";
    } else {
      text = match(OPERATOR, source, at)!;
      out += token("punct", text);
      previous = text === ")" || text === "]" ? "ident" : text;
    }
    at += text.length;
  }
  return out;
}

// --- CSS -------------------------------------------------------------------------------------------

const CSS_TOKEN =
  /(\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(@[\w-]+)|(\$[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)|(#[\da-fA-F]{3,8}\b)|(-?(?:\d+\.?\d*|\.\d+)(?:%|[a-zA-Z]+\b)?)|(-{0,2}[A-Za-z_][\w-]*)|(\s+)|([\s\S])/g;
/** A declaration starts here: a name and `:`, with no `{` before the next `;` or `}`. */
const DECLARATION = /^\s*:(?![^;{}]*\{)/;

function highlightCss(source: string): string {
  let out = "";
  let value = false; // inside a declaration value
  let prelude = false; // inside an at-rule prelude
  for (const found of source.matchAll(CSS_TOKEN)) {
    const [text, comment, string, at, ref, hex, number, ident, space] = found;
    const rest = source.slice(found.index + text.length);
    if (comment) out += token("comment", text);
    else if (string) out += token("string", text);
    else if (at) {
      out += token("keyword", text);
      prelude = true;
    } else if (ref) out += token("ref", text);
    else if (hex) out += token(value ? "number" : "attr", text);
    else if (number) out += token("number", text);
    else if (ident) {
      if (rest.startsWith("(")) out += token("fn", text);
      else if (value || prelude) out += escapeHtml(text);
      else if (DECLARATION.test(rest)) out += token("prop", text);
      else out += token("tag", text);
    } else if (space) out += text;
    else {
      if (text === ":" && !prelude && DECLARATION.test(source.slice(found.index))) value = true;
      if (text === ";" || text === "{" || text === "}") {
        value = false;
        prelude = false;
      }
      out += token("punct", text);
    }
  }
  return out;
}

// --- Shell ---------------------------------------------------------------------------------------

const SHELL_WORD = /(#.*)|("(?:[^"\\]|\\.)*"|'[^']*')|([^\s"'#]+)|(\s+)/g;
const SHELL_SEPARATOR = new Set(["|", "||", "&&", ";"]);

function highlightShell(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      let out = "";
      let rest = line;
      const prompt = /^(\s*)\$(\s+)/.exec(line);
      if (prompt) {
        out += prompt[1] + token("punct", "$") + prompt[2];
        rest = line.slice(prompt[0].length);
      }
      let command = true;
      for (const [text, comment, string, word] of rest.matchAll(SHELL_WORD)) {
        if (comment) out += token("comment", text);
        else if (string) out += token("string", text);
        else if (word) {
          if (SHELL_SEPARATOR.has(word)) out += token("punct", word);
          else if (command) out += token("fn", word);
          else out += word.startsWith("-") ? token("attr", word) : escapeHtml(word);
          command = SHELL_SEPARATOR.has(word);
        } else out += text;
      }
      return out;
    })
    .join("\n");
}
