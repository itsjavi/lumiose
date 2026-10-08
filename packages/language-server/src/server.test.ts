// Protocol tests (TASK-29): the language server runs as a child process over stdio, in front of
// the real TypeScript 7 native LSP, against a copy of `__fixtures__/workspace`.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  CodeAction,
  ColorInformation,
  CompletionItem,
  CompletionList,
  Diagnostic,
  FoldingRange,
  FullDocumentDiagnosticReport,
  Hover,
  Location,
  MarkupContent,
  Range,
  WorkspaceEdit,
} from "vscode-languageserver/node";
import {
  CLIENT_CAPABILITIES,
  positionOf,
  startTestServer,
  type TestServer,
} from "./test-client.ts";

const BUTTON = "src/components/Button.stsx";
const CARD = "src/components/Card.stsx";
const BROKEN = "src/components/Broken.stsx";

/** The range of `needle`'s `nth` occurrence (plus `shift`) spanning `length` code units. */
function rangeOf(text: string, needle: string, shift = 0, length = needle.length - shift, nth = 1) {
  const start = positionOf(text, needle, shift, nth);
  return { start, end: { line: start.line, character: start.character + length } };
}

function sortRanges<T extends { range: Range }>(items: T[]): T[] {
  return items.toSorted(
    (a, b) =>
      a.range.start.line - b.range.start.line || a.range.start.character - b.range.start.character,
  );
}

describe("language server (pull diagnostics)", () => {
  let server: TestServer;
  let button: string;
  let card: string;
  let broken: string;

  beforeAll(async () => {
    server = await startTestServer("workspace");
    button = await server.open(BUTTON);
    card = await server.open(CARD);
    broken = await server.open(BROKEN);
  });
  afterAll(() => server?.close());

  const doc = (path: string) => ({ textDocument: { uri: server.uri(path) } });

  /** Sorted completion labels in Button.stsx at `needle` plus `shift`. */
  async function complete(needle: string, shift: number): Promise<string[]> {
    const list = await server.request<CompletionList>("textDocument/completion", {
      ...doc(BUTTON),
      position: positionOf(button, needle, shift),
    });
    return list.items.map((item: CompletionItem) => item.label).toSorted();
  }

  it("starts TypeScript 7 behind the proxy and writes shadows for unopened files", async () => {
    const capabilities = server.initialize.capabilities;
    expect(capabilities.diagnosticProvider).toMatchObject({ identifier: "lumen" });
    expect(capabilities.colorProvider).toBe(true);
    expect(capabilities.semanticTokensProvider).toBeDefined(); // passed through from TypeScript
    const shadow = join(server.root, ".lumen/shadow", CARD + ".tsx");
    expect(existsSync(shadow)).toBe(true);
    expect(await readFile(shadow, "utf8")).toHaveLength(card.length);
  });

  it("proxies hover and definition on .stsx symbols with source URIs and exact positions", async () => {
    const at = { ...doc(CARD), position: positionOf(card, "<Button", 1) };
    const hover = await server.request<Hover>("textDocument/hover", at);
    expect((hover.contents as MarkupContent).value).toContain("function Button(props");
    expect(hover.range).toEqual(rangeOf(card, "<Button", 1));

    const definition = await server.request<Location[]>("textDocument/definition", at);
    expect(definition).toEqual([
      { uri: server.uri(BUTTON), range: rangeOf(button, "function Button", 9) },
    ]);
  });

  it("maps definitions from .tsx into unopened .stsx files", async () => {
    const main = await server.open("src/main.tsx");
    const definition = await server.request<Location[]>("textDocument/definition", {
      ...doc("src/main.tsx"),
      position: positionOf(main, "<Card", 1),
    });
    expect(definition).toEqual([
      { uri: server.uri(CARD), range: rangeOf(card, "function Card", 9) },
    ]);
  });

  it("merges TypeScript, Lumen and CSS diagnostics with exact ranges", async () => {
    const report = await server.request<FullDocumentDiagnosticReport>(
      "textDocument/diagnostic",
      doc(BROKEN),
    );
    const summary = sortRanges(report.items).map(({ source, code, range }) => ({
      source,
      code,
      range,
    }));
    expect(summary).toEqual([
      { source: "ts", code: 2322, range: rangeOf(broken, "size") },
      { source: "ts", code: 6133, range: rangeOf(broken, "size") },
      { source: "lumen", code: "LUM1005", range: rangeOf(broken, 'lang="scss"') },
      // A TypeScript error on a `$ref` inside a block is kept, at the reference's name.
      { source: "ts", code: 2304, range: rangeOf(broken, "$missing", 1) },
      {
        source: "css",
        code: "css-propertyvalueexpected",
        range: rangeOf(broken, "color: ;", 7, 1),
      },
    ]);
    expect(report.items.find((d: Diagnostic) => d.code === 2304)?.message).toBe(
      "Cannot find name 'missing'.",
    );
  });

  it("sends unsaved buffers to TypeScript as masked text", async () => {
    const edited = card.replace("const gap = 8;", 'const gap: number = "8";');
    server.change(CARD, edited);
    const report = await server.request<FullDocumentDiagnosticReport>(
      "textDocument/diagnostic",
      doc(CARD),
    );
    expect(report.items.map(({ code, range }) => ({ code, range }))).toEqual([
      { code: 2322, range: rangeOf(edited, "gap: number", 0, 3) },
    ]);
    server.change(CARD, card);
    const clean = await server.request<FullDocumentDiagnosticReport>(
      "textDocument/diagnostic",
      doc(CARD),
    );
    expect(clean.items).toEqual([]);
  });

  it("completes CSS properties inside style blocks", async () => {
    const list = await server.request<CompletionList>("textDocument/completion", {
      ...doc(CARD),
      position: positionOf(card, "display: grid", 3),
    });
    expect(list.items.map((item) => item.label)).toContain("display");
    const hover = await server.request<Hover>("textDocument/hover", {
      ...doc(CARD),
      position: positionOf(card, "display: grid", 2),
    });
    expect(JSON.stringify(hover.contents)).toContain("display");
  });

  it("completes $ref members through TypeScript", async () => {
    const list = await server.request<CompletionList>("textDocument/completion", {
      ...doc(BUTTON),
      position: positionOf(button, "$radius.lg", 8),
    });
    expect(list.items.map((item) => item.label).toSorted()).toEqual(["lg", "sm"]);
  });

  it("completes class names from the styles in scope", async () => {
    // Button's component block, the file block and the global block; not Icon's block.
    expect(await complete('["button"', 2)).toEqual([
      "button",
      "is-primary",
      "shared",
      "theme-dark",
    ]);
    expect(await complete('class="icon"', 7)).toEqual(["icon", "shared", "theme-dark"]);
  });

  it("goes from a class to its selector and back", async () => {
    const definition = await server.request<Location[]>("textDocument/definition", {
      ...doc(CARD),
      position: positionOf(card, 'class="card-title"', 9),
    });
    expect(definition).toEqual([{ uri: server.uri(CARD), range: rangeOf(card, ".card-title", 1) }]);

    const references = await server.request<Location[]>("textDocument/references", {
      ...doc(CARD),
      position: positionOf(card, ".card-title", 3),
      context: { includeDeclaration: true },
    });
    expect(sortRanges(references)).toEqual([
      { uri: server.uri(CARD), range: rangeOf(card, '"card-title"', 1, 10) },
      { uri: server.uri(CARD), range: rangeOf(card, ".card-title", 1) },
    ]);
  });

  it("renames a const used as a $ref at both TypeScript and CSS positions", async () => {
    const edits = [
      rangeOf(card, "const gap", 6, 3),
      rangeOf(card, "{gap}", 1, 3),
      rangeOf(card, "$gap", 1, 3),
    ].map((range) => ({ range, newText: "spacing" }));
    for (const position of [positionOf(card, "const gap", 6), positionOf(card, "$gap", 2)]) {
      const rename = await server.request<WorkspaceEdit>("textDocument/rename", {
        ...doc(CARD),
        position,
        newName: "spacing",
      });
      expect(sortRanges(rename.changes![server.uri(CARD)]!)).toEqual(edits);
    }
  });

  it("renames from a .ts file into $refs of .stsx files", async () => {
    await server.open("src/tokens.ts");
    const rename = await server.request<WorkspaceEdit>("textDocument/rename", {
      ...doc("src/tokens.ts"),
      position: { line: 0, character: 14 },
      newName: "radii",
    });
    expect(sortRanges(rename.changes![server.uri(BUTTON)]!)).toEqual([
      { range: rangeOf(button, "radius }", 0, 6), newText: "radii" },
      { range: rangeOf(button, "$radius", 1), newText: "radii" },
    ]);
  });

  it("renames a class across selectors and class attributes", async () => {
    const rename = await server.request<WorkspaceEdit>("textDocument/rename", {
      ...doc(BUTTON),
      position: positionOf(button, ".is-primary", 2),
      newName: "is-main",
    });
    expect(sortRanges(rename.changes![server.uri(BUTTON)]!)).toEqual([
      { range: rangeOf(button, '"is-primary"', 1, 10), newText: "is-main" },
      { range: rangeOf(button, ".is-primary", 1), newText: "is-main" },
    ]);
  });

  it("hovers $refs with their folded value", async () => {
    const hover = async (needle: string) =>
      server.request<Hover>("textDocument/hover", {
        ...doc(BUTTON),
        position: positionOf(button, needle, 2),
      });
    const lg = await hover("$radius.lg");
    expect((lg.contents as MarkupContent).value).toMatch(/^`\$radius\.lg` → `12px`/);
    expect(lg.range).toEqual(rangeOf(button, "$radius.lg"));
    expect(((await hover("$accent")).contents as MarkupContent).value).toMatch(
      /^`\$accent` → `#7c3aed`/,
    );
  });

  it("provides colors and folding for style blocks", async () => {
    const colors = await server.request<ColorInformation[]>(
      "textDocument/documentColor",
      doc(BUTTON),
    );
    expect(colors.map((color) => color.range)).toContainEqual(rangeOf(button, "#ff0000"));
    const folding = await server.request<FoldingRange[]>("textDocument/foldingRange", doc(CARD));
    const block = positionOf(card, "<style>").line;
    expect(folding).toContainEqual({ startLine: block, endLine: block + 2 });
  });

  it("reports raw CSS in .tsx files", async () => {
    const text = "export const A = () => <div>\n  <style>.a {}</style>\n</div>;\n";
    await server.open("src/Raw.tsx", text);
    const report = await server.request<FullDocumentDiagnosticReport>(
      "textDocument/diagnostic",
      doc("src/Raw.tsx"),
    );
    expect(report.items.find((d) => d.source === "lumen")?.code).toBe("LUM1006");
  });

  it("offers compiler quick fixes", async () => {
    const actions = await server.request<CodeAction[]>("textDocument/codeAction", {
      ...doc(BROKEN),
      range: rangeOf(broken, 'lang="scss"', 2, 0),
      context: { diagnostics: [] },
    });
    expect(actions[0]).toMatchObject({
      title: "Remove `lang`",
      kind: "quickfix",
      edit: {
        changes: {
          [server.uri(BROKEN)]: [{ newText: "", range: rangeOf(broken, ' lang="scss"') }],
        },
      },
    });
  });
});

describe("language server (push diagnostics)", () => {
  let server: TestServer;
  beforeAll(async () => {
    const { diagnostic: _, ...textDocument } = CLIENT_CAPABILITIES.textDocument!;
    server = await startTestServer("workspace", { ...CLIENT_CAPABILITIES, textDocument });
  });
  afterAll(() => server?.close());

  it("publishes merged diagnostics when the client cannot pull", async () => {
    await server.open(BROKEN);
    const uri = server.uri(BROKEN);
    const deadline = Date.now() + 15_000;
    let diagnostics: Diagnostic[] | undefined;
    while (!diagnostics && Date.now() < deadline) {
      diagnostics = server.notifications
        .filter((n) => n.method === "textDocument/publishDiagnostics")
        .map((n) => n.params as { uri: string; diagnostics: Diagnostic[] })
        .findLast((params) => params.uri === uri)?.diagnostics;
      if (!diagnostics) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(diagnostics?.map((d) => d.code).toSorted()).toEqual(
      ["LUM1005", 2304, 2322, 6133, "css-propertyvalueexpected"].toSorted(),
    );
  });
});
