// LUM4003 (TASK-116): a server-only module reachable from a client graph fails the build and the
// dev request, with the importer chain; server graphs and stylesheets are unaffected.
import { linkLumiose } from "./test-links.ts";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join as joinPath } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build, createServer, normalizePath } from "vite";
import lumiose from "./index.ts";
import { importerChain, isServerOnly } from "./server-only.ts";

// Vite's ids use `/`, also on Windows: so do the paths in these expectations.
const join = (...parts: string[]): string => normalizePath(joinPath(...parts));

const binding = await import("@lumiose/compiler").catch(() => undefined);

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
  "src/main.tsx": `import { render } from "lumiose/dom";
import { Likes } from "./components/Likes.tsx";
render(() => <Likes />, document.body);
`,
  "src/clean.tsx": `export const answer = 42;\n`,
  "src/entry.server.ts": `import { like } from "./lib/db.server.ts";
export { like };
`,
  // TASK-170 bypasses.
  "src/asset.ts": `export const secrets = new URL("./server/secrets.ts", import.meta.url).href;\n`,
  "src/worker.ts": `import { like } from "./lib/db.server.ts";\nself.onmessage = () => like();\n`,
  "src/spawn.ts": `export const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });\n`,
  "src/raw.ts": `import code from "./server/secrets.ts?raw";\nexport { code };\n`,
  "src/outside.ts": `import { token } from "../../shared/src/server/token.ts";\nexport { token };\n`,
  "src/linked.ts": `import { SECRET } from "./lib/alias.ts";\nexport { SECRET };\n`,
};

let base: string;
let root: string;

beforeAll(() => {
  if (!binding) return;
  base = normalizePath(realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-server-only-"))));
  root = join(base, "app");
  for (const [name, code] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), code);
  }
  mkdirSync(join(root, "node_modules"));
  linkLumiose(root);
  // A sibling workspace folder outside the Vite root, and a symlink to a server-only file.
  mkdirSync(join(base, "shared/src/server"), { recursive: true });
  writeFileSync(join(base, "shared/package.json"), `{ "name": "shared" }\n`);
  writeFileSync(join(base, "shared/src/server/token.ts"), `export const token = "t0k3n";\n`);
  symlinkSync(join(root, "src/server/secrets.ts"), join(root, "src/lib/alias.ts"));
});

afterAll(() => {
  if (base) rmSync(base, { recursive: true, force: true });
});

function clientBuild(input: string) {
  return build({
    root,
    configFile: false,
    logLevel: "silent",
    plugins: [lumiose()],
    build: { write: false, rolldownOptions: { input: join(root, input) } },
  });
}

/** The error message of a client build of `input` ("built" when it succeeds). */
function failure(input: string): Promise<string> {
  return clientBuild(input).then(
    () => "built",
    (thrown: unknown) => (thrown as Error).message,
  );
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

  it("closes the bypasses: new URL, workers, ?raw, packages outside the root, symlinks (TASK-170)", async () => {
    expect(await failure("src/asset.ts")).toContain(
      'LUM4003: src/server/secrets.ts is server-only, but client code references it with new URL("./server/secrets.ts", import.meta.url)',
    );
    expect(await failure("src/spawn.ts")).toContain("LUM4003: src/lib/db.server.ts is server-only");
    expect(await failure("src/raw.ts")).toContain("LUM4003: src/server/secrets.ts is server-only");
    expect(await failure("src/outside.ts")).toContain(
      "LUM4003: ../shared/src/server/token.ts is server-only",
    );
    expect(await failure("src/linked.ts")).toContain("LUM4003");
  }, 60_000);

  it("leaves server builds alone", async () => {
    await expect(
      build({
        root,
        configFile: false,
        logLevel: "silent",
        plugins: [lumiose()],
        build: { write: false, ssr: join(root, "src/entry.server.ts") },
      }),
    ).resolves.toBeDefined();
  }, 30_000);

  it("fails the dev request for server-only code from the client", async () => {
    const server = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [lumiose()],
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

describe.skipIf(!binding)("decision-29 defaults", () => {
  it("exposes only PUBLIC_ variables and denies server-only files over HTTP; both overridable", async () => {
    const config = async (extra: object) => {
      const server = await createServer({
        root,
        configFile: false,
        logLevel: "silent",
        plugins: [lumiose()],
        appType: "custom",
        server: { middlewareMode: true, ws: false, watch: null },
        ...extra,
      });
      await server.close();
      return server.config;
    };
    const defaults = await config({});
    expect(defaults.envPrefix).toBe("PUBLIC_");
    expect(defaults.server.fs.deny).toEqual(
      expect.arrayContaining([
        ".env",
        "**/.git/**",
        `${root}/**/*.server.*`,
        `${root}/src/server/**`,
      ]),
    );
    const own = await config({ envPrefix: "APP_", server: { fs: { deny: [".env"] } } });
    expect(own.envPrefix).toBe("APP_");
    expect(own.server.fs.deny).toEqual([".env"]);
  });
});

describe("isServerOnly", () => {
  it("matches *.server.* files and src/server/ of the project, not CSS or dependencies", () => {
    expect(isServerOnly("/app/src/lib/db.server.ts", "/app")).toBe(true);
    expect(isServerOnly("/app/src/server/db.ts?v=1", "/app")).toBe(true);
    expect(isServerOnly("/app/src/Panel.server.stsx?lumiose&type=style&lang.css", "/app")).toBe(
      false,
    );
    expect(isServerOnly("/app/src/components/server/Nav.stsx", "/app")).toBe(false);
    expect(isServerOnly("/app/src/serverless.ts", "/app")).toBe(false);
    expect(isServerOnly("/app/node_modules/x/index.server.js", "/app")).toBe(false);
    // Case-insensitive file systems: any spelling.
    expect(isServerOnly("/app/SRC/Server/db.ts", "/app")).toBe(true);
    expect(isServerOnly("/app/src/lib/Db.SERVER.ts", "/app")).toBe(true);
    // A query does not hide the file; a stylesheet is not code.
    expect(isServerOnly("/app/src/server/db.ts?raw", "/app")).toBe(true);
    expect(isServerOnly("/app/src/x.css?url&server.ts", "/app")).toBe(false);
  });

  it("follows the first importer up to an entry, without cycles", () => {
    const importers: Record<string, string[]> = { c: ["b"], b: ["a", "c"], a: ["c"] };
    expect(importerChain("c", (id) => importers[id] ?? [])).toEqual(["a", "b", "c"]);
  });
});
