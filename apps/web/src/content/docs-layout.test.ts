// The docs layout (TASK-608): sections, rows (words beside code) and the step bar come from the
// Markdown's structure alone.
import { describe, expect, it } from "vitest";
import { docPages, findDoc, layoutRows, type DocBlock, type LayoutItem } from "./docs.ts";

const words = (html: string, bare = false): LayoutItem => ({ block: { kind: "html", html }, bare });
const code = (text: string): LayoutItem => ({
  block: { kind: "code", code: text, lang: "ts" },
  bare: false,
});
const table: LayoutItem = { block: { kind: "html", html: "<table>", wide: true }, bare: false };
/** A row's shape: `lead | code,code | tail` for a pair, the block's kind for a full row. */
const shape = (items: LayoutItem[]) =>
  layoutRows(items).map((row) => {
    if (row.kind === "pair") {
      return `${row.lead ?? ""} | ${row.aside.map((block) => block.code).join(",")} | ${row.tail ?? ""}`;
    }
    const block: DocBlock = row.block;
    return block.kind === "html"
      ? block.html
      : block.kind === "code"
        ? `code ${block.code}`
        : "palette";
  });

describe("layoutRows", () => {
  it("sets words beside the code blocks that follow them", () => {
    expect(shape([words("a"), code("1"), code("2"), words("b"), code("3")])).toEqual([
      "a | 1,2 | ",
      "b | 3 | ",
    ]);
  });

  it("keeps words without code, and tables, as rows of their own", () => {
    expect(shape([words("a"), table, words("b")])).toEqual(["a", "<table>", "b"]);
    expect(shape([words("a"), code("1"), table, words("b")])).toEqual(["a | 1 | ", "<table>", "b"]);
  });

  it("puts the words after the code below a heading that stands alone", () => {
    expect(shape([words("h", true), code("1"), words("after")])).toEqual(["h | 1 | after"]);
    // …but not when the left side already has words, or when more code follows them.
    expect(shape([words("a"), code("1"), words("after")])).toEqual(["a | 1 | ", "after"]);
    expect(shape([words("h", true), code("1"), words("b"), code("2")])).toEqual([
      "h | 1 | ",
      "b | 2 | ",
    ]);
  });

  it("leaves code with no words around it in one column", () => {
    expect(shape([code("1"), code("2")])).toEqual(["code 1", "code 2"]);
    expect(shape([code("1"), words("after")])).toEqual([" | 1 | after"]);
  });
});

describe("the docs pages' sections", () => {
  it("hold every block of the page, in order", () => {
    for (const page of docPages()) {
      const codes = page.sections.flatMap((section) =>
        section.rows.flatMap((row) =>
          row.kind === "pair" ? row.aside : row.block.kind === "code" ? [row.block] : [],
        ),
      );
      expect(codes, page.topic).toEqual(page.blocks.filter((block) => block.kind === "code"));
      expect(
        page.sections.flatMap((section) => (section.heading ? [section.heading] : [])),
        page.topic,
      ).toEqual(page.headings);
    }
  });

  it("finds numbered steps, and only where the headings count from 1", () => {
    const start = findDoc("getting-started")!;
    expect(start.steps.map((step) => [step.step, step.id])).toEqual([
      [1, "1-create-a-project"],
      [2, "2-write-a-component"],
      [3, "3-style-it"],
      [4, "4-check-it"],
    ]);
    // The heading shows the number as a label; its id, and so its URL, keeps it.
    const html = start.blocks.map((block) => (block.kind === "html" ? block.html : "")).join("");
    expect(html).toContain('<h2 id="1-create-a-project">');
    expect(html).toContain('<span class="step">Step 1</span> Create a project</h2>');
    expect(findDoc("concepts/signals")!.steps).toEqual([]);
  });

  it("lays a step with code out as a pair, and a section without code in one column", () => {
    const start = findDoc("getting-started")!;
    const section = (id: string) => start.sections.find((part) => part.heading?.id === id)!;
    expect(section("4-check-it").rows.map((row) => row.kind)).toEqual(["pair"]);
    expect(section("editor").rows.every((row) => row.kind === "full")).toBe(true);
  });
});
