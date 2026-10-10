// Framework JS shipped by the sample apps: a report, with no per-app budget (spec §6: the 10 kB
// brotli hard cap applies to the framework runtime, enforced by `pnpm --filter lumiose size`). Builds each app with `lumiose build` into a temporary directory and splits
// every client JS chunk into framework runtime (lumiose's own modules plus Vite's helpers) and app
// code (the app's modules and its generated island manifest / route table). A chunk's brotli size
// is split by the minified bytes of each side (from its source map); most chunks are all one or
// the other.
//
// The framework total (runtime, router and app-layer helpers, reported apart) counts every chunk, so
// it is what a page with every island (or every SPA route) loads. The router's History API fallback
// is reported apart: only browsers without the Navigation API load it.
//
// Run: `pnpm --filter lumiose size:apps [app…] [--modules]` (apps: example directory names; default
// the three sample apps). `--modules` lists the modules of each chunk: minified bytes and an
// estimate of their brotli share.
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants } from "node:zlib";
import { loadConfigFromFile, minifySync, type Plugin, type Rollup, type UserConfig } from "vite";
import { build } from "@lumiose/vite/internal/app/production/build.ts";
import { findViteConfig } from "@lumiose/vite/internal/app/project.ts";
import lumiose from "@lumiose/vite/internal/index.ts";

const APPS = ["ssr-bookshelf", "ssg-travel-journal", "spa-chiptune"];
const examples = fileURLToPath(new URL("../../../examples/", import.meta.url));
const lumioseSrc = fileURLToPath(new URL("../src/", import.meta.url));

interface ChunkStats {
  fileName: string;
  brotli: number;
  /** Minified bytes per source module (from the chunk's source map); unmapped bytes under "". */
  modules: Record<string, number>;
}

const brotli = (code: string): number =>
  brotliCompressSync(Buffer.from(code), {
    params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
  }).length;

/**
 * Where a module's bytes count: the runtime (core, DOM, hydration, the island loader, Vite's client
 * helpers such as `\0vite/preload-helper.js`), the SPA router (`lumiose/router` and route matching),
 * its History API fallback, the app-layer helpers (`submit()`, `fetchJSON()`, `redirect()`…), or the app's own code
 * (including its island manifest and route table).
 */
type Part = "runtime" | "router" | "fallback" | "helpers" | "app";

function partOf(id: string): Part {
  if (id.startsWith("\0vite/")) return "runtime";
  if (!id.startsWith(lumioseSrc)) return "app";
  const path = id.slice(lumioseSrc.length);
  if (path === "app/router/history.ts") return "fallback";
  if (path.startsWith("app/router/") || path.startsWith("app/routes/")) return "router";
  return path.startsWith("app/") ? "helpers" : "runtime";
}

/** Vite's preload file list (`__vite__mapDeps`) in the size report: app code. */
const MAP_DEPS = "(vite preload list)";

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Bytes of `code` per source of its source map: each mapped segment counts up to the next one
 * (or the end of its line). Unmapped bytes (chunk glue: imports, exports) go under "".
 */
function bytesPerSource(code: string, map: Rollup.SourceMap, dir: string): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (source: string, bytes: number): void => {
    out[source] = (out[source] ?? 0) + bytes;
  };
  const sources = map.sources.map((source) =>
    source.startsWith("\0") ? source : join(dir, source),
  );
  const lines = code.split("\n");
  const mappingLines = map.mappings.split(";");
  let sourceIndex = 0;
  for (let l = 0; l < lines.length; l++) {
    const line = Buffer.from(lines[l]!);
    // Vite's list of the files the app's dynamic imports preload (the island manifest's, the SPA
    // route table's): app data, unmapped.
    if (lines[l]!.startsWith("const __vite__mapDeps=") && !mappingLines[l]) {
      add(MAP_DEPS, line.length + 1);
      continue;
    }
    let column = 0;
    let previous = 0;
    let previousSource = "";
    for (const segment of (mappingLines[l] ?? "").split(",")) {
      if (segment === "") continue;
      const fields: number[] = [];
      for (let i = 0, value = 0, shift = 0; i < segment.length; i++) {
        const digit = BASE64.indexOf(segment[i]!);
        value += (digit & 31) << shift;
        if (digit & 32) {
          shift += 5;
        } else {
          fields.push(value & 1 ? -(value >>> 1) : value >>> 1);
          value = shift = 0;
        }
      }
      column += fields[0]!;
      if (fields.length > 1) sourceIndex += fields[1]!;
      add(previousSource, column - previous);
      previous = column;
      previousSource = fields.length > 1 ? sources[sourceIndex]! : "";
    }
    add(previousSource, line.length - previous + 1);
  }
  return out;
}

/**
 * Virtual modules (the island manifest, the SPA route table, Vite's preload helper) have no source
 * map, so their bytes count for the module rendered before them (or as unmapped): estimate their
 * minified size and move it over.
 */
function withVirtualModules(
  bytes: Record<string, number>,
  chunk: Rollup.OutputChunk,
): Record<string, number> {
  let previous = "";
  for (const [id, info] of Object.entries(chunk.modules)) {
    if (bytes[id] !== undefined) {
      previous = id;
    } else if (info.code !== null && info.renderedLength > 0) {
      const estimate = minifySync(`${id}.js`, info.code, { compress: false }).code.length;
      const moved = Math.min(estimate, bytes[previous] ?? 0);
      bytes[previous] = (bytes[previous] ?? 0) - moved;
      bytes[id] = moved;
    }
  }
  return bytes;
}

function statsPlugin(chunks: ChunkStats[]): Plugin {
  return {
    name: "lumiose:size-apps",
    apply: "build",
    // After every generateBundle hook (lumiose build drops empty stylesheet facades there).
    writeBundle: {
      handler(options, bundle) {
        if (this.environment.name !== "client") return;
        for (const file of Object.values(bundle)) {
          if (file.type !== "chunk") continue;
          const dir = join(options.dir!, file.fileName, "..");
          chunks.push({
            fileName: file.fileName,
            brotli: brotli(file.code),
            // A chunk of virtual modules only has no source map.
            modules: withVirtualModules(
              file.map === null
                ? { "": file.code.length }
                : bytesPerSource(file.code, file.map, dir),
              file,
            ),
          });
        }
      },
    },
  };
}

/** Builds an app's client and returns its chunks (the server build and prerender run too). */
async function buildApp(root: string): Promise<ChunkStats[]> {
  const chunks: ChunkStats[] = [];
  // Inside the app, so the server build resolves the app's dependencies when it prerenders.
  const cache = join(root, "node_modules", ".cache");
  await mkdir(cache, { recursive: true });
  const outDir = await mkdtemp(join(cache, "lumiose-size-"));
  // `build()` takes a config file: a stub that returns the app's config plus the stats plugin.
  const stub = join(outDir, "vite.config.mjs");
  await writeFile(stub, "export default (env) => globalThis.lumioseSizeConfig(env);\n");
  const appConfig = findViteConfig(root);
  (globalThis as Record<string, unknown>).lumioseSizeConfig = async (env: {
    command: "build";
    mode: string;
  }): Promise<UserConfig> => {
    const loaded =
      appConfig === false ? undefined : await loadConfigFromFile(env, appConfig, root, "silent");
    const config: UserConfig = loaded?.config ?? { plugins: [lumiose()] };
    return {
      ...config,
      plugins: [...(config.plugins ?? []), statsPlugin(chunks)],
      // Source maps attribute the minified bytes of each chunk to its modules.
      build: { ...config.build, outDir: join(outDir, "dist"), sourcemap: "hidden" },
    };
  };
  try {
    const { clientDir } = await build({ root, configFile: stub, logLevel: "silent" });
    // `lumiose build` removes the loader or SPA entry when no page loads it.
    return chunks.filter((chunk) => existsSync(join(clientDir, chunk.fileName)));
  } finally {
    await rm(outDir, { recursive: true, force: true });
  }
}

const moduleName = (id: string): string =>
  id.startsWith(lumioseSrc)
    ? `lumiose/${relative(lumioseSrc, id)}`
    : id.startsWith("\0")
      ? id.slice(1)
      : id.startsWith("/")
        ? relative(examples, id)
        : id;
const kb = (n: number): string => `${(n / 1024).toFixed(2)} kB`;
const args = process.argv.slice(2);
const listModules = args.includes("--modules");
const apps = args.filter((arg) => !arg.startsWith("--"));

for (const app of apps.length > 0 ? apps : APPS) {
  const root = join(examples, app);
  const chunks = await buildApp(root);
  const parts: Record<Part, number> = { runtime: 0, router: 0, fallback: 0, helpers: 0, app: 0 };
  const lines: string[] = [];
  for (const chunk of chunks.toSorted((a, b) => b.brotli - a.brotli)) {
    const entries = Object.entries(chunk.modules).filter(([id]) => id !== "");
    // Unmapped glue (imports, exports) is split like the rest of the chunk.
    const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0) || 1;
    let framework = 0;
    for (const [id, bytes] of entries) {
      const part = partOf(id);
      parts[part] += (chunk.brotli * bytes) / total;
      if (part !== "app") framework += bytes;
    }
    lines.push(
      `  ${chunk.fileName}: brotli ${kb(chunk.brotli)}, framework ${Math.round((framework / total) * 100)}%`,
    );
    if (listModules) {
      for (const [id, bytes] of entries.toSorted((a, b) => b[1] - a[1])) {
        const estimate = (chunk.brotli * bytes) / total;
        lines.push(`      ${moduleName(id)}: ${bytes} B min, ~${Math.round(estimate)} B brotli`);
      }
    }
  }
  const framework = parts.runtime + parts.router + parts.helpers;
  console.log(
    `${app}: framework ${kb(framework)} brotli = runtime ${kb(parts.runtime)} + router ${kb(parts.router)} + app helpers ${kb(parts.helpers)}${parts.fallback > 0 ? ` (History API fallback ${kb(parts.fallback)}, without the Navigation API only)` : ""}; app code ${kb(parts.app)}`,
  );
  console.log(lines.join("\n"));
}
