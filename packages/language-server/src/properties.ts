// Custom property declarations (`--brand: #f60;`) in CSS text, and the completion contexts where
// custom property names are typed: `var(--…)` arguments and declaration names. Lexical, on texts
// that keep source offsets (virtual CSS of a block, or a `.css` file).

/** A custom property declaration: the name's and the value's offsets, and the rule's selector. */
export interface PropertyDeclaration {
  /** With its dashes: `--brand`. */
  name: string;
  start: number;
  end: number;
  valueStart: number;
  valueEnd: number;
  /** The enclosing rule preludes, outermost first, whitespace collapsed (`:root`, `@media … .x`). */
  selector: string;
}

/** Custom property declarations in `css[from, to)`. */
export function propertyDeclarations(
  css: string,
  from = 0,
  to = css.length,
): PropertyDeclaration[] {
  const found: PropertyDeclaration[] = [];
  const preludes: string[] = [];
  let segment = from; // where the current prelude or declaration starts
  let i = from;
  while (i < to) {
    const c = css[i];
    if (c === "/" && css[i + 1] === "*") {
      const close = css.indexOf("*/", i + 2);
      i = close === -1 || close + 2 > to ? to : close + 2;
    } else if (c === '"' || c === "'") {
      i = skipString(css, i, to);
    } else if (c === "{") {
      preludes.push(collapse(css.slice(segment, i)));
      segment = ++i;
    } else if (c === "}") {
      preludes.pop();
      segment = ++i;
    } else if (c === ";") {
      segment = ++i;
    } else if (
      c === "-" &&
      css[i + 1] === "-" &&
      preludes.length > 0 &&
      onlyTrivia(css.slice(segment, i))
    ) {
      const end = identEnd(css, i + 2, to);
      let colon = end;
      while (colon < to && /\s/.test(css[colon]!)) colon++;
      if (css[colon] !== ":") {
        i = end;
        continue;
      }
      const valueEnd = declarationEnd(css, colon + 1, to);
      let valueStart = colon + 1;
      while (valueStart < valueEnd && /\s/.test(css[valueStart]!)) valueStart++;
      let trimmed = valueEnd;
      while (trimmed > valueStart && /\s/.test(css[trimmed - 1]!)) trimmed--;
      found.push({
        name: css.slice(i, end),
        start: i,
        end,
        valueStart,
        valueEnd: trimmed,
        selector: preludes.filter(Boolean).join(" "),
      });
      i = valueEnd;
    } else {
      i++;
    }
  }
  return found;
}

/** Where a custom property name is being typed, with the range it replaces. */
export interface PropertyContext {
  kind: "var" | "declaration";
  /** The typed name so far (`--br`, `-`, or empty right after `var(`). */
  typed: string;
  start: number;
  end: number;
}

/**
 * The custom property context at `offset` of `css`: inside `var(` (an empty or `-`-prefixed
 * name), or at a declaration's start in a rule body (a name typed with `--`). Block bounds
 * `[from, to)` keep the search inside one block.
 */
export function propertyContext(
  css: string,
  offset: number,
  from = 0,
  to = css.length,
): PropertyContext | undefined {
  let start = offset;
  while (start > from && /[\w\-\u0080-￿]/.test(css[start - 1]!)) start--;
  let end = offset;
  while (end < to && /[\w\-\u0080-￿]/.test(css[end]!)) end++;
  const typed = css.slice(start, offset);
  if (typed !== "" && !typed.startsWith("-")) return undefined;
  let before = start;
  while (before > from && /\s/.test(css[before - 1]!)) before--;
  if (/var\($/i.test(css.slice(Math.max(from, before - 4), before))) {
    return { kind: "var", typed, start, end };
  }
  if (!typed.startsWith("--")) return undefined;
  const previous = css[before - 1];
  if (previous === "{" || previous === ";") return { kind: "declaration", typed, start, end };
  return undefined;
}

function identEnd(css: string, i: number, to: number): number {
  while (i < to) {
    const c = css[i]!;
    if (c === "\\" && i + 1 < to) i += 2;
    else if (/[\w\-\u0080-￿]/.test(c)) i++;
    else break;
  }
  return i;
}

/** The end of a declaration value: the `;` or `}` closing it at nesting depth 0. */
function declarationEnd(css: string, i: number, to: number): number {
  let depth = 0;
  while (i < to) {
    const c = css[i];
    if (c === '"' || c === "'") {
      i = skipString(css, i, to);
      continue;
    }
    if (c === "/" && css[i + 1] === "*") {
      const close = css.indexOf("*/", i + 2);
      i = close === -1 || close + 2 > to ? to : close + 2;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") depth++;
    else if ((c === ")" || c === "]") && depth > 0) depth--;
    else if (c === "}") {
      if (depth === 0) return i;
      depth--;
    } else if (c === ";" && depth === 0) return i;
    i++;
  }
  return to;
}

function skipString(css: string, i: number, to: number): number {
  const quote = css[i];
  for (let j = i + 1; j < to; j++) {
    if (css[j] === "\\") j++;
    else if (css[j] === quote || css[j] === "\n") return j + 1;
  }
  return to;
}

function onlyTrivia(text: string): boolean {
  return /^\s*(?:\/\*[\s\S]*?\*\/\s*)*$/.test(text);
}

function collapse(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
