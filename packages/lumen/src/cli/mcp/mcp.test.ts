// `lumen mcp` (TASK-34) through the MCP SDK client: in memory for every tool and resource, and once
// over stdio with the real `lumen` binary. The fixture app lives in a temp dir whose
// node_modules link this package and TypeScript.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tsconfigTemplate } from "../check/index.ts";
import { createLumenMcpServer, type LumenMcp } from "./index.ts";
import { propsOf } from "./source.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = join(here, "../../..");
const typescriptDir = dirname(createRequire(import.meta.url).resolve("typescript/package.json"));
const binding = await import("@lumen/compiler").catch(() => undefined);

const FILES: Record<string, string> = {
  "src/routes/index.stsx": `import { Title } from "lumen";
import { Card } from "../components/Card.stsx";
import { Counter } from "../components/Counter.stsx";

export default function Home() {
  console.log("rendering home");
  return (
    <main>
      <Title>Home</Title>
      <h1>Hello MCP</h1>
      <Card title="First" />
      <Counter start={1} client:visible />
    </main>
  );
}
`,
  "src/routes/api/hello.ts": `export function GET() {
  return Response.json({ hello: "world" });
}
`,
  "src/components/Card.stsx": `const gap = "8px";

export interface CardProps {
  title: string;
  /** Optional body. */
  children?: JSX.Element;
}

export function Card(props: CardProps) {
  return (
    <section class="card">
      <style>
        .card { display: grid; gap: $gap; }
      </style>
      <h2>{props.title}</h2>
      {props.children}
    </section>
  );
}
`,
  "src/components/Counter.stsx": `import { signal } from "lumen";

export function Counter({ start = 0 }: { start?: number }) {
  const count = signal(start);
  return <button onClick={() => count.set(count() + 1)}>{count()}</button>;
}
`,
  "src/components/Fancy.stsx": `export function Fancy() {
  return (
    <p class="fancy">
      <style lang="scss">
        .fancy { color: red; }
      </style>
      Fancy
    </p>
  );
}
`,
};

let root: string;
let mcp: LumenMcp;
let client: Client;

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "lumen-mcp-")));
  for (const [name, code] of Object.entries(FILES)) {
    await mkdir(dirname(join(root, name)), { recursive: true });
    await writeFile(join(root, name), code);
  }
  await writeFile(join(root, "tsconfig.json"), JSON.stringify(tsconfigTemplate(), null, 2));
  await mkdir(join(root, "node_modules"));
  await symlink(packageDir, join(root, "node_modules/lumen"), "junction");
  await symlink(typescriptDir, join(root, "node_modules/typescript"), "junction");

  mcp = await createLumenMcpServer({ root });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "lumen-test", version: "0.0.0" });
  await Promise.all([mcp.server.connect(serverTransport), client.connect(clientTransport)]);
});

afterAll(async () => {
  await client?.close();
  await mcp?.close();
  if (root) await rm(root, { recursive: true, force: true });
});

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { type: string; text: string }[];
  return { isError: result.isError === true, text: content[0]!.text };
}

async function callJson<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { isError, text } = await call(name, args);
  expect(isError, text).toBe(false);
  return JSON.parse(text) as T;
}

describe("lumen mcp", () => {
  it("lists the tools, with instructions", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).toSorted()).toEqual([
      "check",
      "compile",
      "components",
      "dev_logs",
      "docs_get",
      "docs_search",
      "render",
      "routes",
    ]);
    expect(client.getInstructions()).toContain("docs_search");
  });

  it("searches and reads the docs", async () => {
    const search = await callJson("docs_search", { query: "await island", limit: 3 });
    expect(search.results.length).toBeGreaterThan(0);
    expect(search.results[0]).toMatchObject({
      topic: expect.any(String),
      title: expect.any(String),
    });

    const page = await call("docs_get", { topic: "LUM2001" });
    expect(page.isError).toBe(false);
    expect(page.text).toContain("lumen docs: errors/LUM2001");
    expect(page.text).toMatch(/^# LUM2001/m);

    const signals = await call("docs_get", { topic: "signals" });
    expect(signals.text).toContain("concepts/signals");

    const missing = await call("docs_get", { topic: "no-such-topic-xyz" });
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain('No docs topic "no-such-topic-xyz"');
  });

  it("exposes the docs and the route manifest as resources", async () => {
    const { resources } = await client.listResources();
    const uris = resources.map((resource) => resource.uri);
    expect(uris).toContain("lumen://routes");
    expect(uris).toContain("lumen://docs/concepts/signals");

    const page = await client.readResource({ uri: "lumen://docs/concepts/signals" });
    expect((page.contents[0] as { text: string }).text).toMatch(/^# /);

    const routes = await client.readResource({ uri: "lumen://routes" });
    const manifest = JSON.parse((routes.contents[0] as { text: string }).text);
    expect(manifest.routes.map((route: { pattern: string }) => route.pattern)).toEqual(
      expect.arrayContaining(["/", "/api/hello"]),
    );
  });

  it("lists the routes", async () => {
    const report = await callJson("routes");
    expect(report.defaultMode).toBe("static");
    expect(report.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pattern: "/", kind: "page", file: "src/routes/index.stsx" }),
        expect.objectContaining({ pattern: "/api/hello", kind: "endpoint" }),
      ]),
    );
  });

  it.skipIf(!binding)("describes components, props, islands and style scopes", async () => {
    const { files } = await callJson("components");
    const byFile = Object.fromEntries(files.map((file: { file: string }) => [file.file, file]));
    const card = byFile["src/components/Card.stsx"].components[0];
    expect(card).toMatchObject({
      name: "Card",
      exported: true,
      async: false,
      location: { line: 9, column: 8 },
      props: { parameter: "props: CardProps" },
    });
    expect(card.props.type).toContain("title: string;");
    expect(card.styleScopes).toEqual([
      { attribute: expect.stringMatching(/^data-l-/), location: { line: 11, column: 5 } },
    ]);
    expect(byFile["src/components/Counter.stsx"].components[0].props).toEqual({
      parameter: "{ start = 0 }: { start?: number }",
    });
    expect(byFile["src/routes/index.stsx"].islands).toEqual([
      expect.objectContaining({
        export: "Counter",
        module: "/src/components/Counter.stsx",
        strategy: "visible",
      }),
    ]);

    const one = await callJson("components", { file: "src/components/Fancy.stsx" });
    expect(one.files).toHaveLength(1);
  });

  it.skipIf(!binding)("compiles a file or source text for the client and the server", async () => {
    const card = await callJson("compile", { file: "src/components/Card.stsx" });
    expect(card.client.code).toContain("lumen/dom");
    expect(card.client.css).toMatch(/\.card\[data-l-[\w-]+\]/);
    expect(card.client.css).toContain("gap: 8px");
    expect(card.server.code).toContain("lumen/server");
    expect(card.diagnostics).toEqual([]);

    const snippet = await callJson("compile", {
      source: "export function A() { return <p>a</p>; }",
      target: "client",
    });
    expect(snippet.client.code).toContain("function A");
    expect(snippet.server).toBeUndefined();

    const missing = await call("compile", { file: "src/nope.stsx" });
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain("does not exist");
  });

  it.skipIf(!binding)(
    "checks the project: structured diagnostics with fixes",
    async () => {
      const report = await callJson("check", { files: ["src/components/Fancy.stsx"] });
      expect(report).toMatchObject({
        ok: false,
        summary: { errors: 1, files: 1 },
        projectSummary: { errors: 1, files: 1 },
      });
      const lang = report.diagnostics.find((d: { message: string }) =>
        d.message.includes("unknown `<style>` attribute `lang`"),
      );
      expect(lang).toMatchObject({
        source: "lumen",
        file: "src/components/Fancy.stsx",
        code: "LUM1005",
        severity: "error",
        line: 4,
        docs: "errors/LUM1005",
        fix: {
          message: "Remove `lang`",
          edits: [{ line: 4, column: 13, endLine: 4, endColumn: 25, text: "" }],
        },
      });
      expect(
        report.diagnostics.every((d: { file: string }) => d.file === "src/components/Fancy.stsx"),
      ).toBe(true);
    },
    60_000,
  );

  it.skipIf(!binding)(
    "renders a route through the dev server and returns its logs",
    async () => {
      const before = await callJson("dev_logs");
      expect(before).toMatchObject({ available: false, entries: [] });
      expect(before.help).toContain("render");

      const page = await callJson("render", { path: "/" });
      expect(page.status).toBe(200);
      expect(page.headers["content-type"]).toContain("text/html");
      expect(page.body).toContain("<h1>Hello MCP</h1>");
      expect(page.body).toContain("<title>Home</title>");
      expect(page.truncated).toBe(false);

      const api = await callJson("render", { path: "/api/hello" });
      expect(JSON.parse(api.body)).toEqual({ hello: "world" });

      const cut = await callJson("render", { path: "/", maxLength: 10 });
      expect(cut).toMatchObject({ truncated: true });
      expect(cut.body).toHaveLength(10);

      const logs = await callJson("dev_logs");
      expect(logs.available).toBe(true);
      expect(logs.entries[0]).toMatchObject({ id: 1, level: "info", source: "vite" });
      expect(logs.entries[0].message).toContain("Dev server started at http://127.0.0.1:");
      const last = logs.entries.at(-1).id;
      expect((await callJson("dev_logs", { since: last })).entries).toEqual([]);
    },
    60_000,
  );
});

describe("lumen mcp over stdio", () => {
  it.skipIf(!binding)(
    "serves an SDK client, keeping app console output off stdout",
    async () => {
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [join(packageDir, "src/cli/bin.ts"), "mcp", "--root", root],
        stderr: "pipe",
      });
      const stdio = new Client({ name: "lumen-stdio-test", version: "0.0.0" });
      await stdio.connect(transport);
      try {
        expect(stdio.getServerVersion()?.name).toBe("lumen");
        const result = await stdio.callTool({
          name: "docs_search",
          arguments: { query: "signal" },
        });
        const text = (result.content as { text: string }[])[0]!.text;
        expect(JSON.parse(text).results.length).toBeGreaterThan(0);

        const page = await stdio.callTool({ name: "render", arguments: { path: "/" } });
        expect(JSON.parse((page.content as { text: string }[])[0]!.text).status).toBe(200);
        const logs = await stdio.callTool({ name: "dev_logs", arguments: { level: "info" } });
        const { entries } = JSON.parse((logs.content as { text: string }[])[0]!.text);
        expect(entries).toContainEqual(
          expect.objectContaining({ source: "console", level: "info", message: "rendering home" }),
        );
      } finally {
        await stdio.close();
      }
    },
    60_000,
  );
});

const props = (text: string, name = "C") => propsOf(text, name, { start: 0, end: text.length });

describe("propsOf", () => {
  it("reads the first parameter after the name and type parameters", () => {
    expect(props("function C() { return null; }")).toBeNull();
    expect(props("const C = (p: Record<string, number>, ref) => null")).toEqual({
      parameter: "p: Record<string, number>",
    });
    expect(props("function C<T extends { a: 1 }>(props: { onPick: (t: T) => void }) {}")).toEqual({
      parameter: "props: { onPick: (t: T) => void }",
    });
    expect(props('function C({ label = "a,b)" }: { label?: string }) {}')).toEqual({
      parameter: '{ label = "a,b)" }: { label?: string }',
    });
    expect(props("type P = { a: string };\nfunction C(props: P) {}")).toEqual({
      parameter: "props: P",
      type: "type P = { a: string }",
    });
  });
});
