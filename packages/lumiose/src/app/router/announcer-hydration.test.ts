// @vitest-environment happy-dom
// The route announcer (TASK-345) of a hydrated SPA root: the server renders the root island, the
// SPA entry's island hydrates it with compiled components, and the announcer's live region goes
// outside the island without disturbing what it claimed. A file of its own: the island loader has
// no disposer, so the hydrated SPA keeps listening until the file ends.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compile } from "@lumiose/compiler";
import { expect, it, vi } from "vitest";
import { flush } from "../../core/index.ts";
import { loadIslands } from "../../dom/islands.ts";
import { createComponent, island, renderToString } from "../../server/index.ts";
import { navigate } from "./index.ts";
import { createRouter, prepareRoot, type SpaConfig } from "./router.ts";
import { SPA_REF } from "./table.ts";

// happy-dom replaces the global `URL`, so paths are built with node:path.
const src = resolve(import.meta.dirname, "../..");
const IMPORTS = {
  client: { "lumiose/dom": "dom/index.ts", lumiose: "index.ts" },
  server: { "lumiose/server": "server/index.ts", lumiose: "index.server.ts" },
} as const;
// Compiled modules go to packages/lumiose/test/out (ignored), inside the Vite root.
const out = resolve(src, "../test/out/announcer");
mkdirSync(out, { recursive: true });

const SOURCE = `
  export function Layout(props: { children?: any }) {
    return <main><nav>Site</nav>{props.children}</main>;
  }
  export function Home() {
    return <h1>Home</h1>;
  }
  export function About() {
    return <h1>About us</h1>;
  }`;

type Module = Record<string, any>;

/** Compiles SOURCE for `target` and imports it. */
async function load(target: "client" | "server"): Promise<Module> {
  const result = compile(SOURCE, "/src/routes/case.tsx", {
    target,
    styleImport: false,
    sourceMap: false,
  });
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  let code = result.code;
  for (const [specifier, file] of Object.entries(IMPORTS[target])) {
    code = code.replaceAll(`from "${specifier}"`, `from ${JSON.stringify(join(src, file))}`);
  }
  const path = join(out, `case-${Date.now()}.${target}.js`);
  writeFileSync(path, code);
  return (await import(/* @vite-ignore */ path)) as Module;
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await new Promise((done) => setTimeout(done, 0));
  flush();
}

it("hydrates the SPA root, then adds the announcer outside it", async () => {
  const [client, server] = await Promise.all([load("client"), load("server")]);
  const APP = "src/routes/layout.tsx";
  const LEAF = "src/routes/page.tsx";
  const modules: Record<string, unknown> = {
    [APP]: client.Layout,
    [LEAF]: client.Home,
    "src/routes/about/page.tsx": client.About,
  };
  const config: SpaConfig = {
    base: "/",
    routes: [
      { segments: [], app: APP, levels: [APP, LEAF] },
      {
        segments: [{ kind: "static", value: "about" }],
        app: APP,
        levels: [APP, "src/routes/about/page.tsx"],
      },
    ],
    notFoundPages: [],
    pages: {},
    modules: Object.fromEntries(
      Object.entries(modules).map(([file, component]) => [
        file,
        () => Promise.resolve({ default: component }),
      ]),
    ),
  };
  history.replaceState(null, "", "/");
  // The SPA root island as ./server.ts renders it.
  document.body.innerHTML = await renderToString(() =>
    island(
      `/${LEAF}${SPA_REF}`,
      () =>
        createComponent(server.Layout, {
          params: {},
          get children() {
            return createComponent(server.Home, { params: {} });
          },
        }),
      {},
      "load",
    ),
  );
  const heading = document.querySelector("h1")!;
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  loadIslands({
    [`/${LEAF}${SPA_REF}`]: () => {
      createRouter(config, APP);
      return prepareRoot(LEAF, false);
    },
  });
  await settle();

  // Claimed, not rendered again: the server's nodes stay.
  expect(document.querySelector("h1")).toBe(heading);
  expect(document.querySelectorAll("main")).toHaveLength(1);
  expect(warn).not.toHaveBeenCalled();
  const live = document.querySelector("[data-l-announcer]")!;
  expect(document.querySelectorAll("[data-l-announcer]")).toHaveLength(1);
  expect(document.body.lastElementChild).toBe(live);
  expect(live.textContent).toBe("");

  await navigate("/about");
  expect(document.querySelector("h1")?.textContent).toBe("About us");
  expect(live.textContent).toBe("About us");
  warn.mockRestore();
});
