// Class names on both sides of an `.stsx` file (spec §9.2 cross-language features):
// - selector classes in style blocks (`.button` in `.button:hover { … }`);
// - class usages in JSX `class` attributes: `class="a b"`, `class={["a", on && "b"]}`,
//   `class={{ a: on, "b-c": off }}`; also `className` (React) and Solid's `classList` in projects
//   that use `.stsx` through @lumiose/stsx (decision-86).
// Both are found lexically on texts that keep source offsets (the virtual CSS and the masked
// TSX), so every occurrence is a UTF-16 range in the source.

/** A class name and the UTF-16 range of the name (without the dot or quotes). */
export interface ClassOccurrence {
  name: string;
  start: number;
  end: number;
}

/** A range inside a `class` attribute value where class names are written (for completion). */
export interface ClassSlot {
  /** A string's contents, or an identifier key of an object literal. */
  kind: "string" | "key";
  start: number;
  end: number;
}

/** A class name used in a `class` attribute; `key` marks an unquoted object-literal key. */
export interface ClassUsage extends ClassOccurrence {
  key?: boolean;
}

export interface ClassAttributes {
  usages: ClassUsage[];
  slots: ClassSlot[];
}

/** Selector classes in `css[from, to)`; at-rule preludes, declarations and comments are skipped. */
export function selectorClasses(css: string, from = 0, to = css.length): ClassOccurrence[] {
  const found: ClassOccurrence[] = [];
  let preludeStart = from;
  let parens = 0;
  let i = from;
  while (i < to) {
    const c = css[i];
    if (c === "/" && css[i + 1] === "*") {
      i = skipComment(css, i, to);
      continue;
    }
    if (c === '"' || c === "'") {
      i = skipCssString(css, i, to);
      continue;
    }
    if (c === "(") parens++;
    else if (c === ")") parens = Math.max(0, parens - 1);
    else if (parens === 0 && c === "{") {
      collectPrelude(css, preludeStart, i, found);
      preludeStart = i + 1;
    } else if (parens === 0 && (c === "}" || c === ";")) {
      preludeStart = i + 1;
    }
    i++;
  }
  return found;
}

function collectPrelude(css: string, from: number, to: number, found: ClassOccurrence[]): void {
  let i = from;
  while (i < to && /\s/.test(css[i]!)) i++;
  if (css[i] === "@") return; // at-rule preludes (`@media …`) hold no selectors
  while (i < to) {
    const c = css[i];
    if (c === "/" && css[i + 1] === "*") {
      i = skipComment(css, i, to);
    } else if (c === '"' || c === "'") {
      i = skipCssString(css, i, to);
    } else if (c === "[") {
      // Attribute selectors (`[class~="a.b"]`) are not class selectors.
      i++;
      while (i < to && css[i] !== "]") {
        i = css[i] === '"' || css[i] === "'" ? skipCssString(css, i, to) : i + 1;
      }
    } else if (c === "." && isNameStart(css, i + 1) && !/[0-9]/.test(css[i - 1] ?? "")) {
      const end = nameEnd(css, i + 1, to);
      found.push({ name: unescapeCss(css.slice(i + 1, end)), start: i + 1, end });
      i = end;
    } else {
      i++;
    }
  }
}

function isNameStart(css: string, i: number): boolean {
  const c = css[i];
  if (c === undefined) return false;
  if (c === "-") return /[A-Za-z_\-\\\u0080-￿]/.test(css[i + 1] ?? "");
  return /[A-Za-z_\\\u0080-￿]/.test(c);
}

function nameEnd(css: string, i: number, to: number): number {
  while (i < to) {
    const c = css[i]!;
    if (c === "\\" && i + 1 < to) i += 2;
    else if (/[A-Za-z0-9_\-\u0080-￿]/.test(c)) i++;
    else break;
  }
  return i;
}

function unescapeCss(name: string): string {
  if (!name.includes("\\")) return name;
  return name.replace(/\\([0-9a-fA-F]{1,6}\s?|[\s\S])/g, (_, escape: string) =>
    /^[0-9a-fA-F]/.test(escape) ? String.fromCodePoint(Number.parseInt(escape.trim(), 16)) : escape,
  );
}

function skipComment(text: string, i: number, to: number): number {
  const close = text.indexOf("*/", i + 2);
  return close === -1 || close + 2 > to ? to : close + 2;
}

function skipCssString(css: string, i: number, to: number): number {
  const quote = css[i];
  for (let j = i + 1; j < to; j++) {
    if (css[j] === "\\") j++;
    else if (css[j] === quote || css[j] === "\n") return j + 1;
  }
  return to;
}

/** `class` attributes in masked TSX: the class names they contain and their editable slots. */
export function classAttributes(tsx: string): ClassAttributes {
  const result: ClassAttributes = { usages: [], slots: [] };
  for (const match of tsx.matchAll(/(?<=\s)(?:class|className|classList)\s*=\s*/g)) {
    const start = match.index + match[0].length;
    const c = tsx[start];
    if (c === '"' || c === "'") {
      // JSX attribute strings have no escapes and may span lines.
      const close = tsx.indexOf(c, start + 1);
      addString(result, tsx, start + 1, close === -1 ? tsx.length : close);
    } else if (c === "{") {
      scanExpression(tsx, start, result);
    }
  }
  return result;
}

function addString(result: ClassAttributes, text: string, start: number, end: number): void {
  result.slots.push({ kind: "string", start, end });
  for (const token of text.slice(start, end).matchAll(/\S+/g)) {
    result.usages.push({
      name: token[0],
      start: start + token.index,
      end: start + token.index + token[0].length,
    });
  }
}

interface Frame {
  kind: "container" | "object" | "array" | "paren";
  /** In an object literal: whether the next token is a property key. */
  key: boolean;
}

/**
 * Collects class names from a `class={…}` expression starting at `open` (the `{`): strings at the
 * top level or in arrays (`cond && "a"`, ternaries), and object-literal keys. Strings in object
 * values and call arguments are not class names.
 */
function scanExpression(text: string, open: number, result: ClassAttributes): void {
  const stack: Frame[] = [{ kind: "container", key: false }];
  let i = open + 1;
  while (i < text.length && stack.length > 0) {
    const top = stack.at(-1)!;
    const c = text[i]!;
    if (/\s/.test(c)) {
      i++;
    } else if (c === "/" && text[i + 1] === "/") {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end;
    } else if (c === "/" && text[i + 1] === "*") {
      i = skipComment(text, i, text.length);
    } else if (c === '"' || c === "'") {
      const end = skipJsString(text, i);
      const closed = text[end - 1] === c && end - 1 > i;
      if (top.kind !== "paren" && (top.kind !== "object" || top.key)) {
        addString(result, text, i + 1, closed ? end - 1 : end);
      }
      i = end;
    } else if (c === "`") {
      i = skipTemplate(text, i);
    } else if (c === "{") {
      stack.push({ kind: "object", key: true });
      i++;
    } else if (c === "[") {
      stack.push({ kind: "array", key: false });
      i++;
    } else if (c === "(") {
      stack.push({ kind: "paren", key: false });
      i++;
    } else if (c === "}" || c === "]" || c === ")") {
      stack.pop();
      i++;
    } else if (c === ",") {
      if (top.kind === "object") top.key = true;
      i++;
    } else if (c === ":") {
      if (top.kind === "object") top.key = false;
      i++;
    } else if (c === "." && text.startsWith("...", i)) {
      if (top.kind === "object") top.key = false; // `...rest` is not a key
      i += 3;
    } else if (/[\p{ID_Start}$_]/u.test(c)) {
      let end = i + 1;
      while (end < text.length && /[\p{ID_Continue}$‌‍]/u.test(text[end]!)) end++;
      if (top.kind === "object" && top.key) {
        result.slots.push({ kind: "key", start: i, end });
        result.usages.push({ name: text.slice(i, end), start: i, end, key: true });
        top.key = false;
      }
      i = end;
    } else {
      i++;
    }
  }
}

function skipJsString(text: string, i: number): number {
  const quote = text[i];
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === "\\") j++;
    else if (text[j] === quote) return j + 1;
    else if (text[j] === "\n") return j;
  }
  return text.length;
}

function skipTemplate(text: string, i: number): number {
  let depth = 0;
  for (let j = i + 1; j < text.length; j++) {
    const c = text[j];
    if (c === "\\") j++;
    else if (depth === 0 && c === "`") return j + 1;
    else if (c === "$" && text[j + 1] === "{") {
      depth++;
      j++;
    } else if (depth > 0 && c === "}") depth--;
  }
  return text.length;
}

/** A valid JS identifier can be an unquoted object key. */
export function isIdentifier(name: string): boolean {
  return /^[\p{ID_Start}$_][\p{ID_Continue}$‌‍]*$/u.test(name);
}
