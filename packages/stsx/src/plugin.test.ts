// @lumiose/stsx on real Vite dev servers and production builds, with React (@vitejs/plugin-react)
// and Solid (vite-plugin-solid): the framework compiles the TSX, the plugin its style blocks.
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import react from "@vitejs/plugin-react";
import solid from "vite-plugin-solid";
import {
  build,
  createLogger,
  createServer,
  type InlineConfig,
  type PluginOption,
  type Rolldown,
} from "vite";
import stsx, { type StsxOptions } from "./index.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);
const fixture = (name: string) =>
  fileURLToPath(new URL(`../test/fixtures/${name}`, import.meta.url));

function config(name: string, plugins: PluginOption[], warnings: string[] = []): InlineConfig {
  const logger = createLogger("silent");
  logger.warn = (message) => void warnings.push(message);
  return {
    root: fixture(name),
    configFile: false,
    customLogger: logger,
    plugins,
    logLevel: "silent",
  };
}

async function devServer(name: string, plugins: PluginOption[], warnings?: string[]) {
  return createServer({
    ...config(name, plugins, warnings),
    appType: "custom",
    server: { middlewareMode: true, ws: false, watch: null },
  });
}

async function production(name: string, plugins: PluginOption[]) {
  const output = (await build({
    ...config(name, plugins),
    build: {
      write: false,
      minify: false,
      rolldownOptions: { input: `${fixture(name)}/main.tsx` },
    },
  })) as Rolldown.RolldownOutput;
  const css = output.output
    .filter((item) => item.type === "asset" && item.fileName.endsWith(".css"))
    .map((item) => (item.type === "asset" ? String(item.source) : ""))
    .join("\n");
  const js = output.output.map((item) => (item.type === "chunk" ? item.code : "")).join("\n");
  return { css, js };
}

describe("stsx() options", () => {
  it("requires classAttribute and validates scopedStyles", () => {
    expect(() => stsx({} as StsxOptions)).toThrow(
      'stsx({ classAttribute }): expected "className" (React, Preact) or "class" (Solid), got undefined.',
    );
    expect(() =>
      stsx({ classAttribute: "className", scopedStyles: { strategy: "id" } } as never),
    ).toThrow('stsx({ scopedStyles.strategy }): expected "attribute" or "class", got "id".');
    expect(() => stsx({ classAttribute: "class", scopes: true } as never)).toThrow(
      "stsx({ scopes }): unknown option. Known options: classAttribute, scopedStyles.",
    );
  });
});

const reactPlugins = (options?: Partial<StsxOptions>) => [
  stsx({ classAttribute: "className", ...options }),
  react(),
];
const solidPlugins = () => [stsx({ classAttribute: "class" }), solid()];

describe.skipIf(!binding)("stsx() with React", () => {
  const plugins = reactPlugins;

  it("serves .stsx as TSX for plugin-react, with its CSS module", async () => {
    const server = await devServer("react", plugins());
    try {
      const js = await server.environments.client.transformRequest("/App.stsx");
      expect(js!.code).toMatch(/data-lum-[0-9a-z]{8}/);
      expect(js!.code).toContain("App.stsx.css");
      expect(js!.code).toContain("$RefreshReg$");
      expect(js!.code).not.toContain("<style>");
      const css = await server.environments.client.transformRequest("/App.stsx.css");
      expect(css!.code).toMatch(/\.page\[data-lum-[0-9a-z]{8}\]/);
      expect(css!.code).toContain("#ede9fe");
      expect(css!.code).toContain("width < 640px");
    } finally {
      await server.close();
    }
  });

  it("server-renders class markers, with class passthrough to a child component", async () => {
    const server = await devServer("react", plugins({ scopedStyles: { strategy: "class" } }));
    try {
      const { default: App } = await server.ssrLoadModule("/App.stsx");
      const { createElement } = await import("react");
      const { renderToString } = await import("react-dom/server");
      const html: string = renderToString(createElement(App));
      const scope = /class="page (lum-[0-9a-z]{8})"/.exec(html)![1]!;
      expect(html).toContain(`<span class="cta ${scope}">chip</span>`);
      expect(html).toMatch(/<button class="lum-[0-9a-z]{8} lum-[0-9a-z]{8}">/);
    } finally {
      await server.close();
    }
  });

  it("builds the scoped CSS and the markers for production", async () => {
    const { css, js } = await production("react", plugins());
    const token = /data-lum-([0-9a-z]{8})/.exec(js)![1];
    expect(css).toContain(`.page[data-lum-${token}]`);
    expect(css).toMatch(/button\[data-lum-[0-9a-z]{8}\]/);
  });

  it("gives Vite's dependency scanner the masked TSX", async () => {
    const plugin = stsx({ classAttribute: "className" });
    const returned = (
      plugin.config as () => { optimizeDeps: { rolldownOptions: { plugins: any[] } } }
    )();
    const scanner = returned.optimizeDeps.rolldownOptions.plugins[0];
    const loaded = await scanner.load.handler(`${fixture("react")}/App.stsx.tsx`);
    expect(loaded.moduleType).toBe("tsx");
    expect(loaded.code).toContain('import { useState } from "react";');
    expect(loaded.code).not.toContain(".counter {");
  });

  it("reports errors with a code frame and warnings through Vite", async () => {
    const warnings: string[] = [];
    const server = await devServer("react", plugins(), warnings);
    try {
      await expect(server.environments.client.transformRequest("/Broken.stsx")).rejects.toThrow(
        /LUM3009 .*Broken\.stsx:8:15/,
      );
      expect(warnings.join("\n")).toMatch(/LUM3005 `\.unused` matches no element/);
    } finally {
      await server.close();
    }
  });

  it("rejects a .stsx module with route exports under React Router, in dev", async () => {
    // A stand-in for React Router's plugin: the check only needs its name in the config.
    const server = await devServer("react", [...plugins(), { name: "react-router" }]);
    try {
      await expect(server.environments.client.transformRequest("/Route.stsx")).rejects.toThrow(
        /Route\.stsx: a React Router route module cannot be a \.stsx file \(it exports `loader`/,
      );
    } finally {
      await server.close();
    }
    // Without React Router, `loader` is just an export.
    const plain = await devServer("react", plugins());
    try {
      const js = await plain.environments.client.transformRequest("/Route.stsx");
      expect(js!.code).toContain("function loader()");
    } finally {
      await plain.close();
    }
  });

  it("rejects a .stsx React Router route module", async () => {
    const server = await devServer("react", plugins());
    try {
      await expect(
        server.environments.ssr.pluginContainer.resolveId(
          "./App.stsx",
          `${fixture("react")}/\0virtual:react-router/server-build`,
        ),
      ).rejects.toThrow(
        /a React Router route module cannot be a \.stsx file \(React Router imports it/,
      );
    } finally {
      await server.close();
    }
  });
});

describe.skipIf(!binding)("stsx() with Solid", () => {
  const plugins = solidPlugins;

  it("serves .stsx as TSX for vite-plugin-solid", async () => {
    const server = await devServer("solid", plugins());
    try {
      const js = await server.environments.client.transformRequest("/App.stsx");
      // Solid compiles the markers into its static templates.
      expect(js!.code).toMatch(/template\(`<main data-lum-[0-9a-z]{8} class=page/);
      expect(js!.code).toMatch(/<li data-lum-[0-9a-z]{8} class=dot/);
    } finally {
      await server.close();
    }
  });

  it("builds for production", async () => {
    const { css, js } = await production("solid", plugins());
    const token = /data-lum-([0-9a-z]{8})/.exec(js)![1];
    expect(css).toContain(`.dot[data-lum-${token}]`);
  });
});
