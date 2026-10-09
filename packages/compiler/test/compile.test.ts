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

  it("stamps scope tokens and applies options", () => {
    const result = compile(source, "/src/Counter.stsx", {
      sourceMap: false,
      styleImport: false,
    });
    const token = result.meta.scopeTokens.components.Counter![0]!.attribute;
    expect(token).toMatch(/^data-l-[0-9a-z]{8}$/);
    expect(result.meta.scopeTokens.file).toBeUndefined();
    expect(result.code).toContain(`template(\`<button class=card ${token}>\`)`);
    expect(result.code).not.toContain("lang.css");
    expect(result.map).toBeUndefined();
    expect(result.cssMap).toBeUndefined();
  });

  it("compiles style blocks to scoped CSS with folded constants", () => {
    const result = compile(source, "/src/Counter.stsx", { root: "/" });
    const token = result.meta.scopeTokens.components.Counter![0]!.attribute;
    expect(result.css).toBe(`.card[${token}] {\n  border-radius: 12px;\n}\n`);
    expect(JSON.parse(result.cssMap!)).toMatchObject({
      version: 3,
      sources: ["/src/Counter.stsx"],
    });
    expect(result.meta.styleRefs[0]!.value).toBe("12px");
    expect(result.cssDeps).toEqual([]);
    // Minified for Safari 15: nesting is lowered.
    const nested =
      'export const A = () => <p class="a"><style>.a { & b { color: red } }</style></p>;';
    const minified = compile(nested, "/src/A.stsx", { cssMinify: true, cssTargets: ["safari 15"] });
    expect(minified.css).not.toContain("&");
    expect(minified.css).not.toContain("\n");
    expect(() => compile(nested, "/src/A.stsx", { cssTargets: ["not a browser 1"] })).toThrow(
      /cssTargets/,
    );
  });

  it("requests imported constants from the host", () => {
    const text = [
      'import { space } from "./tokens.ts";',
      'export const A = () => <p class="a"><style>.a { margin: $space.lg; }</style></p>;',
    ].join("\n");
    const first = compile(text, "/src/A.stsx");
    expect(first.moduleRequests).toEqual([{ importer: "/src/A.stsx", specifier: "./tokens.ts" }]);
    expect(first.css).toBeUndefined();
    const second = compile(text, "/src/A.stsx", {
      modules: [
        {
          importer: "/src/A.stsx",
          specifier: "./tokens.ts",
          resolved: { id: "/src/tokens.ts", source: "export const space = { lg: '2rem' };" },
        },
      ],
    });
    expect(second.moduleRequests).toEqual([]);
    expect(second.cssDeps).toEqual(["/src/tokens.ts"]);
    expect(second.css).toContain("margin: 2rem");
    expect(second.code).not.toContain("tokens.ts");
    const missing = compile(text, "/src/A.stsx", {
      modules: [{ importer: "/src/A.stsx", specifier: "./tokens.ts" }],
    });
    expect(missing.diagnostics).toMatchObject([{ code: "LUM3008", severity: "error" }]);
  });

  it("reports diagnostics with UTF-16 spans", () => {
    const text = 'const s = "é";\nexport const A = () => <p>{s}</p>;\nA();\n';
    const result = compile(text, "/src/a.tsx");
    expect(result.diagnostics).toMatchObject([
      { code: "LUM2004", severity: "error", docs: "errors/LUM2004" },
    ]);
    const { start, end } = result.diagnostics[0]!.span;
    expect(text.slice(start, end)).toBe("A()");
  });

  it("reports execution contracts with UTF-16 spans, on request", () => {
    const text =
      'import { signal } from "lumen";\n// 🎉\nexport function A() {\n  const n = signal(0);\n' +
      "  return <p title={n()} onClick={() => n.set(1)}>{n()}</p>;\n}\n";
    expect(compile(text, "/src/a.tsx").meta.contract).toBeUndefined();
    const contract = compile(text, "/src/a.tsx", { contract: true }).meta.contract!;
    const rows = contract.map((entry) => [
      text.slice(entry.span.start, entry.span.end),
      entry.kind,
      entry.site,
      entry.via,
      entry.component,
      entry.reads.map((read) => text.slice(read.start, read.end)),
    ]);
    expect(rows).toEqual([
      ["n()", "tracked", "attribute", "setAttr", "A", ["n()"]],
      ["() => n.set(1)", "deferred", "event", "delegateEvents", "A", []],
      ["n()", "tracked", "child", "insert", "A", ["n()"]],
    ]);
  });

  it("reports syntax errors and compiles the server target", () => {
    expect(compile("export const = ;", "/src/x.tsx").diagnostics[0]).toMatchObject({
      code: "LUM1001",
      severity: "error",
    });
    const server = compile(source, "/src/Counter.stsx", { target: "server" });
    expect(server.code).toContain('from "lumen/server"');
    expect(server.meta.runtimeHelpers).toContain("ssr");
  });
});
