// Compiles the benchmark page of every framework with its own compiler, server target, into
// `dist/<framework>/` (plain ESM importing the framework's server runtime), plus a
// `dist/<framework>/render.js` exporting `render(data)`: string or Promise<string>.
//
// Solid 2 (release candidate) is installed next to Solid 1.9 as `solid-js-2`. Its runtime,
// `@solidjs/web`, imports `solid-js`, which resolves to 1.9 here, so `dist/solid-2/render.js`
// bundles that runtime with `solid-js` resolved to the 2.0 package.
//
//   node scripts/build.ts

import { transformAsync } from "@babel/core";
import { getViteConfig as getAstroViteConfig } from "astro/config";
import { compile as compileLumiose } from "@lumiose/compiler";
import { transform as transformSolid2 } from "@solidjs/compiler";
import { createRequire } from "node:module";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile as compileSvelte } from "svelte/compiler";
import { build as viteBuild, transformWithOxc } from "vite";
import { compileTemplate, parse as parseSfc, rewriteDefault } from "vue/compiler-sfc";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");
const dist = join(root, "dist");
const require = createRequire(join(root, "package.json"));

/** Relative imports of the sources, as they resolve from `dist/<framework>/`. */
function rewriteImports(code: string): string {
  return code
    .replaceAll(/(["'])\.\.\/data\.ts\1/g, '"../../src/data.ts"')
    .replaceAll(/(["'])(\.\/[\w-]+)\.(?:svelte|vue)\1/g, '"$2.js"');
}

async function emit(framework: string, files: Record<string, string>): Promise<void> {
  const dir = join(dist, framework);
  await mkdir(dir, { recursive: true });
  for (const [name, code] of Object.entries(files)) await writeFile(join(dir, name), code);
}

async function buildLumiose(): Promise<void> {
  const file = join(src, "lumiose/Page.stsx");
  const result = compileLumiose(await readFile(file, "utf8"), file, {
    target: "server",
    sourceMap: false,
    styleImport: false,
    emitCss: false,
    root,
  });
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  if (errors.length > 0) throw new Error(errors.map((error) => error.message).join("\n"));
  for (const warning of result.diagnostics)
    console.warn(`lumiose: ${warning.code} ${warning.message}`);
  await emit("lumiose", {
    "Page.js": rewriteImports(result.code),
    "render.js": `import { createComponent, renderToString } from "lumiose/server";
import { Page } from "./Page.js";
export const render = (data) => renderToString(() => createComponent(Page, { data }));
`,
  });
}

async function buildSolid(framework: string, hydratable: boolean): Promise<void> {
  const file = join(src, "solid/Page.jsx");
  const result = await transformAsync(await readFile(file, "utf8"), {
    filename: file,
    babelrc: false,
    configFile: false,
    presets: [["babel-preset-solid", { generate: "ssr", hydratable }]],
  });
  await emit(framework, {
    "Page.js": rewriteImports(result!.code!),
    "render.js": `import { createComponent, renderToString } from "solid-js/web";
import { Page } from "./Page.js";
export const render = (data) => renderToString(() => createComponent(Page, { data }));
`,
  });
}

/** Solid 2 RC: its own compiler (`@solidjs/compiler`, the Oxc compiler `@solidjs/vite-plugin` uses). */
async function buildSolid2(): Promise<void> {
  const file = join(src, "solid/Page.jsx");
  const result = transformSolid2(await readFile(file, "utf8"), {
    filename: file,
    generate: "ssr",
    hydratable: false,
  });
  const dir = join(dist, "solid-2");
  await emit("solid-2", {
    "Page.js": rewriteImports(result.code),
    "entry.js": `import { createComponent, renderToString } from "@solidjs/web";
import { Page } from "./Page.js";
export const render = (data) => renderToString(() => createComponent(Page, { data }));
`,
  });
  // `solid-js` and its subpaths as the 2.0 package resolves them for itself (its `node` exports).
  const solid2 = createRequire(require.resolve("solid-js-2/package.json"));
  await viteBuild({
    configFile: false,
    logLevel: "warn",
    mode: "production",
    plugins: [
      {
        name: "solid-2",
        enforce: "pre",
        resolveId: (id) => (/^solid-js(?:\/|$)/.test(id) ? solid2.resolve(id) : null),
      },
    ],
    ssr: { noExternal: true },
    build: {
      ssr: join(dir, "entry.js"),
      outDir: dir,
      emptyOutDir: false,
      minify: false,
      rolldownOptions: { output: { entryFileNames: "render.js" } },
    },
  });
}

async function buildReact(): Promise<void> {
  const file = join(src, "react/Page.jsx");
  const result = await transformWithOxc(await readFile(file, "utf8"), file, {
    lang: "jsx",
    jsx: { runtime: "automatic", development: false },
  });
  await emit("react", {
    "Page.js": rewriteImports(result.code),
    "render.js": `import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { Page } from "./Page.js";
export const render = (data) => renderToString(createElement(Page, { data }));
`,
  });
}

/** Automatic JSX runtime from `preact`, as @preact/preset-vite configures it. */
async function buildPreact(): Promise<void> {
  const file = join(src, "preact/Page.jsx");
  const result = await transformWithOxc(await readFile(file, "utf8"), file, {
    lang: "jsx",
    jsx: { runtime: "automatic", importSource: "preact", development: false },
  });
  await emit("preact", {
    "Page.js": rewriteImports(result.code),
    "render.js": `import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { Page } from "./Page.js";
export const render = (data) => renderToString(h(Page, { data }));
`,
  });
}

/**
 * Remix 3 has no bundler step: `remix/node-tsx` compiles JSX with Oxc (automatic runtime,
 * `jsxImportSource: "remix/component"`) when Node loads the module. The same transform, ahead
 * of time.
 */
async function buildRemix(): Promise<void> {
  const file = join(src, "remix/Page.jsx");
  const result = await transformWithOxc(await readFile(file, "utf8"), file, {
    lang: "jsx",
    jsx: { runtime: "automatic", importSource: "remix/component", development: false },
  });
  await emit("remix", {
    "Page.js": rewriteImports(result.code),
    "render.js": `import { jsx } from "remix/component/jsx-runtime";
import { renderToString } from "remix/component/server";
import { Page } from "./Page.js";
export const render = (data) => renderToString(jsx(Page, { data }));
`,
  });
}

/**
 * `.astro` components compiled by Astro's own Vite pipeline (`getViteConfig`, the config the
 * Container API docs use with Vitest), as an SSR build of `Page.astro`. The Astro runtime stays
 * external in `node_modules`; `render.js` renders the page through the Container API.
 */
async function buildAstro(): Promise<void> {
  const dir = join(dist, "astro");
  const config = await getAstroViteConfig(
    {
      logLevel: "warn",
      mode: "production",
      build: {
        ssr: join(src, "astro/Page.astro"),
        outDir: dir,
        emptyOutDir: false,
        minify: false,
        rolldownOptions: {
          // Astro bundles its runtime into its own server builds; here it stays a plain import,
          // shared with the Container API.
          external: (id) => /^astro(?:\/|$)/.test(id) || id.includes("/node_modules/astro/"),
          output: { entryFileNames: "Page.js" },
        },
      },
    },
    { root, logLevel: "warn" },
  )({ command: "build", mode: "production" });
  await viteBuild({ ...config, configFile: false });
  await emit("astro", {
    "render.js": `import { experimental_AstroContainer } from "astro/container";
import Page from "./Page.js";
const container = await experimental_AstroContainer.create();
export const render = (data) => container.renderToString(Page, { props: { data } });
`,
  });
}

/** Vue SFCs (options API) with their templates compiled for SSR, as @vitejs/plugin-vue does. */
async function buildVue(): Promise<void> {
  const files: Record<string, string> = {};
  for (const name of (await readdir(join(src, "vue"))).filter((file) => file.endsWith(".vue"))) {
    const filename = join(src, "vue", name);
    const { descriptor, errors } = parseSfc(await readFile(filename, "utf8"), { filename });
    if (errors.length > 0) throw errors[0];
    const template = compileTemplate({
      source: descriptor.template!.content,
      filename,
      id: name,
      ssr: true,
      ssrCssVars: [],
    });
    if (template.errors.length > 0) throw new Error(String(template.errors[0]));
    const script = rewriteDefault(descriptor.script!.content, "__component");
    files[name.replace(/\.vue$/, ".js")] = rewriteImports(
      `${script}\n${template.code}\n__component.ssrRender = ssrRender;\nexport default __component;\n`,
    );
  }
  files["render.js"] = `import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import Page from "./Page.js";
export const render = (data) => renderToString(createSSRApp(Page, { data }));
`;
  await emit("vue", files);
}

async function buildSvelte(): Promise<void> {
  const files: Record<string, string> = {};
  for (const name of (await readdir(join(src, "svelte"))).filter((file) =>
    file.endsWith(".svelte"),
  )) {
    const filename = join(src, "svelte", name);
    const result = compileSvelte(await readFile(filename, "utf8"), {
      filename,
      generate: "server",
      dev: false,
    });
    files[basename(name, ".svelte") + ".js"] = rewriteImports(result.js.code);
  }
  files["render.js"] = `import { render as renderPage } from "svelte/server";
import Page from "./Page.js";
export const render = (data) => renderPage(Page, { props: { data } }).body;
`;
  await emit("svelte", files);
}

await rm(dist, { recursive: true, force: true });
await Promise.all([
  buildLumiose(),
  buildSolid("solid", false),
  buildSolid("solid-hydratable", true),
  buildSolid2(),
  buildReact(),
  buildVue(),
  buildSvelte(),
  buildPreact(),
  buildRemix(),
  buildAstro(),
]);
console.log(`Built ${(await readdir(dist)).join(", ")} into ${dist}`);
