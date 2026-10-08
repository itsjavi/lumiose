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
  DocumentSymbol,
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

/** Symbol names as a tree: `{ parent: [children] }` or a leaf's name. */
function outline(list: DocumentSymbol[] | undefined): unknown[] {
  return (list ?? []).map((symbol) =>
    symbol.children?.length ? { [symbol.name]: outline(symbol.children) } : symbol.name,
  );
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
      // The compiler's LUM3008 on `$missing` is superseded by TypeScript's 2304.
      { source: "lumen", code: "LUM3005", range: rangeOf(broken, ".oops") },
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
    // Button's component block, the file block and the global block; not Icon's block. Plus the
    // `<style global>` classes of other files (the unopened `_layout.stsx`).
    expect(await complete('["button"', 2)).toEqual([
      "app-shell",
      "button",
      "is-primary",
      "shared",
      "theme-dark",
      "visually-hidden",
    ]);
    expect(await complete('class="icon"', 7)).toEqual([
      "app-shell",
      "icon",
      "shared",
      "theme-dark",
      "visually-hidden",
    ]);
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

  it("reports compiler diagnostics for .stsx and .tsx documents", async () => {
    const stsx = [
      "function Inner() { return <i />; }",
      "let width = 2;",
      "export function Calls() {",
      '  return <div class="calls">{Inner()}<style>.calls { width: $width; }</style></div>;',
      "}",
      "",
    ].join("\n");
    await server.open("src/Calls.stsx", stsx);
    const lumen = async (path: string) => {
      const report = await server.request<FullDocumentDiagnosticReport>(
        "textDocument/diagnostic",
        doc(path),
      );
      return sortRanges(report.items.filter((d) => d.source === "lumen")).map(
        ({ code, severity, range }) => ({ code, severity, range }),
      );
    };
    expect(await lumen("src/Calls.stsx")).toEqual([
      { code: "LUM2004", severity: 1, range: rangeOf(stsx, "{Inner()", 1) },
      { code: "LUM3008", severity: 1, range: rangeOf(stsx, "$width") },
    ]);

    // An edit is compiled again (once per version).
    const fixed = stsx.replace("{Inner()}", "<Inner />");
    server.change("src/Calls.stsx", fixed);
    expect((await lumen("src/Calls.stsx")).map((d) => d.code)).toEqual(["LUM3008"]);

    const tsx =
      "function Inner() {\n  return <i />;\n}\nexport const A = () => <p>{Inner()}</p>;\n";
    await server.open("src/Calls.tsx", tsx);
    expect(await lumen("src/Calls.tsx")).toEqual([
      { code: "LUM2004", severity: 1, range: rangeOf(tsx, "{Inner()", 1) },
    ]);
  });

  it("offers and defines <style global> classes of other files", async () => {
    const layout = "src/routes/_layout.stsx";
    const layoutText = await readFile(join(server.root, layout), "utf8");
    const at = (text: string, needle: string, shift: number) => ({
      ...doc(CARD),
      position: positionOf(text, needle, shift),
    });
    const list = await server.request<CompletionList>(
      "textDocument/completion",
      at(card, 'class="card-title"', 7),
    );
    const details = Object.fromEntries(list.items.map((item) => [item.label, item.detail]));
    expect(details).toMatchObject({
      "card-title": expect.stringMatching(/^file style/),
      "app-shell": `global style, ${layout}:${positionOf(layoutText, ".app-shell").line + 1}`,
      "theme-dark": `global style, ${BUTTON}:${positionOf(button, ".theme-dark").line + 1}`,
    });

    // An unsaved edit to an open file's global block is visible in other files.
    server.change(BUTTON, button.replace(".theme-dark", ".theme-night"));
    const edited = await server.request<CompletionList>(
      "textDocument/completion",
      at(card, 'class="card-title"', 7),
    );
    const labels = edited.items.map((item) => item.label);
    expect(labels).toContain("theme-night");
    expect(labels).not.toContain("theme-dark");
    server.change(BUTTON, button);

    const using = card.replace('class="card"', 'class="card visually-hidden"');
    server.change(CARD, using);
    const definition = await server.request<Location[]>(
      "textDocument/definition",
      at(using, "visually-hidden", 3),
    );
    expect(definition).toEqual([
      { uri: server.uri(layout), range: rangeOf(layoutText, ".visually-hidden", 1) },
    ]);
    server.change(CARD, card);
  });

  it("merges style block symbols into TypeScript's document symbols", async () => {
    const symbols = await server.request<DocumentSymbol[]>(
      "textDocument/documentSymbol",
      doc(BUTTON),
    );
    expect(outline(symbols)).toEqual([
      "accent",
      "radius",
      { Button: ['"is-primary"', { "<style>": [".button", ".is-primary"] }] },
      { Icon: [{ "<style>": [".icon"] }] },
      { "<style>": [".shared"] },
      { "<style global>": [".theme-dark"] },
    ]);
    const global = symbols.find((symbol) => symbol.name === "<style global>")!;
    expect(global.selectionRange).toEqual(rangeOf(button, "<style global>"));
    expect(global.detail).toBe("global");
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
      ["LUM1005", "LUM3005", 2304, 2322, 6133, "css-propertyvalueexpected"].toSorted(),
    );
  });
});

describe("language server (TypeScript crash recovery)", () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await startTestServer("workspace");
  });
  afterAll(() => server?.close());

  const logs = () =>
    server.notifications
      .filter((n) => n.method === "window/logMessage")
      .map((n) => (n.params as { message: string }).message);

  async function waitForLog(pattern: RegExp, after = 0): Promise<string> {
    const deadline = Date.now() + 20_000;
    for (;;) {
      const found = logs()
        .slice(after)
        .find((message) => pattern.test(message));
      if (found !== undefined) return found;
      if (Date.now() > deadline)
        throw new Error(`no log matching ${pattern}:\n${logs().join("\n")}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  it("restarts TypeScript and re-sends unsaved documents", async () => {
    const card = await server.open(CARD);
    const edited = card.replace("const gap = 8;", 'const gap: number = "8";');
    server.change(CARD, edited);
    const doc = { textDocument: { uri: server.uri(CARD) } };
    const typeErrors = async () =>
      (await server.request<FullDocumentDiagnosticReport>("textDocument/diagnostic", doc)).items
        .filter((d) => d.source === "ts")
        .map(({ code, range }) => ({ code, range }));
    const expected = [{ code: 2322, range: rangeOf(edited, "gap: number", 0, 3) }];
    expect(await typeErrors()).toEqual(expected);

    const started = await waitForLog(/language server \(.*pid (\d+)\)/);
    const pid = Number(/pid (\d+)/.exec(started)![1]);
    const before = logs().length;
    process.kill(pid, "SIGKILL");

    await waitForLog(/restarting TypeScript in \d+ ms \(attempt 1 of \d+\)/, before);
    const restarted = await waitForLog(
      /TypeScript language server restarted \(pid (\d+)\)/,
      before,
    );
    expect(Number(/pid (\d+)/.exec(restarted)![1])).not.toBe(pid);
    expect(restarted).toContain("1 open document(s) re-sent");

    // TypeScript sees the unsaved buffer again, and serves requests.
    expect(await typeErrors()).toEqual(expected);
    const hover = await server.request<Hover>("textDocument/hover", {
      ...doc,
      position: positionOf(edited, "<Button", 1),
    });
    expect((hover.contents as MarkupContent).value).toContain("function Button(props");
  });
});
