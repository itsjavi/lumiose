// Client runtime size report (spec §6 and decision-55 budgets, min+brotli). Hard caps: what an
// islands page ships (typical imports plus hydration and the loader) ≤ 10 kB, and the whole client
// runtime (every export, hydration and the loader) ≤ 15 kB; with the SPA router, actions, fetchJSON
// and view transitions it is reported only. Soft targets: typical app imports ≤ 6.25 kB; hydration and the island loader
// ≤ 2.75 kB on top of what an app imports. Bundles each entry with Vite (Rolldown, minified,
// tree-shaken) and prints minified, gzip and brotli sizes. Exits 1 when a hard cap is exceeded (it
// runs in `pnpm check`); soft targets are only reported. Run: `pnpm --filter lumiose size`.
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { build, type Rollup } from "vite";

// Forward slashes: the path goes into generated `import` strings (backslashes would be escapes on Windows).
const src = fileURLToPath(new URL("../src/", import.meta.url)).replaceAll("\\", "/");
/** Entry name prefix → budget in bytes; `hard` budgets fail the run (decision-55). */
const BUDGETS: Record<string, { limit: number; hard: boolean }> = {
  "core + dom (typical": { limit: 6.25 * 1024, hard: false },
  "core + dom + islands (typical": { limit: 10 * 1024, hard: true },
  "whole client runtime (": { limit: 15 * 1024, hard: true },
};

const TYPICAL = `export { signal, computed, effect, batch, untrack, onCleanup, onMount } from "${src}core/index.ts"; export { template, bind, setText, setAttr, setClass, toggleClass, setStyle, insert, list, branch, selector, createComponent, delegateEvents, listen, render } from "${src}dom/index.ts";`;
const FETCH = `export { fetchJSON } from "${src}app/fetch-json.ts";`;
// The app layer of the client: the SPA router's entry, form actions, the query cache and the
// client entry (src/instrumentation.client.ts).
const APP_LAYER = `export { startSpa } from "${src}app/router/boot.ts"; export { submit } from "${src}app/actions/client.ts"; export { query } from "${src}app/cache/client.ts"; export { clientEntry } from "${src}app/client-entry.ts";`;
// The island loader's entry (dom/loader.ts) minus the manifest, which is app code.
const ISLANDS = `export { loadIslands } from "${src}dom/islands.ts";`;
// Opt-in APIs (decision-43): exported by `lumiose` from modules of their own, outside the capped
// "every export" set, since bundles that do not use them leave them out. Reported on top of it.
const OPT_IN = `export * from "${src}dom/view-transition.ts";`;
const EVERY = `export * from "${src}core/index.ts"; export * from "${src}dom/index.ts"; export * from "${src}dom/public.ts";`;

/** Entry name → module source (imports are resolved against src/). */
const entries: Record<string, string> = {
  // What a typical compiled app imports (doc-2 golden examples plus the common reactive API).
  "core + dom (typical app imports)": TYPICAL,
  // An islands page: what its islands import plus the loader and hydration (lumiose/dom/loader).
  "core + dom + islands (typical app imports, loader, hydrate)": TYPICAL + ISLANDS,
  // The same without the loader, to tell the loader's share from hydration's.
  "core + dom + hydrate (typical app imports, hydrate)": `${TYPICAL} export { hydrate } from "${src}dom/hydrate.ts";`,
  // What the js-framework-benchmark app needs (its bundle budget is 8 kB including app code).
  "core + dom (benchmark imports)": `export { signal, batch } from "${src}core/index.ts"; export { template, bind, setText, toggleClass, list, selector, createComponent, delegateEvents, render } from "${src}dom/index.ts";`,
  // Report-only since decision-55's amendment: no app ships every export (tree-shaking).
  "core + dom (every export)": EVERY,
  "every export + view transitions, report-only (opt-in)": EVERY + OPT_IN,
  // Every export plus hydration and the loader (hard cap 15 kB, decision-55).
  "whole client runtime (every export, hydrate, loader)": `${EVERY} export { hydrate } from "${src}dom/hydrate.ts"; ${ISLANDS}`,
  // Plus the app layer and view transitions: more than any one page ships (report-only).
  "everything, report-only (whole runtime, router, actions, fetchJSON, view transitions)": `${EVERY} ${OPT_IN} export { hydrate } from "${src}dom/hydrate.ts"; ${ISLANDS} ${FETCH} ${APP_LAYER}`,
  "core (every export)": `export * from "${src}core/index.ts";`,
  // App layer, report-only: `fetchJSON` called in event handlers only (no async components or
  // resources), which leaves the keyed cache out, and the same with async components, which need it.
  "app: typical imports + fetchJSON, report-only (handlers only)": `${TYPICAL} ${FETCH}`,
  "app: typical imports + fetchJSON, report-only (with async components, cache)": `${TYPICAL} ${FETCH} export { $async, $await, $leave } from "${src}dom/index.ts";`,
  "dom only (core imports excluded)": `export * from "${src}dom/index.ts";`,
};

/** The `define` of apps with `src/instrumentation.client.ts` (TASK-299, src/dom/instrument.ts). */
const CLIENT_HOOKS = { "import.meta.env.LUMIOSE_CLIENT_HOOKS": "true" };

async function bundle(
  code: string,
  externalCore: boolean,
  define?: Record<string, string>,
): Promise<string> {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    define,
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
const every = measured["core + dom (every export)"]!;
const optIn = measured["every export + view transitions, report-only (opt-in)"]!;
console.log(
  `view transitions on top of every export (opt-in): min ${kb(optIn.min - every.min)}, gzip ${kb(optIn.gzip - every.gzip)}, brotli ${kb(optIn.brotli - every.brotli)}`,
);
// Every entry above is measured without client instrumentation, which apps without
// src/instrumentation.client.ts ship none of. With it (report-only): the islands entry, plus the
// router, actions and fetchJSON/query, whose calls it wraps.
const appCode = `${entries["core + dom + islands (typical app imports, loader, hydrate)"]} ${FETCH} ${APP_LAYER}`;
const plain = sizes(await bundle(appCode, false));
const instrumented = sizes(await bundle(appCode, false, CLIENT_HOOKS));
console.log(
  `client instrumentation on top of islands, router, actions and fetchJSON, report-only: min ${kb(instrumented.min - plain.min)}, gzip ${kb(instrumented.gzip - plain.gzip)}, brotli ${kb(instrumented.brotli - plain.brotli)}`,
);
if (overHardCap.length > 0) {
  console.error(`\nOver a hard cap (decision-55): ${overHardCap.join("; ")}`);
  process.exitCode = 1;
}
