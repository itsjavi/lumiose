// Hot updates of @lumiose/stsx on a real dev server (TASK-579): one client update per save, the
// stylesheet alone for a style-only edit, and the CSS of the files that use an edited constants
// module. React Router's `react-router-server-change-trigger-client-hmr` reloads the client copy of
// every module a hook passes on, in every environment; a stand-in for it checks that no update is
// sent twice.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import react from "@vitejs/plugin-react";
import { createLogger, createServer, type HotPayload, type Plugin, type ViteDevServer } from "vite";
import { cacheDirOf, copyFixture, removeDir } from "../test/project.ts";
import stsx from "./index.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);

/** What React Router's dev plugin does with the modules a hot update hook passes on. */
const echoToClient: Plugin = {
  name: "echo-to-client",
  hotUpdate({ server, modules }) {
    for (const mod of modules) {
      const client =
        mod.id === null ? undefined : server.environments.client.moduleGraph.getModuleById(mod.id);
      if (client !== undefined) server.environments.client.reloadModule(client);
    }
  },
};

let root: string;
let server: ViteDevServer;

beforeEach(async () => {
  if (!binding) return;
  root = copyFixture("react");
  server = await createServer({
    root,
    cacheDir: cacheDirOf(root),
    configFile: false,
    customLogger: createLogger("silent"),
    plugins: [stsx({ classAttribute: "className" }), react(), echoToClient],
    appType: "custom",
    server: { middlewareMode: true, ws: false, watch: null },
  });
  // The client and ssr graphs hold the modules, as after a page load.
  await server.environments.client.transformRequest("/App.stsx");
  await server.environments.client.transformRequest("/App.stsx.css");
  await server.environments.ssr.transformRequest("/App.stsx");
  await server.environments.ssr.transformRequest("/App.stsx.css?inline");
});

afterEach(async () => {
  await server?.close();
  if (root) removeDir(root);
});

/** The update paths the client receives while `edit` changes `file` (the watcher is driven by hand). */
async function clientUpdates(file: string, edit: (source: string) => string): Promise<string[]> {
  const paths: string[] = [];
  const hot = server.environments.client.hot;
  const send = hot.send;
  hot.send = ((payload: HotPayload) => {
    if (payload.type === "update") paths.push(...payload.updates.map((update) => update.path));
    if (payload.type === "full-reload") paths.push("full-reload");
  }) as typeof hot.send;
  try {
    const path = join(root, file);
    writeFileSync(path, edit(readFileSync(path, "utf8")));
    server.watcher.emit("change", path);
    await expect.poll(() => paths.length).toBeGreaterThan(0);
    // Late duplicates would arrive within a few ticks.
    await new Promise((done) => setTimeout(done, 100));
  } finally {
    hot.send = send;
  }
  return paths;
}

describe.skipIf(!binding)("stsx() hot updates", () => {
  it("replaces only the stylesheet on a style-only edit, once", async () => {
    const paths = await clientUpdates("App.stsx", (s) =>
      s.replace("display: flex;", "display: grid;"),
    );
    expect(paths).toEqual(["/App.stsx.css"]);
    const css = await server.environments.client.transformRequest("/App.stsx.css");
    expect(css!.code).toContain("display: grid");
  });

  it("updates the module once on a JSX edit", async () => {
    const paths = await clientUpdates("App.stsx", (s) =>
      s.replace("count: {count}", "clicks: {count}"),
    );
    expect(paths).toEqual(["/App.stsx.tsx"]);
  });

  it("updates the CSS of the files that use an edited constants module", async () => {
    const paths = await clientUpdates("tokens.ts", (s) => s.replace("#ede9fe", "#fef3c7"));
    expect(paths).toEqual(["/App.stsx.css"]);
    const css = await server.environments.client.transformRequest("/App.stsx.css");
    expect(css!.code).toContain("#fef3c7");
  });

  it("keeps the server's stylesheet fresh without echoing it to the client", async () => {
    await clientUpdates("App.stsx", (s) => s.replace("display: flex;", "display: inline-flex;"));
    const css = await server.environments.ssr.transformRequest("/App.stsx.css?inline");
    expect(css!.code).toContain("display: inline-flex");
  });
});

describe.skipIf(!binding)("stsx() hot updates with Solid", () => {
  it("replaces only the stylesheet on a style-only edit, once", async () => {
    const { default: solid } = await import("vite-plugin-solid");
    const dir = copyFixture("solid");
    const solidServer = await createServer({
      root: dir,
      cacheDir: cacheDirOf(dir),
      configFile: false,
      customLogger: createLogger("silent"),
      plugins: [stsx({ classAttribute: "class" }), solid(), echoToClient],
      appType: "custom",
      server: { middlewareMode: true, ws: false, watch: null },
    });
    const paths: string[] = [];
    try {
      await solidServer.environments.client.transformRequest("/App.stsx");
      await solidServer.environments.client.transformRequest("/App.stsx.css");
      solidServer.environments.client.hot.send = ((payload: HotPayload) => {
        if (payload.type === "update") paths.push(...payload.updates.map((u) => u.path));
      }) as typeof solidServer.environments.client.hot.send;
      const path = join(dir, "App.stsx");
      writeFileSync(path, readFileSync(path, "utf8").replace("color: teal;", "color: navy;"));
      solidServer.watcher.emit("change", path);
      await expect.poll(() => paths.length).toBeGreaterThan(0);
      await new Promise((done) => setTimeout(done, 100));
    } finally {
      await solidServer.close();
      removeDir(dir);
    }
    expect(paths).toEqual(["/App.stsx.css"]);
  });
});
