import { describe, expect, it } from "vitest";

// The addon exists only after `pnpm --filter @lumen/compiler build`.
const binding = await import("../index.js").catch(() => undefined);

describe.skipIf(!binding)("@lumen/compiler native compile", () => {
  const { compile } = binding!;

  const source = [
    'import { signal } from "lumen";',
    'const radius = { lg: "12px" } as const;',
    "// Grüße 🎉",
    "export function Counter({ start = 0 }: { start?: number }) {",
    "  const count = signal(start);",
    "  return (",
    '    <button class="card" onClick={() => count.update((c) => c + 1)}>',
    "      {count()}",
    "      <style>.card { border-radius: $radius.lg; }</style>",
    "    </button>",
    "  );",
    "}",
    "",
  ].join("\n");

  it("returns JS, a source map and metadata", () => {
    const result = compile(source, "/src/Counter.stsx");
    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain('from "lumen/dom"');
    expect(result.code).toContain('import "/src/Counter.stsx?lumen&type=style&lang.css"');
    expect(result.code).not.toContain("start?: number");
    expect(JSON.parse(result.map!)).toMatchObject({ version: 3, sources: ["/src/Counter.stsx"] });
    expect(result.meta).toMatchObject({
      templates: 1,
      delegatedEvents: ["click"],
      hasStyles: true,
      components: [{ name: "Counter", exported: true, isAsync: false, awaitSites: [] }],
    });
    expect(result.meta.runtimeHelpers).toEqual(["template", "insert", "delegateEvents"]);
  });

  it("resolves $ref bindings with UTF-16 spans", () => {
    const [ref] = compile(source, "/src/Counter.stsx").meta.styleRefs;
    expect(ref).toMatchObject({ block: 0, path: ["radius", "lg"] });
    expect(source.slice(ref!.span.start, ref!.span.end)).toBe("$radius.lg");
    expect(ref!.binding).toMatchObject({ name: "radius", kind: "module", constant: true });
    expect(source.slice(ref!.binding!.declaration.start, ref!.binding!.declaration.end)).toBe(
      "radius",
    );
  });

  it("applies scope tokens and options", () => {
    const result = compile(source, "/src/Counter.stsx", {
      scopeTokens: { file: "data-l-f1", components: { Counter: "data-l-c1" } },
      sourceMap: false,
      styleImport: false,
    });
    expect(result.code).toContain("template(`<button class=card data-l-f1 data-l-c1>`)");
    expect(result.code).not.toContain("lang.css");
    expect(result.map).toBeUndefined();
  });

  it("reports diagnostics with UTF-16 spans", () => {
    const text = 'const s = "é";\nexport const A = () => <p>{s}</p>;\nA();\n';
    const result = compile(text, "/src/a.tsx");
    expect(result.diagnostics).toMatchObject([
      { code: "LUM2004", severity: "error", docs: "diagnostics/LUM2004" },
    ]);
    const { start, end } = result.diagnostics[0]!.span;
    expect(text.slice(start, end)).toBe("A()");
  });

  it("reports syntax errors and the unimplemented server target", () => {
    expect(compile("export const = ;", "/src/x.tsx").diagnostics[0]).toMatchObject({
      code: "LUM1001",
      severity: "error",
    });
    const server = compile(source, "/src/Counter.stsx", { target: "server" });
    expect(server.code).toBe("");
    expect(server.diagnostics).toMatchObject([{ code: "LUM1002", severity: "error" }]);
  });
});
