// `.md` and `.html` imports as components (decision-22, TASK-69; owner: Halo, in Photon's plugin).
//
// - `import Post from "./post.md"` resolves to the Lumiose module `<file>.md.stsx` (`.html.stsx`
//   for HTML), whose source `contentSource` (lumiose_content) generates from the file: a static
//   component of its content, with its top-level `<style>` elements as file-level blocks. The
//   main plugin compiles it like any `.stsx` module, so styles (CSS modules, the build's CSS
//   manifest), islands and HMR work unchanged; its style load and the build scan read the source
//   through `Content.source` (index.ts, scan.ts). The file is a watch file of the module and of
//   its CSS module, so an edit updates both.
// - `./post.md?lumiose-frontmatter`: the YAML frontmatter as `export const frontmatter`, after the
//   optional `lumiose({ md: { frontmatter } })` hook. Values are written as JS data.
// - `./card.html?lumiose-script`: the file's client scripts, when it has any. The component
//   imports it as a client script (`./card.html?lumiose-script?client`, ./client-scripts.ts,
//   decision-71) and calls it when it renders, so the pages that render it load the scripts as a
//   module script, without the island runtime; client-rendered components (islands, SPA pages)
//   load them with the component's module. In the client environment the module imports the
//   scripts (inline ones as `?lumiose-script&index=N&lang.js`); on the server it is empty. An edit
//   to such a file reloads the page (scripts such as `customElements.define` cannot run twice).
// - HTML entries (the root `index.html`, HTML build inputs) and files in `public/` stay Vite's.
// - In dev, the browser only gets the modules of files inside `server.fs.allow`, or of files the
//   app imports (Vite's rule for the files it reads itself, TASK-498): other requests get a 403.

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { contentSource, type ContentSource, type Diagnostic } from "@lumiose/compiler";
import { normalizePath, type Environment, type Plugin, type ResolvedConfig } from "vite";
import { parse as parseYaml } from "yaml";
import { assertLoadingAllowed } from "./fs-access.ts";

/** `lumiose({ md })`: Markdown imports. */
export interface MarkdownOptions {
  /**
   * Validates or transforms each file's frontmatter at build time; the returned value is the
   * module's `frontmatter` export (`undefined` keeps `data`). Throwing fails the build with the
   * file's name. May be async.
   *
   * @example frontmatter: (data) => PostSchema.parse(data)
   */
  frontmatter?: (data: Record<string, unknown>, context: { file: string }) => unknown;
}

/** Validated `lumiose({ md, html })`. */
export interface ContentOptions {
  md: false | MarkdownOptions;
  html: boolean;
}

/** Validates `lumiose({ md, html })`. */
export function contentOptionsOf(md: unknown, html: unknown): ContentOptions {
  if (html !== undefined && typeof html !== "boolean") {
    throw new TypeError(`lumiose({ html }): expected true or false, got ${describe(html)}.`);
  }
  const options: ContentOptions = { md: false, html: html ?? false };
  if (md === undefined || md === false) return options;
  if (md === true) return { ...options, md: {} };
  if (!isObject(md)) {
    throw new TypeError(
      `lumiose({ md }): expected true, false or { frontmatter }, got ${describe(md)}.`,
    );
  }
  for (const [key, value] of Object.entries(md)) {
    if (key !== "frontmatter") {
      throw new TypeError(`lumiose({ md.${key} }): unknown option. Known options: frontmatter.`);
    }
    if (value !== undefined && typeof value !== "function") {
      throw new TypeError(
        `lumiose({ md.frontmatter }): expected a function, got ${describe(value)}.`,
      );
    }
  }
  return { ...options, md: md as MarkdownOptions };
}

type Kind = "md" | "html";

const MODULE = /\.(md|html)\.stsx$/;
/** A content module id with Vite's or the plugin's query (`?lumiose&type=style&lang.css`). */
const MODULE_REQUEST = /\.(?:md|html)\.stsx(?:\?.*)?$/;
const FRONTMATTER = /\?lumiose-frontmatter$/;
const SCRIPT = /\?lumiose-script(?:&index=(\d+)&lang\.js)?$/;
/** A `<script src>` as the scripts module imports it. */
const SCRIPT_SRC_QUERY = "?lumiose-script-src";
const SCRIPT_SRC = /\?lumiose-script-src$/;

/** The content pipeline, when `md` or `html` is enabled. */
export function contentOf(options: ContentOptions, exclude: RegExp): Content | null {
  return options.md || options.html ? new Content(options, exclude) : null;
}

export class Content {
  readonly #options: ContentOptions;
  readonly #exclude: RegExp;
  readonly #cache = new Map<string, { text: string; result: ContentSource }>();
  #root = process.cwd();
  /** HTML files Vite uses as entries (never components). */
  #entries = new Set<string>();
  /** Vite's public directory (`<dir>/`): static files, never components. */
  #publicDir: string | null = null;
  /**
   * Content files the app's modules import: the browser may load them outside `server.fs.allow`,
   * as Vite lets it load the modules that imports resolve to (a linked package's files).
   */
  readonly #imported = new Set<string>();
  /** Ids of the Lumiose modules of content files (`<file>.md.stsx`). */
  readonly moduleFilter: RegExp;

  constructor(options: ContentOptions, exclude: RegExp) {
    this.#options = options;
    this.#exclude = exclude;
    const kinds = [options.md && "md", options.html && "html"].filter(Boolean).join("|");
    this.moduleFilter = new RegExp(`\\.(?:${kinds})\\.stsx$`);
  }

  /** The content kind of a file, when that kind is enabled and the file is a component. */
  #kind(file: string): Kind | null {
    const kind = file.endsWith(".md") ? "md" : file.endsWith(".html") ? "html" : null;
    if (kind === null || !this.#options[kind] || this.#exclude.test(file)) return null;
    if (this.#publicDir !== null && file.startsWith(this.#publicDir)) return null;
    if (kind === "html" && this.#entries.has(file)) return null;
    return kind;
  }

  /** Whether `id` is the Lumiose module of a content file. */
  isModule(id: string): boolean {
    return this.moduleFilter.test(id) && this.#kind(sourceFile(id)) !== null;
  }

  /** The Lumiose module id of a content file: `<file>.stsx`. */
  moduleId(file: string): string {
    return `${file}.stsx`;
  }

  /** Whether the build scan compiles `file` (a content file that is not an HTML entry). */
  scans(file: string): boolean {
    return this.#kind(file) !== null;
  }

  /**
   * Throws Vite's 403 error when the dev server's browser requests a module of `file` (a content
   * file) outside `server.fs.allow` that no module imports (./fs-access.ts).
   */
  assertLoadingAllowed(environment: Environment, file: string): void {
    if (!this.#imported.has(file)) assertLoadingAllowed(environment, file);
  }

  /** The `.stsx` source of a content module (reads the file). */
  source(moduleId: string): string {
    return this.#convert(sourceFile(moduleId)).code;
  }

  #convert(file: string): ContentSource {
    const text = readFileSync(file, "utf8");
    const cached = this.#cache.get(file);
    if (cached?.text === text) return cached.result;
    const kind = this.#kind(file) ?? (file.endsWith(".md") ? "md" : "html");
    const result = contentSource(text, file, kind);
    this.#cache.set(file, { text, result });
    return result;
  }

  /** The plugin that resolves content imports and loads their modules. */
  plugin(): Plugin {
    // oxlint-disable-next-line typescript/no-this-alias -- the hooks' `this` is Vite's context
    const content = this;
    return {
      name: "lumiose:content",
      enforce: "pre",

      configResolved(config) {
        content.#root = config.root;
        content.#entries = htmlEntries(config);
        content.#publicDir = config.publicDir ? `${normalizePath(config.publicDir)}/` : null;
      },

      resolveId: {
        filter: { id: [/\.(?:md|html)$/, MODULE_REQUEST, SCRIPT_SRC] },
        async handler(id, importer, options) {
          if (SCRIPT_SRC.test(id)) {
            // A script runs for its side effects, whatever its package's `sideEffects` says.
            const target = id.slice(0, -SCRIPT_SRC_QUERY.length);
            const resolved = await this.resolve(target, importer, { ...options, skipSelf: true });
            if (resolved === null || resolved.external) return resolved;
            return { ...resolved, moduleSideEffects: true };
          }
          if (MODULE_REQUEST.test(id)) {
            // A module id (`/abs/post.md.stsx`) or a dev URL (`/src/post.md.stsx`), maybe with
            // a query (its CSS module).
            const query = id.indexOf("?");
            const [path, search] = query === -1 ? [id, ""] : [id.slice(0, query), id.slice(query)];
            for (const candidate of [path, normalizePath(resolve(content.#root, `.${path}`))]) {
              if (isAbsolute(candidate) && content.isModule(candidate)) {
                if (existsSync(sourceFile(candidate))) return candidate + search;
              }
            }
            return null;
          }
          if (options.isEntry || importer === undefined || importer.endsWith(".html")) {
            return null;
          }
          const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });
          if (resolved === null || resolved.external || content.#kind(resolved.id) === null) {
            return null;
          }
          content.#imported.add(resolved.id);
          return content.moduleId(resolved.id);
        },
      },

      load: {
        filter: { id: [MODULE, FRONTMATTER, SCRIPT] },
        async handler(id) {
          if (MODULE.test(id)) {
            if (!content.isModule(id)) return null;
            const file = sourceFile(id);
            content.assertLoadingAllowed(this.environment, file);
            this.addWatchFile(file);
            const result = content.#convert(file);
            // A `<script>` in Markdown (LUM1008): the file is its own error's location.
            const [first, ...rest] = result.diagnostics;
            if (first) {
              const text = readFileSync(file, "utf8");
              const more = rest.map((d) => `\n${message(d)}`).join("");
              return this.error({
                message: message(first) + more,
                id: file,
                loc: { file, ...lineColumn(text, first.span.start) },
              });
            }
            // Compiled by the main plugin's transform, like any `.stsx` module.
            return { code: result.code };
          }
          const file = id.replace(/\?.*$/, "");
          if (content.#kind(file) === null) return null;
          content.assertLoadingAllowed(this.environment, file);
          let result: ContentSource;
          try {
            result = content.#convert(file);
          } catch (error) {
            return this.error({ message: (error as Error).message, id: file });
          }
          if (FRONTMATTER.test(id)) {
            let data: unknown;
            try {
              data = await frontmatterOf(result.frontmatter, file, content.#options.md);
            } catch (error) {
              return this.error({ message: `frontmatter: ${(error as Error).message}`, id: file });
            }
            return { code: `export const frontmatter = ${data};\n`, moduleType: "js" };
          }
          const client = this.environment.config.consumer !== "server";
          const index = SCRIPT.exec(id)![1];
          // Scripts run for their side effects, whatever the package's `sideEffects` says.
          if (index !== undefined) {
            const inline = result.scripts.filter((script) => script.code != null);
            const code = client ? (inline[Number(index)]?.code ?? "") : "";
            return { code, moduleType: "js", moduleSideEffects: true };
          }
          return {
            code: scriptModule(result, file, client),
            moduleType: "js",
            moduleSideEffects: true,
          };
        },
      },

      hotUpdate({ file, modules }) {
        if (content.#kind(file) === null) return;
        if (
          this.environment.name === "client" &&
          modules.some((mod) => mod.id !== null && SCRIPT.test(mod.id))
        ) {
          this.environment.hot.send({ type: "full-reload" });
          return [];
        }
        // The file's Lumiose module and CSS module have another file (`<file>.stsx`): Vite only
        // invalidated the modules of the file itself (the frontmatter and script modules).
        const graph = this.environment.moduleGraph;
        const generated = [...(graph.getModulesByFile(content.moduleId(file)) ?? [])];
        for (const mod of generated) graph.invalidateModule(mod);
        return generated.length > 0 ? [...new Set([...modules, ...generated])] : undefined;
      },
    };
  }
}

function message(diagnostic: Diagnostic): string {
  let text = `${diagnostic.code}: ${diagnostic.message}`;
  if (diagnostic.help) text += `\nhelp: ${diagnostic.help}`;
  return text;
}

/** The 1-based line and 0-based column (Rollup's) of a byte offset in `text`. */
function lineColumn(text: string, offset: number): { line: number; column: number } {
  const before = Buffer.from(text).subarray(0, offset).toString("utf8");
  const lineStart = before.lastIndexOf("\n") + 1;
  return { line: before.split("\n").length, column: before.length - lineStart };
}

/** The file of a content module id (`<file>.md.stsx` → `<file>.md`). */
function sourceFile(id: string): string {
  return id.replace(/[?#].*$/, "").replace(/\.stsx$/, "");
}

/** HTML files Vite builds or serves as pages: the root `index.html` and HTML build inputs. */
function htmlEntries(config: ResolvedConfig): Set<string> {
  const entries = new Set([normalizePath(resolve(config.root, "index.html"))]);
  const build = config.build as {
    rolldownOptions?: { input?: unknown };
    rollupOptions?: { input?: unknown };
  };
  const input = build.rolldownOptions?.input ?? build.rollupOptions?.input;
  const inputs =
    typeof input === "string"
      ? [input]
      : Array.isArray(input)
        ? input
        : isObject(input)
          ? Object.values(input)
          : [];
  for (const entry of inputs) {
    if (typeof entry === "string" && entry.endsWith(".html")) {
      entries.add(normalizePath(resolve(config.root, entry)));
    }
  }
  return entries;
}

/** The module of a file's scripts: imports them in the client, empty on the server. */
function scriptModule(result: ContentSource, file: string, client: boolean): string {
  const name = file.slice(file.lastIndexOf("/") + 1);
  const imports: string[] = [];
  let inline = 0;
  for (const script of client ? result.scripts : []) {
    const specifier =
      script.src != null
        ? relativeSpecifier(script.src) + SCRIPT_SRC_QUERY
        : `./${name}?lumiose-script&index=${inline++}&lang.js`;
    imports.push(`import ${JSON.stringify(specifier)};\n`);
  }
  return imports.join("") || "export {};\n";
}

/** A `<script src>` as an import: relative URLs (`x.js`) are relative to the file. */
function relativeSpecifier(src: string): string {
  const trimmed = src.trim();
  return /^(?:[a-z][a-z\d+.-]*:|\/|\.\.?\/)/i.test(trimmed) ? trimmed : `./${trimmed}`;
}

/** The `frontmatter` export of a Markdown file, as JS source. */
async function frontmatterOf(
  yaml: string | null | undefined,
  file: string,
  md: false | MarkdownOptions,
): Promise<string> {
  let data: unknown = yaml == null ? {} : (parseYaml(yaml) ?? {});
  if (!isObject(data)) {
    throw new TypeError(`expected a mapping of keys to values, got ${describe(data)}`);
  }
  const hook = md ? md.frontmatter : undefined;
  if (hook) {
    const returned = await hook(data, { file });
    if (returned !== undefined) data = returned;
  }
  return toJs(data, "frontmatter");
}

/** `value` as a JS expression: JSON-like data plus `undefined`, `Date`, `URL`, `Map`, `Set`… */
export function toJs(value: unknown, path: string): string {
  switch (typeof value) {
    case "undefined":
      return "undefined";
    case "boolean":
      return String(value);
    case "number":
      return Object.is(value, -0) ? "-0" : String(value);
    case "bigint":
      return `${value}n`;
    case "string":
      return JSON.stringify(value);
  }
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((item, i) => toJs(item, `${path}[${i}]`)).join(", ")}]`;
  }
  if (value instanceof Date) return `new Date(${JSON.stringify(value.toISOString())})`;
  if (value instanceof URL) return `new URL(${JSON.stringify(value.href)})`;
  if (value instanceof RegExp)
    return `new RegExp(${JSON.stringify(value.source)}, ${JSON.stringify(value.flags)})`;
  if (value instanceof Map) {
    const entries = [...value].map(
      ([k, v], i) => `[${toJs(k, `${path}.key(${i})`)}, ${toJs(v, `${path}.get(${i})`)}]`,
    );
    return `new Map([${entries.join(", ")}])`;
  }
  if (value instanceof Set) {
    return `new Set([${[...value].map((item, i) => toJs(item, `${path}[${i}]`)).join(", ")}])`;
  }
  const prototype = Object.getPrototypeOf(value);
  if (typeof value === "object" && (prototype === Object.prototype || prototype === null)) {
    // A `"__proto__": …` entry of an object literal would set its prototype: a computed key
    // makes it an own property, as YAML and JSON.parse do.
    const entries = Object.entries(value).map(
      ([key, item]) =>
        `${key === "__proto__" ? `["__proto__"]` : JSON.stringify(key)}: ${toJs(item, `${path}.${key}`)}`,
    );
    return `{${entries.join(", ")}}`;
  }
  throw new TypeError(
    `${path} cannot be exported (${typeof value === "object" ? (prototype?.constructor?.name ?? "an object") : `a ${typeof value}`}); use JSON-like data, Date, URL, Map or Set`,
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "an array";
  if (typeof value === "function") return "a function";
  if (value === null || typeof value !== "object") return String(value);
  return "an object";
}
