// The CSS manifest of builds (spec §4.6.6, decision-12): every stylesheet is built in the client
// environment, including those that only server modules import (server-only components, a
// layout's `import "./app.css"`), and SSR links each route's stylesheets in the shell.
//
// 1. Client build. The server graph does not exist yet (it is built second), so `buildStart`
//    emits every stylesheet the server may import (./scan.ts: Lumiose modules with style blocks and
//    the CSS files source modules import) as an entry of the client build. Vite's CSS pipeline
//    turns each into a CSS asset; `generateBundle` records stylesheet module id → asset URLs.
// 2. Server build. `.stsx` style modules load as empty CSS (the client built them; the server
//    emits no CSS). `virtual:lumiose/css-manifest` is filled in `renderChunk`, once the server graph
//    is complete: for every entry and dynamically imported module (route modules, layouts, the
//    document), the client URLs of the stylesheets its static import graph reaches, in import
//    (cascade) order. Static imports include the components that stream later inside
//    `<Suspense>`, so their CSS is linked in the shell rather than arriving late. A stylesheet the
//    client build did not build is a warning.
// 3. Dev. The module is empty: the dev server links the stylesheets of the ssr module graph with
//    `data-vite-dev-id` (app/dev/plugin.ts), so the Vite client never injects a second copy when
//    an island imports the same CSS module, and style edits are CSS HMR (./styles.ts).

import { relative } from "node:path";
import { isCSSRequest, normalizePath, type Rollup } from "vite";
import type { ScannedModule } from "./scan.ts";
import { cleanId } from "./styles.ts";

export const CSS_MANIFEST = "virtual:lumiose/css-manifest";
export const CSS_MANIFEST_ID = "\0lumiose:css-manifest";

const STYLE_SUFFIX = "?lumiose&type=style&lang.css";
const PLACEHOLDER = "__LUMIOSE_CSS_MANIFEST__";
const PLACEHOLDER_LITERAL = /(["'`])__LUMIOSE_CSS_MANIFEST__\1/;
const NOT_A_STYLESHEET = /[?&](?:inline|url|raw)\b/;

/** The shape of `virtual:lumiose/css-manifest`. */
export interface CssManifestModule {
  /**
   * Project-relative module path (`src/routes/page.stsx`) → URLs (with `base`) of the
   * stylesheets its static import graph reaches, in cascade order. Holds the entries and the
   * dynamically imported modules of the server build; empty in dev.
   */
  default: Readonly<Record<string, readonly string[]>>;
  /** The stylesheets of several modules (the document, layouts, then the route), deduplicated. */
  stylesheets(files: readonly string[]): string[];
}

/** The module's code; the build replaces the placeholder string with the manifest's JSON. */
export function cssManifestCode(build: boolean): string {
  const data = build ? JSON.stringify(PLACEHOLDER) : '"{}"';
  // The placeholder ends its line, so replacing it moves no other mapped code.
  return `const manifest = JSON.parse(${data});
export default manifest;
export function stylesheets(files) {
  const seen = new Set();
  const hrefs = [];
  for (const file of files) {
    for (const href of manifest[file] ?? []) {
      if (seen.has(href)) continue;
      seen.add(href);
      hrefs.push(href);
    }
  }
  return hrefs;
}
`;
}

/** Whether a module id is a stylesheet linked by the page (not `?inline`, `?url` or `?raw`). */
export function isStylesheet(id: string): boolean {
  return !id.startsWith("\0") && isCSSRequest(id) && !NOT_A_STYLESHEET.test(id);
}

export class CssManifest {
  /** Stylesheet module id → URLs of its CSS assets in the client build. */
  readonly #client = new Map<string, string[]>();
  /** Stylesheet module ids emitted as entries of the client build. */
  readonly #emitted = new Set<string>();
  /** Stylesheets the server imports but the client did not build (warned once). */
  readonly #missing = new Set<string>();

  /** Client build, `buildStart`: emits every stylesheet the server graph may import. */
  async emit(context: Rollup.PluginContext, modules: readonly ScannedModule[]): Promise<void> {
    this.#client.clear();
    this.#emitted.clear();
    this.#missing.clear();
    for (const module of modules) {
      if (module.hasStyles) this.#emitted.add(module.file + STYLE_SUFFIX);
      for (const specifier of module.stylesheets) {
        const resolved = await context.resolve(specifier, module.file);
        if (resolved !== null && !resolved.external && isStylesheet(resolved.id)) {
          this.#emitted.add(resolved.id);
        }
      }
    }
    for (const id of [...this.#emitted].toSorted()) {
      context.emitFile({ type: "chunk", id, name: assetName(id) });
    }
  }

  /**
   * Client build, `generateBundle` (before Vite drops the empty JS of pure-CSS chunks): the CSS
   * assets of the chunks holding the emitted stylesheets.
   */
  record(bundle: Rollup.OutputBundle, base: string, cssCodeSplit: boolean): void {
    // Without CSS code splitting every stylesheet is in the one CSS asset.
    const all = cssCodeSplit
      ? []
      : Object.values(bundle)
          .filter((file) => file.type === "asset" && file.fileName.endsWith(".css"))
          .map((file) => base + file.fileName);
    for (const file of Object.values(bundle)) {
      if (file.type !== "chunk") continue;
      const css = cssCodeSplit
        ? [...(file.viteMetadata?.importedCss ?? [])].map((name) => base + name)
        : all;
      for (const id of file.moduleIds) {
        if (this.#emitted.has(id)) this.#client.set(id, css);
      }
    }
  }

  /** Server build, `renderChunk`: the manifest of the complete server graph. */
  manifest(context: Rollup.PluginContext, root: string): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const id of [...context.getModuleIds()].toSorted()) {
      const info = context.getModuleInfo(id);
      if (info === null || (!info.isEntry && info.dynamicImporters.length === 0)) continue;
      if (id.startsWith("\0")) continue;
      const file = normalizePath(relative(root, cleanId(id)));
      if (file.startsWith("../")) continue;
      const hrefs = this.#reachable(context, id);
      if (hrefs.length > 0) out[file] = hrefs;
    }
    return out;
  }

  /** The stylesheets `id` reaches through static imports, in import (execution) order. */
  #reachable(context: Rollup.PluginContext, id: string): string[] {
    const hrefs = new Set<string>();
    const seen = new Set<string>();
    const visit = (current: string, importer: string): void => {
      if (seen.has(current)) return;
      seen.add(current);
      if (isStylesheet(current)) {
        const css = this.#client.get(current);
        if (css !== undefined) {
          for (const href of css) hrefs.add(href);
        } else if (!this.#missing.has(current)) {
          this.#missing.add(current);
          context.warn(
            `${current} (imported by ${importer}) was not built in the client environment: its stylesheet is not linked.`,
          );
        }
        return;
      }
      for (const dependency of context.getModuleInfo(current)?.importedIds ?? []) {
        visit(dependency, current);
      }
    };
    visit(id, id);
    return [...hrefs];
  }
}

/** Replaces the manifest placeholder of a server chunk; `null` when the chunk has none. */
export function fillManifest(code: string, manifest: Record<string, string[]>): string | null {
  if (!PLACEHOLDER_LITERAL.test(code)) return null;
  return code.replace(PLACEHOLDER_LITERAL, () => JSON.stringify(JSON.stringify(manifest)));
}

/** `BookCard` for `/src/BookCard.stsx?lumiose&type=style&lang.css`, `app` for `app.css`. */
function assetName(id: string): string {
  const file = cleanId(id);
  const base = file.slice(file.lastIndexOf("/") + 1);
  const dot = base.indexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}
