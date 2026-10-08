import { describe, expect, it } from "vitest";
import { jsxStructure } from "./jsx.ts";

/** Each element as `name: source text`, in source order. */
function elements(text: string): string[] {
  return jsxStructure(text).elements.map(
    (element) => `${element.name || "<>"}: ${text.slice(element.start, element.end)}`,
  );
}

describe("jsxStructure", () => {
  it("finds nested elements, fragments and self-closing tags with their extents", () => {
    const text = `export function A() {
  return (
    <div class="a">
      <section><p class="c1" /></section>
      <>
        <b>x</b>
      </>
    </div>
  );
}`;
    expect(elements(text)).toEqual([
      expect.stringMatching(/^div: <div class="a">[\s\S]*<\/div>$/),
      'section: <section><p class="c1" /></section>',
      'p: <p class="c1" />',
      expect.stringMatching(/^<>: <>\s*<b>x<\/b>\s*<\/>$/),
      "b: <b>x</b>",
    ]);
    const structure = jsxStructure(text);
    const fragment = structure.elements[3]!;
    expect(structure.elementAt(fragment.start)).toBe(fragment);
    expect(structure.elementAt(text.indexOf("section"))?.name).toBe("section");
  });

  it("reads JSX inside expression containers, apostrophes in text included", () => {
    const text = `const list = <ul>{items.map((item) => <li key={item}>Don't {item}</li>)}</ul>;
const after = <p>{a < b ? "<" : '>'}</p>;`;
    expect(elements(text)).toEqual([
      "ul: <ul>{items.map((item) => <li key={item}>Don't {item}</li>)}</ul>",
      "li: <li key={item}>Don't {item}</li>",
      `p: <p>{a < b ? "<" : '>'}</p>`,
    ]);
  });

  it("does not read type parameters, comparisons, regexes or strings as JSX", () => {
    const text = `const id = <T,>(value: T) => value;
type F = <T>(value: T) => T;
const less = a < b && c > d;
const re = /<div>/g;
const s = "<span>";
export const C = () => <i>{\`<b>\${1}</b>\`}</i>;`;
    expect(elements(text)).toEqual(["i: <i>{`<b>${1}</b>`}</i>"]);
  });

  it("ends an unclosed element where an enclosing element closes", () => {
    const text = `const x = <div><p>typing</div>;`;
    expect(elements(text)).toEqual(["div: <div><p>typing</div>", "p: <p>typing"]);
  });

  it("drops a root that never closes", () => {
    expect(elements(`const x = <div><p>typing`)).toEqual([]);
  });

  it("reports the syntactic context of an offset", () => {
    const text = `export const A = () => <div class="x" title={"t"}>text {value}</div>;\n`;
    const context = (needle: string, shift = 0) =>
      jsxStructure(text).contextAt(text.indexOf(needle) + shift)?.kind;
    expect(context("export")).toBeUndefined();
    expect(context("class")).toBe("jsx-tag");
    expect(context('"x"', 1)).toBe("string");
    expect(context("text")).toBe("jsx-children");
    expect(context("value")).toBe("jsx-expression");
    expect(context("\n", 1)).toBeUndefined();
  });
});
