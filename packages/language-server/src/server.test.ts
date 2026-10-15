// Protocol tests (TASK-29): the language server runs as a child process over stdio, in front of
// the real TypeScript 7 native LSP, against a copy of `__fixtures__/workspace`.

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CompletionItemKind } from "vscode-languageserver/node";
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

/** Labels in ranking order (sortText, then label), as an editor lists them. */
function ranked(list: CompletionList | null): string[] {
  return (list?.items ?? [])
    .toSorted(
      (a, b) =>
        (a.sortText ?? a.label).localeCompare(b.sortText ?? b.label) ||
        a.label.localeCompare(b.label),
    )
    .map((item) => item.label);
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

  /** The completion list in `path` (with content `text`) at `needle` plus `shift`. */
  async function completion(path: string, text: string, needle: string, shift: number) {
    return server.request<CompletionList | null>("textDocument/completion", {
      ...doc(path),
      position: positionOf(text, needle, shift),
    });
  }

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
    expect(capabilities.diagnosticProvider).toMatchObject({ identifier: "lumiose" });
    expect(capabilities.colorProvider).toBe(true);
    expect(capabilities.semanticTokensProvider).toBeDefined(); // passed through from TypeScript
    const shadow = join(server.root, ".lumiose/shadow", CARD + ".tsx");
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

  it("merges TypeScript, Lumiose and CSS diagnostics with exact ranges", async () => {
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
      { source: "lumiose", code: "LUM1005", range: rangeOf(broken, 'lang="scss"') },
      // A TypeScript error on a `$ref` inside a block is kept, at the reference's name.
      { source: "ts", code: 2304, range: rangeOf(broken, "$missing", 1) },
      // The compiler's LUM3008 on `$missing` is superseded by TypeScript's 2304.
      { source: "lumiose", code: "LUM3005", range: rangeOf(broken, ".oops") },
      // LUM3017 (TASK-120) reports the empty value; the CSS service's duplicate is dropped (TASK-132).
      { source: "lumiose", code: "LUM3017", range: rangeOf(broken, "color: ;", 0, 5) },
    ]);
    expect(report.items.find((d: Diagnostic) => d.code === 2304)?.message).toBe(
      "Cannot find name 'missing'.",
    );
  });

  it("drops CSS service problems that Lumiose's CSS diagnostics report (TASK-132)", async () => {
    const text = [
      "export function Dupes() {",
      "  return (",
      '    <div class="dupes">',
      "      <style>",
      "        .dupes { colr: red; }",
      "        .open { color: blue;",
      "      </style>",
      "    </div>",
      "  );",
      "}",
      "",
    ].join("\n");
    await server.open("src/components/Dupes.stsx", text);
    const report = await server.request<FullDocumentDiagnosticReport>(
      "textDocument/diagnostic",
      doc("src/components/Dupes.stsx"),
    );
    const codes = report.items.map((d) => String(d.code));
    expect(codes).toEqual(expect.arrayContaining(["LUM3020", "LUM3014"]));
    expect(codes).not.toContain("unknownProperties");
    expect(codes).not.toContain("css-rcurlyexpected");
  });

  it("types CSS module imports as read-only class maps in .stsx files (TASK-334)", async () => {
    const path = "src/components/Tile.stsx";
    const text = [
      'import styles from "./tile.module.css";',
      "export function Tile(props: { open: boolean; class?: string }) {",
      "  return <div class={[styles.tile, props.open && styles.open, props.class]} />;",
      "}",
      "<style>",
      "  div { display: grid; }",
      "</style>",
      "",
    ].join("\n");
    await server.open(path, text);
    const report = await server.request<FullDocumentDiagnosticReport>(
      "textDocument/diagnostic",
      doc(path),
    );
    expect(report.items).toEqual([]);
    const hover = await server.request<Hover>("textDocument/hover", {
      ...doc(path),
      position: positionOf(text, "styles.tile", 1),
    });
    expect((hover.contents as MarkupContent).value).toContain(
      "readonly [className: string]: string",
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
    // `<style global>` classes of other files (the unopened `layout.stsx`) and imported `.css`.
    expect(await complete('["button"', 2)).toEqual([
      "app-button",
      "app-shell",
      "button",
      "is-primary",
      "shared",
      "theme-dark",
      "visually-hidden",
    ]);
    expect(await complete('class="icon"', 7)).toEqual([
      "app-button",
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
    expect(report.items.find((d) => d.source === "lumiose")?.code).toBe("LUM1006");
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
    const lumiose = async (path: string) => {
      const report = await server.request<FullDocumentDiagnosticReport>(
        "textDocument/diagnostic",
        doc(path),
      );
      return sortRanges(report.items.filter((d) => d.source === "lumiose")).map(
        ({ code, severity, range }) => ({ code, severity, range }),
      );
    };
    expect(await lumiose("src/Calls.stsx")).toEqual([
      { code: "LUM2004", severity: 1, range: rangeOf(stsx, "{Inner()", 1) },
      { code: "LUM3008", severity: 1, range: rangeOf(stsx, "$width") },
    ]);

    // An edit is compiled again (once per version).
    const fixed = stsx.replace("{Inner()}", "<Inner />");
    server.change("src/Calls.stsx", fixed);
    expect((await lumiose("src/Calls.stsx")).map((d) => d.code)).toEqual(["LUM3008"]);

    const tsx =
      "function Inner() {\n  return <i />;\n}\nexport const A = () => <p>{Inner()}</p>;\n";
    await server.open("src/Calls.tsx", tsx);
    expect(await lumiose("src/Calls.tsx")).toEqual([
      { code: "LUM2004", severity: 1, range: rangeOf(tsx, "{Inner()", 1) },
    ]);

    // Raw CSS in a `.tsx` file: LUM1006 only, without TypeScript's errors on the CSS (TASK-122).
    const raw =
      'export const Raw = () => <div class="raw"><style>.raw { color: red; }</style></div>;\n';
    await server.open("src/Raw.tsx", raw);
    const report = await server.request<FullDocumentDiagnosticReport>(
      "textDocument/diagnostic",
      doc("src/Raw.tsx"),
    );
    expect(report.items.map(({ source, code }) => ({ source, code }))).toEqual([
      { source: "lumiose", code: "LUM1006" },
    ]);
  });

  it("reports non-serializable island props as LUM4002 on the prop (.stsx and .tsx)", async () => {
    const islands = [
      "export function Counter(props: { start?: number; onDone?: () => void }) {",
      "  return <p>{props.start}</p>;",
      "}",
      "export const A = () => <Counter client:load start={1} onDone={() => {}} />;",
      "",
    ].join("\n");
    for (const path of ["src/Islands.stsx", "src/Islands.tsx"]) {
      await server.open(path, islands);
      const report = await server.request<FullDocumentDiagnosticReport>(
        "textDocument/diagnostic",
        doc(path),
      );
      expect(report.items.map(({ source, code, range }) => ({ source, code, range }))).toEqual([
        { source: "lumiose", code: "LUM4002", range: rangeOf(islands, "onDone={() =>", 0, 6) },
      ]);
      expect(report.items[0]!.message).toMatch(/^Island prop `onDone` is not serializable/);
    }
  });

  it("reports project-wide LUM4003 and LUM3012, following buffer edits (TASK-137)", async () => {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(join(server.root, "src/server"), { recursive: true });
    await writeFile(
      join(server.root, "src/server/db.server.ts"),
      "export const likes = () => 1;\n",
    );
    const likes = [
      'import { likes } from "../server/db.server.ts";',
      "export function Likes() {",
      "  return <button>{likes()}</button>;",
      "}",
      "",
    ].join("\n");
    const page = [
      'import { Likes } from "./Likes.stsx";',
      "export function Page() {",
      '  return <main class="page" style={{ "--fil": 1 }}><Likes client:load /></main>;',
      "}",
      "",
    ].join("\n");
    await writeFile(join(server.root, "src/components/Likes.stsx"), likes);
    await writeFile(join(server.root, "src/components/Page.stsx"), page);
    await server.open("src/components/Likes.stsx", likes);
    await server.open("src/components/Page.stsx", page);
    const codes = async (path: string) => {
      const report = await server.request<FullDocumentDiagnosticReport>(
        "textDocument/diagnostic",
        doc(path),
      );
      return report.items
        .filter((d) => d.code === "LUM4003" || d.code === "LUM3012")
        .map(({ code, range }) => ({ code, range }));
    };
    // The island imports a server-only module, reported at the specifier.
    expect(await codes("src/components/Likes.stsx")).toEqual([
      { code: "LUM4003", range: rangeOf(likes, "../server/db.server.ts") },
    ]);
    expect(await codes("src/components/Page.stsx")).toEqual([
      { code: "LUM3012", range: rangeOf(page, '"--fil"', 1, 5) },
    ]);

    // Edits of open buffers count: the island stops importing it, a block reads the property.
    const fixed = likes.replace(
      'import { likes } from "../server/db.server.ts";',
      "const likes = () => 1;",
    );
    server.change("src/components/Likes.stsx", fixed);
    expect(await codes("src/components/Likes.stsx")).toEqual([]);
    const read = page.replace("</main>", "<style>.page { width: var(--fil); }</style></main>");
    server.change("src/components/Page.stsx", read);
    expect(await codes("src/components/Page.stsx")).toEqual([]);
  });

  it("shows the execution contract of JSX expressions in hovers (TASK-137)", async () => {
    const text = [
      'import { signal } from "lumiose";',
      "export function Count() {",
      "  const n = signal(0);",
      '  return <p title={"fixed"} onClick={() => n.set(n() + 1)}>{n()}</p>;',
      "}",
      "",
    ].join("\n");
    await server.open("src/components/Count.stsx", text);
    const hover = async (needle: string, shift = 0) => {
      const result = await server.request<Hover | null>("textDocument/hover", {
        ...doc("src/components/Count.stsx"),
        position: positionOf(text, needle, shift),
      });
      return (result?.contents as MarkupContent | undefined)?.value ?? "";
    };
    const child = await hover("{n()}", 1);
    expect(child).toContain("**Lumiose**: a child in `Count`");
    expect(child).toContain("**tracked**");
    expect(child).toContain("Reactive reads: `n()`");
    expect(await hover('"fixed"', 1)).toContain("**once**");
    expect(await hover("() => n.set", 0)).toContain("**deferred**");
    // Outside any expression: no contract.
    expect(await hover("signal(0)", 0)).not.toContain("**Lumiose**");
  });

  it("supplies imported constants to the compiler, from buffers and disk, re-checking dependents", async () => {
    // A chained re-export on disk (`tokens.ts` is open in an earlier test: its buffer would win).
    const palette =
      'export const radius = { lg: "12px" } as const;\nexport const accent = "#000";\n';
    await writeFile(join(server.root, "src/palette.ts"), palette);
    await writeFile(
      join(server.root, "src/theme.ts"),
      'export * from "./palette.ts";\nexport let mutable = "1px";\n',
    );
    const path = "src/components/Tokens.stsx";
    const tokens = [
      'import { acent, mutable, radius } from "../theme.ts";',
      "",
      "export function Tokens() {",
      "  return (",
      '    <div class="tokens">',
      "      <style>",
      "        .tokens { border-radius: $radius.lg; margin: $mutable; color: $acent; }",
      "        .oops { color: red; }",
      "      </style>",
      "    </div>",
      "  );",
      "}",
      "",
    ].join("\n");
    await server.open(path, tokens);
    const lumiose = async () => {
      const report = await server.request<FullDocumentDiagnosticReport>(
        "textDocument/diagnostic",
        doc(path),
      );
      return sortRanges(report.items.filter((d) => d.source === "lumiose")).map(
        ({ code, range, message }) => ({ code, range, message }),
      );
    };
    expect(await lumiose()).toEqual([
      {
        code: "LUM3008",
        range: rangeOf(tokens, "$mutable"),
        message: expect.stringContaining("`mutable` is a `let` binding"),
      },
      {
        code: "LUM3008",
        range: rangeOf(tokens, "$acent"),
        message: expect.stringContaining("has no export `acent`"),
      },
      { code: "LUM3005", range: rangeOf(tokens, ".oops"), message: expect.any(String) },
    ]);

    // An unsaved edit of the imported module re-checks the (unchanged) document.
    await server.open("src/theme.ts");
    server.change("src/theme.ts", 'export * from "./palette.ts";\nexport const mutable = "1px";\n');
    expect((await lumiose()).map((d) => d.range)).toEqual([
      rangeOf(tokens, "$acent"),
      rangeOf(tokens, ".oops"),
    ]);

    // A change on disk two re-exports away, announced by the client's file watcher.
    await writeFile(
      join(server.root, "src/palette.ts"),
      `${palette}export const acent = "#fff";\n`,
    );
    await server.connection.sendNotification("workspace/didChangeWatchedFiles", {
      changes: [{ uri: server.uri("src/palette.ts"), type: 2 }],
    });
    expect((await lumiose()).map((d) => d.code)).toEqual(["LUM3005"]);
  });

  it("offers and defines <style global> classes of other files", async () => {
    const layout = "src/routes/layout.stsx";
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

  describe("project styles and Lumiose syntax (TASK-80)", () => {
    const NESTED = "src/components/Nested.stsx";
    let nested: string;
    beforeAll(async () => {
      nested = await server.open(NESTED);
    });

    it("scopes class completion to the enclosing subtrees (decision-23), then globals", async () => {
      const globals = ["app-button", "app-shell", "theme-dark", "visually-hidden"];
      // C1 is in B1's subtree: B2's and C2's blocks do not apply there.
      expect(ranked(await completion(NESTED, nested, 'class="c1"', 7))).toEqual([
        "a-root",
        ...globals,
      ]);
      // C2: its own block first, then B2's, then the root's, then the project's globals.
      expect(ranked(await completion(NESTED, nested, 'class="c2"', 7))).toEqual([
        "c2-only",
        "b2-only",
        "a-root",
        ...globals,
      ]);
      const b2 = await completion(NESTED, nested, 'class="b2"', 7);
      expect(ranked(b2)).toEqual(["b2-only", "a-root", ...globals]);
      const details = Object.fromEntries(b2!.items.map((item) => [item.label, item.detail]));
      expect(details).toMatchObject({
        "b2-only": `<section> style, line ${positionOf(nested, ".b2-only").line + 1}`,
        "app-button": "global CSS, src/styles/app.css:3",
      });
    });

    it("defines and renames classes within their subtree", async () => {
      const using = nested.replace('class="c1"', 'class="c1 a-root"');
      server.change(NESTED, using);
      const definition = await server.request<Location[]>("textDocument/definition", {
        ...doc(NESTED),
        position: positionOf(using, "a-root", 2),
      });
      expect(definition).toEqual([
        { uri: server.uri(NESTED), range: rangeOf(using, ".a-root", 1) },
      ]);
      const css = await server.request<Location[]>("textDocument/definition", {
        ...doc(CARD),
        position: positionOf(card, 'class="card"', 7),
      });
      expect(css).toEqual([{ uri: server.uri(CARD), range: rangeOf(card, ".card ", 1, 4) }]);
      server.change(NESTED, nested);

      const appButton = card.replace('class="card"', 'class="card app-button"');
      server.change(CARD, appButton);
      const global = await server.request<Location[]>("textDocument/definition", {
        ...doc(CARD),
        position: positionOf(appButton, "app-button", 2),
      });
      const appCss = await readFile(join(server.root, "src/styles/app.css"), "utf8");
      expect(global).toEqual([
        { uri: server.uri("src/styles/app.css"), range: rangeOf(appCss, ".app-button", 1) },
      ]);
      server.change(CARD, card);
    });

    it("completes custom properties of the whole project with their values", async () => {
      const list = await completion(NESTED, nested, "var(--gap)", 4);
      expect(ranked(list).filter((label) => label.startsWith("--"))).toEqual([
        "--gap",
        "--brand",
        "--radius",
        "--space",
      ]);
      const items = Object.fromEntries(list!.items.map((item) => [item.label, item]));
      expect(items["--gap"]!.detail).toBe("4px");
      expect(items["--brand"]!.detail).toBe("#ff6600");
      expect((items["--brand"]!.documentation as MarkupContent).value).toBe(
        "- `:root` `#ff6600` (css, src/styles/tokens.css:2)",
      );
      expect(items["--radius"]!.detail).toBe("6px");
      expect(items["--gap"]!.textEdit).toEqual({
        range: rangeOf(nested, "--gap)", 0, 5),
        newText: "--gap",
      });

      // A declaration name: the property with its colon.
      const declaring = nested.replace(".c2-only { color: red; }", ".c2-only { --b }");
      server.change(NESTED, declaring);
      const declaration = await completion(NESTED, declaring, "--b }", 3);
      const brand = declaration!.items.find((item) => item.label === "--brand")!;
      expect(brand.textEdit).toEqual({
        range: rangeOf(declaring, "--b }", 0, 3),
        newText: "--brand: $0;",
      });
      server.change(NESTED, nested);
    });

    it("offers only `global` inside a <style> open tag, and no snippets", async () => {
      const open = nested.replace(
        "<style>\n            .c2-only",
        "<style >\n            .c2-only",
      );
      server.change(NESTED, open);
      const list = await completion(NESTED, open, "<style >", 7);
      expect(list!.items.map((item) => item.label)).toEqual(["global"]);
      expect((list!.items[0]!.documentation as MarkupContent).value).toContain(
        "**`<style global>`**",
      );
      const global = open.replace("<style >", "<style global >");
      server.change(NESTED, global);
      expect((await completion(NESTED, global, "<style global >", 14))!.items).toEqual([]);
      server.change(NESTED, nested);
    });

    it("offers snippets at a top-level statement and in JSX children only", async () => {
      const typed = `${nested}\nco\n`.replace('<p class="c1" />', '<p class="c1">isl</p>');
      server.change(NESTED, typed);
      const snippets = async (needle: string, shift: number) =>
        ((await completion(NESTED, typed, needle, shift))?.items ?? [])
          .filter(
            (item) =>
              item.kind === CompletionItemKind.Snippet &&
              (item.data as { lumiose?: string } | undefined)?.lumiose === "snippet",
          )
          .map((item) => item.label);
      expect(await snippets("\nco\n", 3)).toEqual(["comp", "acomp", "route"]);
      expect(await snippets(">isl<", 4)).toEqual(["island"]);
      expect(await snippets("return (", 6)).toEqual([]); // inside a function body
      expect(await snippets('<section class="b1"', 9)).toEqual([]); // a JSX tag
      const comp = (await completion(NESTED, typed, "\nco\n", 3))!.items.find(
        (item) => item.label === "comp",
      )!;
      expect(comp.textEdit).toMatchObject({
        newText: expect.stringMatching(/^export function \$\{1:Nested\}/),
      });
      server.change(NESTED, nested);
    });

    it("describes Lumiose attributes and <style> tags in hovers and completion", async () => {
      const text = `import { signal } from "lumiose";
import { Card } from "./Card.stsx";

const draft = signal("");

export function Attributes() {
  return (
    <div on:click={() => {}} key={1}>
      <input bind:value={draft} />
      <Card title="x" client:visible />
      <style global>
        .x { color: red; }
      </style>
    </div>
  );
}
`;
      const path = "src/components/Attributes.stsx";
      await server.open(path, text);
      const hover = async (needle: string, shift: number) => {
        const result = await server.request<Hover | null>("textDocument/hover", {
          ...doc(path),
          position: positionOf(text, needle, shift),
        });
        return (result?.contents as MarkupContent | undefined)?.value ?? "";
      };
      expect(await hover("on:click", 4)).toContain("native `addEventListener` listener");
      expect(await hover("key={1}", 1)).toContain("the identity of a row");
      expect(await hover("bind:value", 6)).toContain("two-way binding");
      expect(await hover("client:visible", 8)).toContain("when it enters the");
      expect(await hover("<style global>", 3)).toContain("**`<style>`**");
      expect(await hover("<style global>", 9)).toContain("**`<style global>`**");

      const list = await completion(path, text, "<input ", 7);
      const item = list!.items.find((candidate) => candidate.label.startsWith("on:click"))!;
      const resolved = await server.request<CompletionItem>("completionItem/resolve", item);
      expect((resolved.documentation as MarkupContent).value).toContain("`on:event={handler}`");
    });
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
      ["LUM1005", "LUM3005", "LUM3017", 2304, 2322, 6133].toSorted(),
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
