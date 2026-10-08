// Unit tests for the offset-preserving views and the URI mapping used by the proxy.

import { scan } from "@lumen/compiler";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TextDocument } from "vscode-languageserver-textdocument";
import { describe, expect, it } from "vitest";
import { filterBlockDiagnostics } from "./diagnostics.ts";
import { rewriteUris } from "./rewrite.ts";
import { foldedValue } from "./server.ts";
import { virtualCss } from "./stsx.ts";
import { isShadow, pathToUri, Projects, rewriteShadowText, shadowToSource } from "./workspace.ts";

const SOURCE = `const gap = 8;
export function A() {
  return <div>é<style>
    .a { gap: $gap; border: $radius.lg solid; content: "→"; }
  </style></div>;
}
<style>
  .b { padding: calc($gap * 1px); }
</style>
`;

describe("virtualCss", () => {
  it("blanks everything but one block and replaces refs with same-length identifiers", () => {
    const { blocks } = scan(SOURCE, "A.stsx");
    const css = virtualCss(SOURCE, blocks[0]!);
    expect(css).toHaveLength(SOURCE.length);
    expect(css.split("\n").length).toBe(SOURCE.split("\n").length);
    expect(css.trim()).toBe('.a { gap: _gap; border: _radius_lg solid; content: "→"; }');
    expect(css.indexOf("_radius_lg")).toBe(SOURCE.indexOf("$radius.lg"));
    expect(virtualCss(SOURCE, blocks[1]!).trim()).toBe(".b { padding: calc(_gap * 1px); }");
  });
});

describe("filterBlockDiagnostics", () => {
  it("drops TypeScript diagnostics in blocks except on $refs", () => {
    const { blocks } = scan(SOURCE, "A.stsx");
    const document = TextDocument.create("file:///A.stsx", "stsx", 1, SOURCE);
    const at = (offset: number) => ({
      range: { start: document.positionAt(offset), end: document.positionAt(offset + 1) },
    });
    const outside = at(SOURCE.indexOf("gap"));
    const onRef = at(SOURCE.indexOf("$radius") + 1);
    const noise = at(SOURCE.indexOf("$radius") + "$radius.lg".length);
    expect(filterBlockDiagnostics(document, blocks, [outside, onRef, noise])).toEqual([
      outside,
      onRef,
    ]);
  });
});

describe("shadow URIs", () => {
  const shadow = "file:///p/My%20App/.lumen/shadow/src/routes/%5Bslug%5D.stsx.tsx";

  it("maps shadows to sources keeping the URI encoding", () => {
    expect(isShadow(shadow)).toBe(true);
    expect(shadowToSource(shadow)).toBe("file:///p/My%20App/src/routes/%5Bslug%5D.stsx");
    expect(shadowToSource("C:\\p\\.lumen\\shadow\\src\\A.stsx.tsx")).toBe("C:\\p\\src\\A.stsx");
    expect(shadowToSource("file:///p/src/A.tsx")).toBeUndefined();
  });

  it("rewrites embedded shadow paths in text", () => {
    expect(
      rewriteShadowText(
        "See [A](file:///p/.lumen/shadow/src/A.stsx.tsx#L3) and /p/.lumen/shadow/src/B.stsx.tsx",
      ),
    ).toBe("See [A](file:///p/src/A.stsx#L3) and /p/src/B.stsx");
  });

  it("rewrites URI values and keys deeply, leaving `data` untouched", () => {
    const edit = {
      changes: { [shadow]: [{ newText: "x" }] },
      location: { uri: shadow },
      data: { uri: shadow },
      contents: { kind: "markdown", value: `[x](${shadow})` },
    };
    const source = "file:///p/My%20App/src/routes/%5Bslug%5D.stsx";
    expect(rewriteUris(edit, shadowToSource, rewriteShadowText)).toEqual({
      changes: { [source]: [{ newText: "x" }] },
      location: { uri: source },
      data: { uri: shadow },
      contents: { kind: "markdown", value: `[x](${source})` },
    });
  });
});

describe("shadow URIs below a wider mirror base (TASK-73)", () => {
  it("maps sources and shadows through the project's rootDirs pair", async () => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), "lumen-ls-layout-")));
    try {
      const root = join(dir, "apps/web");
      await mkdir(join(root, "src"), { recursive: true });
      await writeFile(
        join(root, "tsconfig.json"),
        '{ "compilerOptions": { "rootDirs": ["../..", ".lumen/shadow"] } }',
      );
      const projects = new Projects([root]);
      const source = pathToUri(join(root, "src/A.stsx"));
      const shadow = pathToUri(join(root, ".lumen/shadow/apps/web/src/A.stsx.tsx"));
      const packageShadow = join(root, ".lumen/shadow/packages/ui/src/B.stsx.tsx");
      expect(projects.shadowUri(source)).toBe(shadow);
      expect(projects.shadowToSource(shadow)).toBe(source);
      expect(projects.shadowToSource(packageShadow)).toBe(join(dir, "packages/ui/src/B.stsx"));
      expect(projects.rewriteShadowText(`See ${shadow}#L2 and ${packageShadow}.`)).toBe(
        `See ${source}#L2 and ${join(dir, "packages/ui/src/B.stsx")}.`,
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("foldedValue", () => {
  it("reads literal types from TypeScript hovers", () => {
    expect(foldedValue('```typescript\n(property) lg: "12px"\n```')).toBe("12px");
    expect(foldedValue("```typescript\nconst gap: 8\n```")).toBe("8");
    expect(foldedValue('```typescript\n(alias) const accent: "#7c3aed"\nimport accent\n```')).toBe(
      "#7c3aed",
    );
    expect(foldedValue('```typescript\nconst radius: {\n    readonly lg: "12px";\n}\n```')).toBe(
      undefined,
    );
    expect(foldedValue("```typescript\nlet size: number\n```")).toBe(undefined);
  });
});
