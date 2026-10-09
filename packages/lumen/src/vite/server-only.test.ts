// LUM4003 (TASK-116): a server-only module reachable from a client graph fails the build and the
// dev request, with the importer chain; server graphs and stylesheets are unaffected.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build, createServer } from "vite";
import lumen from "./index.ts";
import { importerChain, isServerOnly } from "./server-only.ts";

const binding = await import("@lumen/compiler").catch(() => undefined);
const lumenRoot = resolve(import.meta.dirname, "../..");

const FILES: Record<string, string> = {
  "src/server/secrets.ts": `export const SECRET = "s3cr3t-token";\n`,
  "src/lib/db.server.ts": `import { SECRET } from "../server/secrets.ts";
export const like = () => fetch("https://db.example", { headers: { authorization: SECRET } });
`,
  "src/lib/util.ts": `import { like } from "./db.server.ts";
export const likeTwice = () => { like(); like(); };
`,
  "src/components/Likes.tsx": `import { likeTwice } from "../lib/util.ts";
export function Likes() {
  return <button onClick={likeTwice}>Like</button>;
}
`,
  "src/main.tsx": `import { mount } from "lumen/dom";
import { Likes } from "./components/Likes.tsx";
mount(() => <Likes />, document.body);
`,
  "src/clean.tsx": `export const answer = 42;\n`,
  "src/entry.server.ts": `import { like } from "./lib/db.server.ts";
export { like };
`,
};

let root: string;

beforeAll(() => {
  if (!binding) return;
  root = realpathSync(mkdtempSync(join(tmpdir(), "lumen-server-only-")));
  for (const [name, code] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), code);
  }
  mkdirSync(join(root, "node_modules"));
  symlinkSync(lumenRoot, join(root, "node_modules/lumen"), "dir");
});

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

function clientBuild(input: string) {
  return build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [lumen()],
    build: { write: false, rolldownOptions: { input: join(root, input) } },
  });
}

describe.skipIf(!binding)("LUM4003", () => {
  it("fails a client build that reaches server-only code, with the importer chain", async () => {
    const error = await clientBuild("src/main.tsx").then(
      () => undefined,
      (thrown: unknown) => thrown as Error,
    );
    expect(error).toBeDefined();
    expect(error!.message).toContain(
      "LUM4003: src/lib/db.server.ts is server-only, but client code imports it:\n" +
        "  src/main.tsx\n  → src/components/Likes.tsx\n  → src/lib/util.ts\n  → src/lib/db.server.ts",
    );
    expect(error!.message).toContain("LUM4003: src/server/secrets.ts is server-only");
    await expect(clientBuild("src/clean.tsx")).resolves.toBeDefined();
  }, 30_000);

  it("leaves server builds alone", async () => {
    await expect(
      build({
        root,
        configFile: false,
        logLevel: "silent",
        plugins: [lumen()],
        build: { write: false, ssr: join(root, "src/entry.server.ts") },
      }),
    ).resolves.toBeDefined();
  }, 30_000);

  it("fails the dev request for server-only code from the client", async () => {
    const server = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [lumen()],
      appType: "custom",
      server: { middlewareMode: true, ws: false, watch: null },
    });
    try {
      const client = server.environments.client;
      for (const url of ["/src/main.tsx", "/src/components/Likes.tsx", "/src/lib/util.ts"]) {
        await client.transformRequest(url);
      }
      const error = await client.transformRequest("/src/lib/db.server.ts").then(
        () => undefined,
        (thrown: unknown) => thrown as Error,
      );
      expect(error?.message).toContain("src/main.tsx\n  → src/components/Likes.tsx");
      expect(error?.message).toContain("→ src/lib/db.server.ts");
      // The ssr environment loads it.
      await expect(
        server.environments.ssr.transformRequest("/src/lib/db.server.ts"),
      ).resolves.toBeTruthy();
    } finally {
      await server.close();
    }
  }, 30_000);
});

describe("isServerOnly", () => {
  it("matches *.server.* files and src/server/ of the project, not CSS or dependencies", () => {
    expect(isServerOnly("/app/src/lib/db.server.ts", "/app")).toBe(true);
    expect(isServerOnly("/app/src/server/db.ts?v=1", "/app")).toBe(true);
    expect(isServerOnly("/app/src/Panel.server.stsx?lumen&type=style&lang.css", "/app")).toBe(
      false,
    );
    expect(isServerOnly("/app/src/components/server/Nav.stsx", "/app")).toBe(false);
    expect(isServerOnly("/app/src/serverless.ts", "/app")).toBe(false);
    expect(isServerOnly("/app/node_modules/x/index.server.js", "/app")).toBe(false);
    expect(isServerOnly("/repo/packages/lumen/src/index.server.ts", "/app")).toBe(false);
  });

  it("follows the first importer up to an entry, without cycles", () => {
    const importers: Record<string, string[]> = { c: ["b"], b: ["a", "c"], a: ["c"] };
    expect(importerChain("c", (id) => importers[id] ?? [])).toEqual(["a", "b", "c"]);
  });
});
