import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { linkLumiose } from "../../test-links.ts";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { build } from "./build.ts";
import { buildCommand, previewCommand, startPreview } from "./command.ts";
import { checkStreaming, STREAMING_FILES } from "../__fixtures__/streaming.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);
const adapterRoot = resolve(import.meta.dirname, "../../../../adapter-node");
const root = mkdtempSync(join(tmpdir(), "lumiose-command-"));
const roots = [root];
afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

describe("build and preview commands", () => {
  it("lumiose build reports route errors and exits 1", async () => {
    mkdirSync(join(root, "src/routes/api/subscribe"), { recursive: true });
    writeFileSync(
      join(root, "src/routes/api/subscribe/route.ts"),
      "export function GET() {}\nexport function POST() {}\n",
    );
    const errors: string[] = [];
    const code = await buildCommand({ root, writeError: (text) => errors.push(text) });
    expect(code).toBe(1);
    expect(errors.join("")).toMatch(/^lumiose build: The routes have errors:\n.*LUM5005/);
  });

  it("lumiose preview serves with the project's @lumiose/adapter-node and needs a build", async () => {
    mkdirSync(join(root, "node_modules/@lumiose"), { recursive: true });
    symlinkSync(adapterRoot, join(root, "node_modules/@lumiose/adapter-node"), "dir");
    const errors: string[] = [];
    const code = await previewCommand({
      root,
      write: () => {},
      writeError: (text) => errors.push(text),
    });
    expect(code).toBe(1);
    expect(errors.join("")).toMatch(
      /^lumiose preview: No build in .*Run `lumiose build` first\.\n$/,
    );
  });

  it.skipIf(!binding)(
    "lumiose preview sends Vite's preview.headers, else server.headers (TASK-95)",
    async () => {
      const app = realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-preview-")));
      roots.push(app);
      const files: Record<string, string> = {
        "src/routes/page.stsx": "export default function Home() { return <h1>Home</h1>; }\n",
        "src/routes/live/page.stsx": `export const mode = "server";
export default function Live() { return <h1>Live</h1>; }
`,
        "vite.config.ts": `import lumiose from "@lumiose/vite";
export default {
  plugins: [lumiose()],
  server: { headers: { "cross-origin-opener-policy": "same-origin" } },
};
`,
      };
      for (const [name, code] of Object.entries(files)) {
        mkdirSync(dirname(join(app, name)), { recursive: true });
        writeFileSync(join(app, name), code);
      }
      linkLumiose(app);
      symlinkSync(adapterRoot, join(app, "node_modules/@lumiose/adapter-node"), "dir");
      await build({ root: app, logLevel: "silent" });

      const headersOf = async (path: string) => {
        const server = await startPreview({ root: app, port: 0, host: "127.0.0.1" });
        try {
          const response = await fetch(new URL(path, server.url));
          return Object.fromEntries(
            ["cross-origin-opener-policy", "cross-origin-embedder-policy"].map((name) => [
              name,
              response.headers.get(name),
            ]),
          );
        } finally {
          await server.close();
        }
      };
      // server.headers, on a prerendered page and a server route.
      for (const path of ["/", "/live"]) {
        expect(await headersOf(path)).toEqual({
          "cross-origin-opener-policy": "same-origin",
          "cross-origin-embedder-policy": null,
        });
      }
      // preview.headers replaces them.
      writeFileSync(
        join(app, "vite.config.ts"),
        `import lumiose from "@lumiose/vite";
export default {
  plugins: [lumiose()],
  server: { headers: { "cross-origin-opener-policy": "same-origin" } },
  preview: { headers: { "cross-origin-embedder-policy": "require-corp" } },
};
`,
      );
      expect(await headersOf("/")).toEqual({
        "cross-origin-opener-policy": null,
        "cross-origin-embedder-policy": "require-corp",
      });
    },
  );

  it.skipIf(!binding)(
    "lumiose preview streams, sends one resolved document from middleware, and ends a hung boundary (TASK-340)",
    async () => {
      const app = realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-preview-streaming-")));
      roots.push(app);
      for (const [name, code] of Object.entries(STREAMING_FILES)) {
        mkdirSync(dirname(join(app, name)), { recursive: true });
        writeFileSync(join(app, name), code);
      }
      linkLumiose(app);
      symlinkSync(adapterRoot, join(app, "node_modules/@lumiose/adapter-node"), "dir");
      await build({ root: app, logLevel: "silent" });
      const server = await startPreview({ root: app, port: 0, host: "127.0.0.1" });
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await checkStreaming((path) => fetch(new URL(path, server.url)), false);
      } finally {
        error.mockRestore();
        await server.close();
      }
    },
  );

  it.skipIf(!binding)(
    "lumiose preview serves a build without dist/server as static files, without the adapter (TASK-125)",
    async () => {
      const app = realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-preview-static-")));
      roots.push(app);
      const files: Record<string, string> = {
        "src/routes/page.stsx": "export default function Home() { return <h1>Home</h1>; }\n",
        "src/routes/about/page.stsx":
          "export default function About() { return <h1>About</h1>; }\n",
        "src/routes/not-found.stsx":
          "export default function Missing() { return <h1>Missing</h1>; }\n",
        "vite.config.ts": `import lumiose from "@lumiose/vite";
export default {
  plugins: [lumiose({ headers: [{ path: "/**", headers: { "x-site": "1" } }, { path: "/about", headers: { "x-about": "1" } }] })],
};
`,
      };
      for (const [name, code] of Object.entries(files)) {
        mkdirSync(dirname(join(app, name)), { recursive: true });
        writeFileSync(join(app, name), code);
      }
      linkLumiose(app);
      await build({ root: app, logLevel: "silent" });
      expect(existsSync(join(app, "dist/server"))).toBe(false);

      const server = await startPreview({ root: app, port: 0, host: "127.0.0.1" });
      try {
        const at = (path: string) => fetch(new URL(path, server.url));
        const home = await at("/");
        expect(await home.text()).toContain("<h1>Home</h1>");
        expect(home.headers.get("x-site")).toBe("1");
        const about = await at("/about");
        expect(await about.text()).toContain("<h1>About</h1>");
        expect(about.headers.get("x-about")).toBe("1");
        const missing = await at("/nowhere");
        expect(missing.status).toBe(404);
        expect(await missing.text()).toContain("<h1>Missing</h1>");
        expect(missing.headers.get("x-site")).toBe("1");
      } finally {
        await server.close();
      }
    },
  );
});
