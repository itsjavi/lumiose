import { describe, expect, it } from "vitest";

// The addon exists only after `pnpm --filter @lumen/compiler build`.
const binding = await import("../index.js").catch(() => undefined);

describe.skipIf(!binding)("@lumen/compiler native scan", () => {
  const { scan, version } = binding!;

  const source = [
    'const radius = { lg: "12px" } as const;',
    "export const Card = () => (",
    '  <div class="card">',
    "    Grüße 🎉",
    "    <style>",
    "      .card { border-radius: $radius.lg; }",
    "    </style>",
    "  </div>",
    ");",
    "<style>",
    '  .card::after { content: "→"; margin: $radius.lg }',
    "</style>",
    "",
  ].join("\n");

  it("reports blocks, placements and references in UTF-16 offsets", () => {
    const result = scan(source, "/src/Card.stsx");
    expect(result.kind).toBe("stsx");
    expect(result.diagnostics).toEqual([]);
    expect(result.blocks.map((block) => block.placement)).toEqual(["jsx", "top-level"]);
    expect(result.blocks[0]!.parent).toMatchObject({ kind: "intrinsic", name: "div" });

    for (const block of result.blocks) {
      expect(source.slice(block.span.start, block.span.start + 6)).toBe("<style");
      const [ref] = block.refs;
      expect(ref!.path).toEqual(["radius", "lg"]);
      expect(source.slice(ref!.span.start, ref!.span.end)).toBe("$radius.lg");
    }
  });

  it("returns masked TSX that is offset-identical to the source", () => {
    const { masked, blocks } = scan(source, "Card.stsx");
    expect(masked.length).toBe(source.length);
    expect(masked.split("\n").length).toBe(source.split("\n").length);
    const [jsx, topLevel] = blocks;
    expect(masked.slice(jsx!.refs[0]!.span.start, jsx!.refs[0]!.close! + 1)).toBe("{radius.lg}");
    expect(masked.slice(topLevel!.refs[0]!.span.start, topLevel!.refs[0]!.close! + 1)).toBe(
      ";radius.lg;",
    );
    expect(masked.slice(0, jsx!.span.start)).toBe(source.slice(0, jsx!.span.start));
  });

  it("returns diagnostics with stable codes and docs topics", () => {
    const result = scan("export const A = () => <B><style>.a {}</style></B>;\n", "A.stsx");
    expect(result.diagnostics).toMatchObject([
      { code: "LUM3010", severity: "error", docs: "diagnostics/LUM3010" },
    ]);
    expect(version()).toBe("0.0.0");
  });

  it("is the identity for scripts", () => {
    const text = "const x = <T,>(v: T) => v; // <style>\n";
    expect(scan(text, "x.ts")).toEqual({
      kind: "script",
      masked: text,
      blocks: [],
      diagnostics: [],
    });
  });
});
