// Client runtime size report (spec §6 budgets, min+brotli: the whole client runtime ≤ 10 kB hard cap;
// typical app imports ≤ 6 kB soft target). Bundles each entry with Vite (Rolldown, minified,
// tree-shaken) and prints minified, gzip and brotli sizes. Run: `pnpm --filter lumen size`.
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { build, type Rollup } from "vite";

const src = fileURLToPath(new URL("../src/", import.meta.url));
/** Entry name prefix → budget in bytes. */
const BUDGETS: Record<string, number> = {
  "core + dom (typical": 6 * 1024,
  "core + dom (every": 10 * 1024,
};

/** Entry name → module source (imports are resolved against src/). */
const entries: Record<string, string> = {
  // What a typical compiled app imports (doc-2 golden examples plus the common reactive API).
  "core + dom (typical app imports)": `export { signal, computed, effect, batch, untrack, onCleanup, onMount } from "${src}core/index.ts"; export { template, bind, setText, setAttr, setClass, toggleClass, setStyle, insert, list, branch, selector, createComponent, delegateEvents, listen, mount } from "${src}dom/index.ts";`,
  // What the js-framework-benchmark app needs (its bundle budget is 8 kB including app code).
  "core + dom (benchmark imports)": `export { signal, batch } from "${src}core/index.ts"; export { template, bind, setText, toggleClass, list, selector, createComponent, delegateEvents, mount } from "${src}dom/index.ts";`,
  "core + dom (every export)": `export * from "${src}core/index.ts"; export * from "${src}dom/index.ts"; export * from "${src}dom/public.ts";`,
  "core (every export)": `export * from "${src}core/index.ts";`,
  "dom only (core imports excluded)": `export * from "${src}dom/index.ts";`,
};

async function bundle(code: string, externalCore: boolean): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [
      {
        name: "size-entry",
        resolveId: (id) => (id === "virtual:size-entry" ? "\0size-entry" : undefined),
        load: (id) => (id === "\0size-entry" ? code : undefined),
      },
    ],
    build: {
      write: false,
      minify: true,
      target: "esnext",
      modulePreload: false,
      // An app build (lib mode keeps whitespace in ES output); the entry keeps its exports.
      rollupOptions: {
        input: "virtual:size-entry",
        preserveEntrySignatures: "strict",
        external: externalCore ? (id) => id.includes("/core/") : undefined,
      },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]) as Rollup.RollupOutput[];
  return outputs
    .flatMap((o) => o.output)
    .filter((chunk): chunk is Rollup.OutputChunk => chunk.type === "chunk")
    .map((chunk) => chunk.code)
    .join("\n");
}

function sizes(code: string): { min: number; gzip: number; brotli: number } {
  const bytes = Buffer.from(code);
  return {
    min: bytes.length,
    gzip: gzipSync(bytes, { level: 9 }).length,
    brotli: brotliCompressSync(bytes, {
      params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
    }).length,
  };
}

const kb = (n: number): string => `${(n / 1024).toFixed(2)} kB`;

for (const [name, code] of Object.entries(entries)) {
  const s = sizes(await bundle(code, name.startsWith("dom only")));
  const limit = Object.entries(BUDGETS).find(([prefix]) => name.startsWith(prefix))?.[1];
  const budget =
    limit === undefined ? "" : ` (budget ${kb(limit)}: ${s.brotli <= limit ? "OK" : "OVER"})`;
  console.log(`${name}: min ${kb(s.min)}, gzip ${kb(s.gzip)}, brotli ${kb(s.brotli)}${budget}`);
}
