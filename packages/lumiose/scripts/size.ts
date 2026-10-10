// Client runtime size report (spec §6 budgets, min+brotli: what any one page can ship ≤ 10 kB hard
// cap, i.e. every export, and typical imports plus hydration and the loader; typical app imports
// ≤ 6.25 kB soft target; hydration and the island loader ≤ 2.75 kB on top of what an app imports).
// The whole runtime (every export plus hydration and the loader) is reported only. Bundles each entry with Vite (Rolldown, minified, tree-shaken) and prints
// minified, gzip and brotli sizes. Exits 1 when a hard cap is exceeded (it runs in `pnpm check`);
// soft targets are only reported. Run: `pnpm --filter lumiose size`.
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { build, type Rollup } from "vite";

// Forward slashes: the path goes into generated `import` strings (backslashes would be escapes on Windows).
const src = fileURLToPath(new URL("../src/", import.meta.url)).replaceAll("\\", "/");
const HARD_CAP = 10 * 1024;
/** Entry name prefix → budget in bytes; `hard` budgets fail the run. */
const BUDGETS: Record<string, { limit: number; hard: boolean }> = {
  "core + dom (typical": { limit: 6.25 * 1024, hard: false },
  "core + dom (every": { limit: HARD_CAP, hard: true },
  "core + dom + islands (typical": { limit: HARD_CAP, hard: true },
};

const TYPICAL = `export { signal, computed, effect, batch, untrack, onCleanup, onMount } from "${src}core/index.ts"; export { template, bind, setText, setAttr, setClass, toggleClass, setStyle, insert, list, branch, selector, createComponent, delegateEvents, listen, mount } from "${src}dom/index.ts";`;
// The island loader's entry (dom/loader.ts) minus the manifest, which is app code.
const ISLANDS = `export { loadIslands } from "${src}dom/islands.ts";`;

/** Entry name → module source (imports are resolved against src/). */
const entries: Record<string, string> = {
  // What a typical compiled app imports (doc-2 golden examples plus the common reactive API).
  "core + dom (typical app imports)": TYPICAL,
  // An islands page: what its islands import plus the loader and hydration (lumiose/dom/loader).
  "core + dom + islands (typical app imports, loader, hydrate)": TYPICAL + ISLANDS,
  // The same without the loader, to tell the loader's share from hydration's.
  "core + dom + hydrate (typical app imports, hydrate)": `${TYPICAL} export { hydrate } from "${src}dom/hydrate.ts";`,
  // What the js-framework-benchmark app needs (its bundle budget is 8 kB including app code).
  "core + dom (benchmark imports)": `export { signal, batch } from "${src}core/index.ts"; export { template, bind, setText, toggleClass, list, selector, createComponent, delegateEvents, mount } from "${src}dom/index.ts";`,
  "core + dom (every export)": `export * from "${src}core/index.ts"; export * from "${src}dom/index.ts"; export * from "${src}dom/public.ts";`,
  // Every export plus hydration and the loader: no page ships all of it (report-only, spec §6).
  "whole client runtime, report-only (every export, hydrate, loader)": `export * from "${src}core/index.ts"; export * from "${src}dom/index.ts"; export * from "${src}dom/public.ts"; export { hydrate } from "${src}dom/hydrate.ts"; ${ISLANDS}`,
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

const measured: Record<string, ReturnType<typeof sizes>> = {};
const overHardCap: string[] = [];
for (const [name, code] of Object.entries(entries)) {
  const s = (measured[name] = sizes(await bundle(code, name.startsWith("dom only"))));
  const budget = Object.entries(BUDGETS).find(([prefix]) => name.startsWith(prefix))?.[1];
  let verdict = "";
  if (budget !== undefined) {
    const ok = s.brotli <= budget.limit;
    if (!ok && budget.hard) overHardCap.push(name);
    verdict = ` (${budget.hard ? "hard cap" : "soft target"} ${kb(budget.limit)}: ${ok ? "OK" : "OVER"})`;
  }
  console.log(`${name}: min ${kb(s.min)}, gzip ${kb(s.gzip)}, brotli ${kb(s.brotli)}${verdict}`);
}
// What hydration and the loader add to a typical app (shared runtime code counted once).
const base = measured["core + dom (typical app imports)"]!;
const islands = measured["core + dom + islands (typical app imports, loader, hydrate)"]!;
const added = islands.brotli - base.brotli;
console.log(
  `islands on top of typical app imports: min ${kb(islands.min - base.min)}, gzip ${kb(islands.gzip - base.gzip)}, brotli ${kb(added)} (soft target 2.75 kB: ${added <= 2.75 * 1024 ? "OK" : "OVER"})`,
);
const hydrateOnly = measured["core + dom + hydrate (typical app imports, hydrate)"]!;
const loader = islands.brotli - hydrateOnly.brotli;
console.log(
  `  of which hydrate: brotli ${kb(hydrateOnly.brotli - base.brotli)}; loader: brotli ${kb(loader)} (target 1.00 kB: ${loader <= 1024 ? "OK" : "OVER"})`,
);
if (overHardCap.length > 0) {
  console.error(`\nOver the ${kb(HARD_CAP)} hard cap (spec §6): ${overHardCap.join("; ")}`);
  process.exitCode = 1;
}
