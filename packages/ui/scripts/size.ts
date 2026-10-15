// `pnpm --filter @lumiose/ui size`: what each component costs the browser, minified, gzip and
// brotli. Report-only: @lumiose/ui is opt-in, so it is measured apart from the runtime's caps
// (decision-55), and the `lumiose` runtime it imports is left out of every row. Per component:
//
// - Elements JS: the `lu-*` custom element definitions a server-rendered page loads for it.
// - Component JS: the component compiled for the browser, as an island that uses it loads it.
// - CSS: its stylesheet, the CSS it needs to work (the package is unstyled).
//
// Each cell is its own Vite build (Rolldown, minified, tree-shaken), so shared code counts in every
// row that needs it, as a page with only that component would load it.

import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { compile } from "@lumiose/compiler";
import { build, type Plugin, type Rollup } from "vite";

const src = fileURLToPath(new URL("../src/", import.meta.url)).replaceAll("\\", "/");

interface Component {
  name: string;
  /** The module that exports the component's parts. */
  module: string;
  /** Its `lu-*` element definitions (none for components that need no script). */
  elements: string[];
  css: string;
}

const COMPONENTS: Component[] = [
  { name: "dialog", module: "dialog/dialog.tsx", elements: [], css: "dialog/dialog.css" },
];

/** Compiles `.tsx` modules for the browser, as @lumiose/vite does in an app. */
const lumioseClient: Plugin = {
  name: "lumiose-client",
  transform(code, id) {
    if (!id.endsWith(".tsx")) return null;
    const result = compile(code, id, { target: "client", sourceMap: false, styleImport: false });
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    if (errors.length > 0) throw new Error(`${id}: ${errors.map((d) => d.message).join("; ")}`);
    return { code: result.code, map: null };
  },
};

async function bundle(source: string, kind: "js" | "css"): Promise<Buffer> {
  const result = (await build({
    configFile: false,
    logLevel: "silent",
    plugins: [
      {
        name: "size-entry",
        resolveId: (id) => (id === "virtual:size-entry" ? "\0size-entry" : undefined),
        load: (id) => (id === "\0size-entry" ? source : undefined),
      },
      lumioseClient,
    ],
    build: {
      write: false,
      minify: true,
      cssMinify: "lightningcss",
      target: "esnext",
      modulePreload: false,
      rollupOptions: {
        input: "virtual:size-entry",
        preserveEntrySignatures: "strict",
        // The runtime is measured by `pnpm --filter lumiose size`.
        external: (id) => /^lumiose(?:\/|$)/.test(id),
      },
    },
  })) as Rollup.RollupOutput | Rollup.RollupOutput[];
  const files = [result].flat().flatMap((output) => output.output);
  return Buffer.concat(
    files.flatMap((file) => {
      if (kind === "js") return file.type === "chunk" ? [Buffer.from(file.code)] : [];
      return file.type === "asset" && file.fileName.endsWith(".css")
        ? [Buffer.from(file.source)]
        : [];
    }),
  );
}

const kb = (bytes: number) => (bytes / 1024).toFixed(2);

function cell(bytes: Buffer): string {
  if (bytes.length === 0) return "none";
  const gzip = gzipSync(bytes, { level: 9 }).length;
  const brotli = brotliCompressSync(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
  }).length;
  return `${kb(bytes.length)} / ${kb(gzip)} / ${kb(brotli)}`;
}

const imports = (modules: string[]) => modules.map((m) => `import "${src}${m}";`).join("\n");
const js = async (modules: string[]) => cell(await bundle(imports(modules), "js"));
const css = async (modules: string[]) => cell(await bundle(imports(modules), "css"));

console.log("@lumiose/ui, min / gzip / brotli in kB (the lumiose runtime is not included)\n");
console.log("| Component | Elements JS (server pages) | Component JS (islands) | CSS |");
console.log("| --- | --- | --- | --- |");
for (const component of COMPONENTS) {
  const exports = `export * from "${src}${component.module}";`;
  const componentJs = cell(await bundle(exports, "js"));
  console.log(
    `| ${component.name} | ${await js(component.elements)} | ${componentJs} | ${await css([component.css])} |`,
  );
}
const everything = `export * from "${src}index.ts";`;
console.log(
  `| everything | ${await js(COMPONENTS.flatMap((c) => c.elements))} | ${cell(await bundle(everything, "js"))} | ${await css(["styles.css"])} |`,
);
