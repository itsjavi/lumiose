// The JSX structure of masked TSX: element extents (decision-23 scopes a nested `<style>` to its
// enclosing element's lexical subtree) and the syntactic context of an offset (completion
// snippets). A recursive-descent lexer: JS code with strings, templates, comments and regexes
// scanned atomically, and JSX elements where an expression may start. A `<` that does not open a
// well-formed element (`type F = <T>(x: T) => T`) is re-read as an operator.

/** A JSX element or fragment; offsets are UTF-16 code units. */
export interface JsxElement {
  /** The `<` of the opening tag. */
  start: number;
  /** The tag name as written; empty for fragments. */
  name: string;
  /** The name's start, as the scanner reports a block's parent (fragments: `start`). */
  nameStart: number;
  /** After the opening tag's `>` (or `/>`). */
  openEnd: number;
  /** After the closing tag (`openEnd` when self-closing); before a mismatched closing tag. */
  end: number;
}

export type RegionKind =
  | "code" // inside `(…)`, `[…]` or `{…}` of JS code
  | "string"
  | "template"
  | "comment"
  | "regex"
  | "jsx-tag" // between an opening tag's `<` and `>`
  | "jsx-children" // between an element's `>` and its closing `</`
  | "jsx-expression"; // inside a JSX `{…}` container

/** A region's inner range: offsets from `start` through `end` (both inclusive) are inside. */
export interface Region {
  kind: RegionKind;
  start: number;
  end: number;
}

export class JsxStructure {
  readonly elements: readonly JsxElement[];
  /** In pre-order: a region comes before the regions nested in it. */
  readonly regions: readonly Region[];
  readonly #byName = new Map<number, JsxElement>();

  constructor(elements: JsxElement[], regions: Region[]) {
    this.elements = elements;
    this.regions = regions;
    for (const element of elements) this.#byName.set(element.nameStart, element);
  }

  /** The element whose name starts at `nameStart` (a fragment's: its `<`). */
  elementAt(nameStart: number): JsxElement | undefined {
    return this.#byName.get(nameStart);
  }

  /** The innermost region containing `offset`; `undefined` at the top level of the module. */
  contextAt(offset: number): Region | undefined {
    let found: Region | undefined;
    for (const region of this.regions) {
      if (region.start > offset) break;
      if (offset <= region.end) found = region;
    }
    return found;
  }
}

export function jsxStructure(text: string): JsxStructure {
  const lexer = new Lexer(text);
  lexer.js(0, undefined);
  return new JsxStructure(lexer.elements, lexer.regions);
}

/** Keywords after which an expression (a regex or JSX) may start. */
const EXPRESSION_KEYWORDS = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "case",
  "do",
  "else",
  "yield",
  "await",
]);

const IDENT_START = /[\p{ID_Start}$_\\]/u;
const IDENT_PART = /[\p{ID_Continue}$‌‍]/u;
const JSX_NAME_PART = /[\p{ID_Continue}$\-:.]/u;

class Lexer {
  readonly text: string;
  readonly elements: JsxElement[] = [];
  readonly regions: Region[] = [];
  /** Tag names of the current root's elements being read, innermost last. */
  #open: string[] = [];

  constructor(text: string) {
    this.text = text;
  }

  #region(kind: RegionKind, start: number): Region {
    const region: Region = { kind, start, end: this.text.length };
    this.regions.push(region);
    return region;
  }

  /** JS code from `i` through `closer` (or the end); returns the offset after the closer. */
  js(i: number, closer: string | undefined): number {
    const { text } = this;
    // Whether an expression may start here (a `/` is a regex, a `<` may open JSX).
    let operand = true;
    while (i < text.length) {
      const c = text[i]!;
      if (c === closer) return i + 1;
      if (c === " " || c === "\t" || c === "\n" || c === "\r") {
        i++;
      } else if (c === "/" && (text[i + 1] === "/" || text[i + 1] === "*")) {
        i = this.#comment(i);
      } else if (c === '"' || c === "'") {
        i = this.#string(i);
        operand = false;
      } else if (c === "`") {
        i = this.#template(i);
        operand = false;
      } else if (c === "/" && operand) {
        i = this.#regex(i);
        operand = false;
      } else if (c === "(" || c === "[" || c === "{") {
        const region = this.#region("code", i + 1);
        i = this.js(i + 1, c === "(" ? ")" : c === "[" ? "]" : "}");
        region.end = i - 1;
        // After a block `}` a statement (or an expression statement) may start.
        operand = c === "{";
      } else if (c === "<" && operand && this.#jsxAhead(i)) {
        const end = this.#root(i);
        if (end === undefined) {
          i++;
        } else {
          i = end;
          operand = false;
        }
      } else if (IDENT_START.test(c)) {
        const start = i;
        i = this.#identEnd(i + 1);
        operand = EXPRESSION_KEYWORDS.has(text.slice(start, i));
      } else if (c >= "0" && c <= "9") {
        while (i < text.length && /[\w.]/.test(text[i]!)) i++;
        operand = false;
      } else if (c === ")" || c === "]" || c === "}") {
        i++; // unbalanced
        operand = false;
      } else {
        // Operators and punctuation; `=>` ends with `>`, after which JSX may start too.
        i++;
        operand = true;
      }
    }
    return i;
  }

  #identEnd(i: number): number {
    const { text } = this;
    while (i < text.length) {
      if (text[i] === "\\") i += 2;
      else if (IDENT_PART.test(text[i]!)) i++;
      else break;
    }
    return i;
  }

  #comment(i: number): number {
    const { text } = this;
    const region = this.#region("comment", i + 2);
    if (text[i + 1] === "/") {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end;
      region.end = i;
      return i;
    }
    const end = text.indexOf("*/", i + 2);
    region.end = end === -1 ? text.length : end;
    return end === -1 ? text.length : end + 2;
  }

  #string(i: number): number {
    const { text } = this;
    const quote = text[i];
    const region = this.#region("string", i + 1);
    for (let j = i + 1; j < text.length; j++) {
      const c = text[j];
      if (c === "\\") j++;
      else if (c === quote || c === "\n") {
        region.end = j;
        return j + 1;
      }
    }
    return text.length;
  }

  #template(i: number): number {
    const { text } = this;
    const region = this.#region("template", i + 1);
    for (let j = i + 1; j < text.length; j++) {
      const c = text[j];
      if (c === "\\") j++;
      else if (c === "`") {
        region.end = j;
        return j + 1;
      } else if (c === "$" && text[j + 1] === "{") {
        const code = this.#region("code", j + 2);
        j = this.js(j + 2, "}");
        code.end = j - 1;
        j--;
      }
    }
    return text.length;
  }

  /** A regex literal; a `/` without a closing `/` on its line is read as division. */
  #regex(i: number): number {
    const { text } = this;
    let inClass = false;
    for (let j = i + 1; j < text.length; j++) {
      const c = text[j];
      if (c === "\\") j++;
      else if (c === "\n") return i + 1;
      else if (c === "[") inClass = true;
      else if (c === "]") inClass = false;
      else if (c === "/" && !inClass) {
        this.regions.push({ kind: "regex", start: i + 1, end: j });
        return this.#identEnd(j + 1);
      }
    }
    return i + 1;
  }

  #skipTrivia(i: number): number {
    const { text } = this;
    while (i < text.length) {
      const c = text[i]!;
      if (c === " " || c === "\t" || c === "\n" || c === "\r") i++;
      else if (c === "/" && text[i + 1] === "/") {
        const end = text.indexOf("\n", i);
        i = end === -1 ? text.length : end;
      } else if (c === "/" && text[i + 1] === "*") {
        const end = text.indexOf("*/", i + 2);
        i = end === -1 ? text.length : end + 2;
      } else break;
    }
    return i;
  }

  /**
   * Whether JSX starts at an expression-start `<`. TypeScript's TSX rule for generic arrow
   * functions: `<T,>`, `<T = …>` and `<T extends U>` are type parameters.
   */
  #jsxAhead(i: number): boolean {
    const { text } = this;
    let at = this.#skipTrivia(i + 1);
    if (text[at] === ">") return true;
    if (!IDENT_START.test(text[at] ?? "")) return false;
    let end = this.#identEnd(at + 1);
    let name = text.slice(at, end);
    at = this.#skipTrivia(end);
    if (name === "const" && IDENT_START.test(text[at] ?? "")) {
      end = this.#identEnd(at + 1);
      name = text.slice(at, end);
      at = this.#skipTrivia(end);
    }
    const next = text[at];
    if (next === "," || next === "=") return false;
    if (text.startsWith("extends", at) && !IDENT_PART.test(text[at + 7] ?? "")) {
      const after = text[this.#skipTrivia(at + 7)];
      return after === "=" || after === ">" || after === "/";
    }
    return true;
  }

  /** A JSX element where JS expects an expression; `undefined` (nothing recorded) if malformed. */
  #root(i: number): number | undefined {
    const elements = this.elements.length;
    const regions = this.regions.length;
    // Implicit closing (below) stays within one root: `{x.map(() => <li>…)}` cannot close `<ul>`.
    const outer = this.#open;
    this.#open = [];
    const end = this.#element(i);
    this.#open = outer;
    if (end === undefined) {
      this.elements.length = elements;
      this.regions.length = regions;
    }
    return end;
  }

  #element(lt: number): number | undefined {
    const { text } = this;
    let i = this.#skipTrivia(lt + 1);
    const element: JsxElement = { start: lt, name: "", nameStart: lt, openEnd: -1, end: -1 };
    this.elements.push(element);
    const tag = this.#region("jsx-tag", lt + 1);
    if (text[i] !== ">") {
      if (!IDENT_START.test(text[i] ?? "")) return undefined;
      const nameStart = i;
      while (i < text.length && JSX_NAME_PART.test(text[i]!)) i++;
      element.name = text.slice(nameStart, i);
      element.nameStart = nameStart;
      i = this.#skipTrivia(i);
      if (text[i] === "<") i = this.#typeArguments(i);
      // Attributes.
      for (;;) {
        i = this.#skipTrivia(i);
        const c = text[i];
        if (c === undefined) return undefined;
        if (c === ">") break;
        if (c === "/" && text[i + 1] === ">") {
          tag.end = i;
          element.openEnd = element.end = i + 2;
          return i + 2;
        }
        if (c === "{") {
          i = this.#container(i);
        } else if (c === '"' || c === "'") {
          const close = text.indexOf(c, i + 1);
          if (close === -1) return undefined;
          this.regions.push({ kind: "string", start: i + 1, end: close });
          i = close + 1;
        } else if (c === "<") {
          const end = this.#element(i); // `attr=<b />`
          if (end === undefined) return undefined;
          i = end;
        } else if (c === "=" || JSX_NAME_PART.test(c)) {
          i++;
        } else {
          return undefined;
        }
      }
    }
    tag.end = i;
    element.openEnd = i + 1;
    return this.#children(element, i + 1);
  }

  /** Children through the closing tag. */
  #children(element: JsxElement, i: number): number | undefined {
    const { text } = this;
    const region = this.#region("jsx-children", i);
    this.#open.push(element.name);
    try {
      while (i < text.length) {
        const c = text[i];
        if (c === "{") {
          i = this.#container(i);
        } else if (c === "<") {
          const at = this.#skipTrivia(i + 1);
          if (text[at] !== "/") {
            const end = this.#element(i);
            if (end === undefined) return undefined;
            i = end;
            continue;
          }
          let nameEnd = this.#skipTrivia(at + 1);
          const nameStart = nameEnd;
          while (nameEnd < text.length && JSX_NAME_PART.test(text[nameEnd]!)) nameEnd++;
          const name = text.slice(nameStart, nameEnd);
          region.end = i;
          if (name !== element.name) {
            // Unclosed while editing: a closing tag of an enclosing element ends this one too.
            if (!this.#open.slice(0, -1).includes(name)) return undefined;
            element.end = i;
            return i;
          }
          const close = this.#skipTrivia(nameEnd);
          if (text[close] !== ">") return undefined;
          element.end = close + 1;
          return close + 1;
        } else {
          i++;
        }
      }
      return undefined; // unclosed at the end of the text
    } finally {
      this.#open.pop();
    }
  }

  /** A JSX `{…}` container (expression, spread or comment). */
  #container(i: number): number {
    const region = this.#region("jsx-expression", i + 1);
    const end = this.js(i + 1, "}");
    region.end = end - 1;
    return end;
  }

  /** `<Select<Option> …>`: skips the type arguments. */
  #typeArguments(i: number): number {
    const { text } = this;
    let depth = 0;
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === "<") depth++;
      else if (c === ">" && text[i - 1] !== "=") {
        depth--;
        if (depth === 0) return i + 1;
      } else if (c === '"' || c === "'") {
        i = this.#string(i) - 1;
        this.regions.pop();
      }
    }
    return i;
  }
}
