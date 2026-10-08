import { describe, expect, it } from "vitest";
import { classAttributes, isIdentifier, selectorClasses } from "./classes.ts";

const names = (occurrences: Array<{ name: string }>) => occurrences.map(({ name }) => name);

describe("selectorClasses", () => {
  it("finds classes in selectors, including nested rules and :global()", () => {
    const css = `
      .a, .b:hover > .c::after { color: red; }
      @media (min-width: 10px) { .d { margin: 0.5em; } }
      .e { &.f { color: blue } .g & { x: y } }
      :global(.h) .i { }
      @keyframes spin { 12.5% { opacity: 0 } }
    `;
    expect(names(selectorClasses(css))).toEqual(["a", "b", "c", "d", "e", "f", "g", "h", "i"]);
  });

  it("skips attribute selectors, strings, comments and declaration values", () => {
    const css = `
      [class~="x.y"] /* .no */ .ok { background: url(a.png); content: ".no"; }
      .esc\\:aped { }
    `;
    const found = selectorClasses(css);
    expect(names(found)).toEqual(["ok", "esc:aped"]);
    const ok = found[0]!;
    expect(css.slice(ok.start, ok.end)).toBe("ok");
    expect(css.slice(found[1]!.start, found[1]!.end)).toBe("esc\\:aped");
  });

  it("respects the scanned range", () => {
    const css = ".a {} .b {} .c {}";
    expect(names(selectorClasses(css, 6, 11))).toEqual(["b"]);
  });
});

describe("classAttributes", () => {
  it("reads string attributes", () => {
    const tsx = `<div class="a  b-c"><i class='d' /></div>`;
    const { usages, slots } = classAttributes(tsx);
    expect(usages.map(({ name, start, end }) => [name, tsx.slice(start, end)])).toEqual([
      ["a", "a"],
      ["b-c", "b-c"],
      ["d", "d"],
    ]);
    expect(slots).toHaveLength(2);
  });

  it("reads arrays, ternaries and object keys but not values or call arguments", () => {
    const tsx = `<div class={["a", on() && "b", { c: x ? "no" : "no", "d-e": y, f }, fn("no"), \`no\`]} />`;
    const { usages } = classAttributes(tsx);
    expect(names(usages)).toEqual(["a", "b", "c", "d-e", "f"]);
    expect(usages.filter((usage) => usage.key).map(({ name }) => name)).toEqual(["c", "f"]);
  });

  it("reads top-level expressions and skips spreads", () => {
    const tsx = `<a class={cond ? "x" : "y"} /><b class={{ ...rest, z: 1 }} />`;
    expect(names(classAttributes(tsx).usages)).toEqual(["x", "y", "z"]);
  });

  it("ignores non-attribute `class` occurrences", () => {
    expect(classAttributes(`obj.class = "a"; const klass = 1;`).usages).toEqual([]);
  });

  it("keeps empty slots for completion", () => {
    const tsx = `<div class="" />`;
    expect(classAttributes(tsx).slots).toEqual([{ kind: "string", start: 12, end: 12 }]);
  });
});

it("isIdentifier", () => {
  expect(isIdentifier("active")).toBe(true);
  expect(isIdentifier("is-active")).toBe(false);
});
