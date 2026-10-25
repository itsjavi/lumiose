// The dev server answers 403 for `.stsx` files outside `server.fs.allow` (TASK-588), as Vite does
// for the files it loads itself: the plugin reads `.stsx` files in its own load hook, which Vite
// does not check.
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer as createHttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import react from "@vitejs/plugin-react";
import { createLogger, createServer, normalizePath, type ViteDevServer } from "vite";
import stsx from "./index.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);
const packageDir = fileURLToPath(new URL("..", import.meta.url));

let base: string;
let root: string;
let outside: string;
let server: ViteDevServer;

beforeEach(async () => {
  if (!binding) return;
  base = normalizePath(realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-stsx-fs-"))));
  root = `${base}/app`;
  outside = `${base}/outside`;
  cpSync(join(packageDir, "test/fixtures/react"), root, { recursive: true });
  symlinkSync(join(packageDir, "node_modules"), join(root, "node_modules"), "junction");
  mkdirSync(outside);
  writeFileSync(
    `${outside}/Secret.stsx`,
    `export function Secret() {\n  return <p className="secret">top secret</p>;\n}\n\n<style>\n  .secret { content: "secret style"; }\n</style>\n`,
  );
  writeFileSync(
    `${outside}/Linked.stsx`,
    `export function Linked() {\n  return <p className="linked">linked</p>;\n}\n\n<style>\n  .linked { color: red; }\n</style>\n`,
  );
  server = await createServer({
    root,
    configFile: false,
    customLogger: createLogger("silent"),
    plugins: [stsx({ classAttribute: "className" }), react()],
    appType: "custom",
    server: { middlewareMode: true, ws: false, watch: null, fs: { allow: [root] } },
  });
});

afterEach(async () => {
  await server?.close();
  if (base) rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe.skipIf(!binding)("server.fs.allow", () => {
  it("answers 403 for .stsx files outside it, and serves those inside and those the app imports", async () => {
    const http = createHttpServer(server.middlewares);
    await new Promise<void>((done) => http.listen(0, "127.0.0.1", done));
    const { port } = http.address() as AddressInfo;
    const get = async (path: string) => {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      return [response.status, await response.text()] as const;
    };
    // Vite's /@fs/ URL of a file: on Windows the path starts with a drive letter (C:/…), not a slash.
    const fsUrl = `/@fs/${outside.replace(/^\//, "")}`;
    try {
      for (const path of [
        `${fsUrl}/Secret.stsx`,
        `${fsUrl}/Secret.stsx?import`,
        `${fsUrl}/Secret.stsx?raw`,
        `${fsUrl}/Secret.stsx.tsx`,
        `${fsUrl}/Secret.stsx.css`,
        `${fsUrl}/Secret.stsx.css?direct`,
      ]) {
        const [status, body] = await get(path);
        expect([path, status]).toEqual([path, 403]);
        expect(body).not.toContain("secret");
      }
      // Files inside it load.
      const [status, body] = await get("/App.stsx");
      expect(status).toBe(200);
      expect(body).toContain("Counter");
      // A file the app imports loads, with its stylesheet, as Vite's imported modules do (a linked
      // package's file).
      const resolved = await server.environments.client.pluginContainer.resolveId(
        `${outside}/Linked.stsx`,
        `${root}/main.tsx`,
      );
      expect(resolved!.id).toBe(`${outside}/Linked.stsx.tsx`);
      const [linked, linkedBody] = await get(`${fsUrl}/Linked.stsx.tsx`);
      expect([linked, linkedBody]).toEqual([200, expect.stringContaining("linked")]);
      const [css, cssBody] = await get(`${fsUrl}/Linked.stsx.css?direct`);
      expect([css, cssBody]).toEqual([200, expect.stringContaining("color: red")]);
      // Server environments read any file, as Vite's do.
      const ssr = await server.environments.ssr.transformRequest(`${outside}/Secret.stsx`);
      expect(ssr!.code).toContain("top secret");
    } finally {
      await new Promise((done) => http.close(done));
    }
  });
});
