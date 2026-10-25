// stsx mode (TASK-582, decision-86): a project with @lumiose/stsx and without Lumiose gets
// TypeScript through `.lumiose/stsx` shadows, style diagnostics that read `className`, class
// completion in `className`, and none of Lumiose's runtime checks or execution-contract hovers.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  CompletionList,
  FullDocumentDiagnosticReport,
  Hover,
  MarkupContent,
} from "vscode-languageserver/node";
import { positionOf, startTestServer, type TestServer } from "./test-client.ts";

const CARD = "src/Card.stsx";

describe("language server (stsx mode)", () => {
  let server: TestServer;
  let card: string;

  beforeAll(async () => {
    server = await startTestServer("stsx-workspace");
    card = await server.open(CARD);
  });
  afterAll(() => server?.close());

  const doc = { textDocument: { uri: "" } };
  const at = (needle: string, shift = 0) => ({
    textDocument: { uri: server.uri(CARD) },
    position: positionOf(card, needle, shift),
  });

  it("writes shadows in .lumiose/stsx, and no Lumiose files", async () => {
    const shadow = join(server.root, ".lumiose/stsx", CARD + ".tsx");
    await expect.poll(() => existsSync(shadow)).toBe(true);
    expect(await readFile(shadow, "utf8")).toHaveLength(card.length);
    expect(existsSync(join(server.root, ".lumiose/shadow"))).toBe(false);
    expect(existsSync(join(server.root, ".lumiose/tsconfig.generated.json"))).toBe(false);
  });

  it("reports TypeScript and style diagnostics only", async () => {
    doc.textDocument.uri = server.uri(CARD);
    const report = await server.request<FullDocumentDiagnosticReport>(
      "textDocument/diagnostic",
      doc,
    );
    const codes = report.items.map((d) => `${d.source}:${d.code}`).toSorted();
    // `const label: string = count` (TS2322) and `.unused` (LUM3005, read from `className`).
    expect(codes).toEqual(["lumiose:LUM3005", "ts:2322"]);
    expect(report.items.find((d) => d.code === "LUM3005")!.message).toContain("`.unused`");
  });

  it("completes block classes in className", async () => {
    const list = await server.request<CompletionList | null>(
      "textDocument/completion",
      at('<h2 className="', '<h2 className="'.length),
    );
    expect(list!.items.map((item) => item.label)).toEqual(
      expect.arrayContaining(["card", "unused"]),
    );
  });

  it("hovers without Lumiose's execution contract", async () => {
    const hover = await server.request<Hover | null>("textDocument/hover", at("props.title", 7));
    const value = (hover?.contents as MarkupContent | undefined)?.value ?? "";
    expect(value).toContain("title");
    expect(value).not.toMatch(/\*\*(?:tracked|untracked|once|deferred)\*\*/);
  });
});
