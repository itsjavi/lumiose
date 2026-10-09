import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { build } from "./build.ts";
import { buildCommand, previewCommand, startPreview } from "./command.ts";

const binding = await import("@lumen/compiler").catch(() => undefined);
const adapterRoot = resolve(import.meta.dirname, "../../../../adapter-node");
const root = mkdtempSync(join(tmpdir(), "lumen-command-"));
const roots = [root];
afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

describe("build and preview commands", () => {
  it("lumen build reports route errors and exits 1", async () => {
    mkdirSync(join(root, "src/routes/api"), { recursive: true });
    writeFileSync(
      join(root, "src/routes/api/subscribe.ts"),
      "export function GET() {}\nexport function POST() {}\n",
    );
    const errors: string[] = [];
    const code = await buildCommand({ root, writeError: (text) => errors.push(text) });
    expect(code).toBe(1);
    expect(errors.join("")).toMatch(/^lumen build: The routes have errors:\n.*LUM5005/);
  });

  it("lumen preview serves with the project's @lumen/adapter-node and needs a build", async () => {
    mkdirSync(join(root, "node_modules/@lumen"), { recursive: true });
    symlinkSync(adapterRoot, join(root, "node_modules/@lumen/adapter-node"), "dir");
    const errors: string[] = [];
    const code = await previewCommand({
      root,
      write: () => {},
      writeError: (text) => errors.push(text),
    });
    expect(code).toBe(1);
    expect(errors.join("")).toMatch(/^lumen preview: No build in .*Run `lumen build` first\.\n$/);
  });

  it.skipIf(!binding)(
    "lumen preview sends Vite's preview.headers, else server.headers (TASK-95)",
    async () => {
      const app = realpathSync(mkdtempSync(join(tmpdir(), "lumen-preview-")));
      roots.push(app);
      const files: Record<string, string> = {
        "src/routes/index.stsx": "export default function Home() { return <h1>Home</h1>; }\n",
        "src/routes/live.stsx": `export const mode = "server";
export default function Live() { return <h1>Live</h1>; }
`,
        "vite.config.ts": `import lumen from "lumen/vite";
export default {
  plugins: [lumen()],
  server: { headers: { "cross-origin-opener-policy": "same-origin" } },
};
`,
      };
      for (const [name, code] of Object.entries(files)) {
        mkdirSync(dirname(join(app, name)), { recursive: true });
        writeFileSync(join(app, name), code);
      }
      mkdirSync(join(app, "node_modules/@lumen"), { recursive: true });
      symlinkSync(resolve(import.meta.dirname, "../../.."), join(app, "node_modules/lumen"), "dir");
      symlinkSync(adapterRoot, join(app, "node_modules/@lumen/adapter-node"), "dir");
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
        `import lumen from "lumen/vite";
export default {
  plugins: [lumen()],
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
    "lumen preview serves a build without dist/server as static files, without the adapter (TASK-125)",
    async () => {
      const app = realpathSync(mkdtempSync(join(tmpdir(), "lumen-preview-static-")));
      roots.push(app);
      const files: Record<string, string> = {
        "src/routes/index.stsx": "export default function Home() { return <h1>Home</h1>; }\n",
        "src/routes/about.stsx": "export default function About() { return <h1>About</h1>; }\n",
        "src/routes/_404.stsx": "export default function Missing() { return <h1>Missing</h1>; }\n",
        "vite.config.ts": `import lumen from "lumen/vite";
export default {
  plugins: [lumen({ headers: [{ path: "/**", headers: { "x-site": "1" } }, { path: "/about", headers: { "x-about": "1" } }] })],
};
`,
      };
      for (const [name, code] of Object.entries(files)) {
        mkdirSync(dirname(join(app, name)), { recursive: true });
        writeFileSync(join(app, name), code);
      }
      mkdirSync(join(app, "node_modules"), { recursive: true });
      symlinkSync(resolve(import.meta.dirname, "../../.."), join(app, "node_modules/lumen"), "dir");
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
