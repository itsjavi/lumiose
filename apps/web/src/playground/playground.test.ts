// Unit tests of the playground's pieces that run outside the browser: shareable state, the
// editor's style-block masking, the preview's module rewriting and the samples (compiled with the
// native binding, which the wasm build mirrors option for option).
import * as native from "@lumiose/compiler";
import { describe, expect, it } from "vitest";
import { compileBoth, FILENAME, position, type WasmCompiler } from "./compiler.ts";
import { previewProgram, rewriteImports } from "./preview.ts";
import { samples } from "./samples.ts";
import { decodeState, encodeState } from "./share.ts";
import { mask, styleRanges } from "./stsx-language.ts";

const compiler = native as unknown as WasmCompiler;

describe("shareable state", () => {
  it("round-trips through the hash, unicode included", async () => {
    const state = { code: 'const s = "é → 🎉";\n'.repeat(200), tab: "css" };
    const hash = await encodeState(state);
    expect(hash).toMatch(/^#v1=[\w-]+$/);
    expect(hash.length).toBeLessThan(state.code.length / 4);
    expect(await decodeState(hash)).toEqual(state);
  });

  it("ignores other and damaged hashes", async () => {
    expect(await decodeState("")).toBeUndefined();
    expect(await decodeState("#top")).toBeUndefined();
    expect(await decodeState("#v1=not-deflate")).toBeUndefined();
  });
});

describe("style blocks in the editor", () => {
  const source =
    "const a = 1;\n<style global>\n.a { b: c }\n</style>\n<p><style>.p {}</style></p>\n";

  it("finds the content of closed blocks", () => {
    const ranges = styleRanges(source);
    expect(ranges.map(({ from, to }) => source.slice(from, to))).toEqual([
      "\n.a { b: c }\n",
      ".p {}",
    ]);
    expect(styleRanges("<style>.open {")).toEqual([]);
  });

  it("masks them offset-identically, keeping newlines", () => {
    const masked = mask(source, 0, styleRanges(source));
    expect(masked).toHaveLength(source.length);
    expect(masked).toBe(
      "const a = 1;\n<style global>\n           \n</style>\n<p><style>     </style></p>\n",
    );
    // A chunk that starts inside a block.
    expect(mask(source.slice(30), 30, styleRanges(source))).toBe(masked.slice(30));
  });
});

const program = (code: string) =>
  previewProgram(compiler.compile(code, FILENAME, { sourceMap: false, root: "/" }));

describe("preview", () => {
  it("rewrites lumiose imports and rejects others", () => {
    const modules = { lumiose: "blob:a", "lumiose/dom": "blob:b" };
    expect(
      rewriteImports(
        'import { signal } from "lumiose";\nimport { template } from "lumiose/dom";\n',
        modules,
      ),
    ).toBe('import { signal } from "blob:a";\nimport { template } from "blob:b";\n');
    expect(() => rewriteImports('import x from "./Other.stsx";', modules)).toThrow(
      'Cannot import "./Other.stsx" in the playground',
    );
  });

  it("mounts the default export, else App or the first exported component", () => {
    expect(program("export default function A() { return <p />; }").mount).toBe("default");
    expect(
      program("export function B() { return <p />; }\nexport function App() { return <p />; }")
        .mount,
    ).toBe("App");
    expect(program("export function B() { return <p />; }").mount).toBe("B");
    expect(program("const x = 1;").mount).toBeNull();
  });

  it("drops the style import: the frame gets the CSS itself", () => {
    const { code, css } = previewProgram(
      compiler.compile(
        'export default () => <p class="a"><style>.a { color: red }</style></p>;',
        FILENAME,
        {
          sourceMap: false,
          root: "/",
        },
      ),
    );
    expect(code).not.toContain("type=style");
    expect(css).toMatch(/\.a\[data-l-\w+\]/);
  });
});

describe("compileBoth", () => {
  it("compiles for the client and the server and merges their diagnostics", () => {
    const source =
      'export default function A() {\n  return <p class="a"><style lang="scss">.a {}</style></p>;\n}\n';
    const result = compileBoth(compiler, source);
    expect(result.client.code).toContain("lumiose/dom");
    expect(result.server.code).toContain("lumiose/server");
    expect(result.errors).toBe(1);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "LUM1005", severity: "error", line: 2, column: 30 }),
    ]);
  });

  it("compiles every sample without diagnostics", () => {
    for (const sample of samples) {
      const result = compileBoth(compiler, sample.code);
      expect(result.diagnostics, sample.id).toEqual([]);
      expect(previewProgram(result.client).mount, sample.id).toBe("default");
    }
  });

  it("counts lines and UTF-16 columns", () => {
    expect(position("ab\ncd", 4)).toEqual({ line: 2, column: 2 });
    expect(position("é🎉x", 3)).toEqual({ line: 1, column: 4 });
  });
});
