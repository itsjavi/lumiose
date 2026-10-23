// Client scripts of server-rendered components (decision-63, TASK-354; the renderer's side is
// lumiose/src/server/client-script.ts). A component imports a module that must run in the browser
// on the pages that render the component, without the island runtime, such as the definition of a
// custom element it renders, with the `?client` query, and calls the import when it renders:
//
//   import defineMenu from "./menu.element.ts?client";
//   export function MenuRoot(props) { defineMenu(); return <lu-menu>…</lu-menu>; }
//
// - Client environments: the `?client` module imports the module, so it runs wherever the component's
//   client code does (islands, SPA pages), and exports a function that does nothing. When the
//   importer only calls the import conditionally (`if (openOnHover) hoverScript()`: never as a
//   statement of its own in a function's body or at the top level, see `conditionalClientScripts`),
//   its `?client` module instead imports the module the first time the function is called, as
//   server pages load it, so an island that never makes the call never loads it (TASK-551).
// - Server environments: the `?client` module exports a function that records the module's client URL,
//   and the chunks it imports, for the page being rendered (`clientScript()`): the page loads it
//   once, as a module script. The module itself never runs on the server.
// - Builds: the server graph does not exist yet when the client is built, so the client build
//   builds every module that a `?client` import of the one-time scan names (./scan.ts) as an entry,
//   and the server build embeds its URL. In the Lumiose packages, only the imports of the modules
//   that the project's modules can run count (./reachable.ts, TASK-542): the server build gives the
//   others a stub that records nothing. An import the scan did not see is a warning, and records
//   nothing; a page that renders its component then warns which script it goes without (TASK-463).
// - Dev: the URL is the module's own (root-relative, or `/@fs/` outside the root), with the
//   `import` query when it is not JavaScript by its extension (an `.html` file's scripts).

import { basename, dirname, relative, resolve as resolvePath } from "node:path";
import type { PackageRoot } from "@lumiose/compiler";
import { normalizePath, parseAst, type Plugin, type ResolvedConfig, type Rollup } from "vite";
import { resolvesByEnvironment } from "./packages.ts";
import { reachedPackageModules } from "./reachable.ts";
import { runtimeFile } from "./runtime-files.ts";
import type { ScannedModule } from "./scan.ts";

export const CLIENT_SCRIPT_QUERY = "?client";
const PREFIX = "\0lumiose:client-script:";
/** A client environment's `?client` module that imports its module when first called. */
const LAZY_PREFIX = "\0lumiose:client-script-lazy:";
const MARKER = /\?client$/;
const MARKER_ID = /^\0lumiose:client-script(?:-lazy)?:/;
/** Modules that may import client scripts, as JavaScript by the time a normal plugin sees them. */
const SCRIPT_MODULE = /\.(?:[cm]?[jt]sx?|stsx)$/;

export interface ClientScriptsOptions {
  /** `lumiose dev` (or any Vite dev server). */
  serve: () => boolean;
  /** The one-time scan of the project's modules. */
  scan: () => readonly ScannedModule[];
  /** Whether the build has a server environment (a client-only build records nothing). */
  hasServerBuild: (config: ResolvedConfig) => boolean;
  /** The project's Lumiose packages (./packages.ts). */
  packages: () => readonly PackageRoot[];
}

/** A client script as the client build wrote it: its URL and those of the chunks it imports. */
interface Built {
  url: string;
  preloads: string[];
}

export function clientScriptsPlugin(options: ClientScriptsOptions): Plugin[] {
  /** Files the client build builds as entries. */
  const emitted = new Set<string>();
  /** Client scripts of package modules that the project's modules cannot run: not built. */
  const unused = new Set<string>();
  const built = new Map<string, Built>();
  const warned = new Set<string>();
  /** Files that `?client` modules of a client environment import. */
  const scripts = new Set<string>();
  /** Client environments: module id → the `?client` specifiers it only calls conditionally. */
  const conditional = new Map<string, Set<string>>();

  const plugin: Plugin = {
    name: "lumiose:client-scripts",
    // Before Vite's resolver, which would resolve `x.ts?client` to the module with a query.
    enforce: "pre",
    // The client build's URLs, for the server build.
    sharedDuringBuild: true,

    resolveId: {
      filter: { id: MARKER },
      async handler(source, importer) {
        const resolved = await this.resolve(
          source.slice(0, -CLIENT_SCRIPT_QUERY.length),
          importer,
          {
            skipSelf: true,
          },
        );
        if (resolved === null || resolved.external) return null;
        const lazy =
          this.environment.config.consumer === "client" &&
          importer !== undefined &&
          conditional.get(importer)?.has(source) === true;
        return (lazy ? LAZY_PREFIX : PREFIX) + resolved.id;
      },
    },

    load: {
      filter: { id: MARKER_ID },
      handler(id) {
        const lazy = id.startsWith(LAZY_PREFIX);
        const file = id.slice((lazy ? LAZY_PREFIX : PREFIX).length);
        const config = this.environment.config;
        if (config.consumer === "client") {
          scripts.add(file);
          if (lazy) {
            // The first call imports it; the page may have loaded it already (the same chunk).
            return `let loading;
export default function clientScript() {
  if (loading === undefined) loading = import(${JSON.stringify(file)});
}
`;
          }
          return `import ${JSON.stringify(file)};\nexport default function clientScript() {}\n`;
        }
        let script: Built | undefined;
        if (options.serve()) {
          script = { url: devUrl(file, config), preloads: [] };
        } else {
          script = built.get(file);
          if (script === undefined && !warned.has(file) && !unused.has(file)) {
            warned.add(file);
            this.warn(
              `${normalizePath(relative(config.root, file))} is a client script (${CLIENT_SCRIPT_QUERY}), but the client build did not build it: the module that imports it is outside the project and its Lumiose packages. Pages that render it do not load it.`,
            );
          }
        }
        if (script === undefined) {
          // Rendering the component says which page goes without the script (TASK-463).
          return `import { missingClientScript } from ${JSON.stringify(runtimeFile("app/server/missing-client-script.ts"))};
export default function clientScript() {
  missingClientScript(${JSON.stringify(normalizePath(relative(config.root, file)))});
}
`;
        }
        return `import { clientScript as record } from ${JSON.stringify(runtimeFile("server/client-script.ts"))};
export default function clientScript() {
  record(${JSON.stringify(script.url)}, ${JSON.stringify(script.preloads)});
}
`;
      },
    },

    // A script runs for its side effects, whatever its package's `sideEffects` says: islands and
    // SPA pages keep importing it.
    transform: {
      filter: { id: /\.[cm]?[jt]sx?$/ },
      handler(code, id) {
        if (options.serve() || !(emitted.has(id) || scripts.has(id))) return null;
        return { code, map: null, moduleSideEffects: true };
      },
    },

    async buildStart() {
      const environment = this.environment;
      if (options.serve() || environment.config.consumer !== "client") return;
      if (!options.hasServerBuild(environment.getTopLevelConfig())) return;
      emitted.clear();
      unused.clear();
      built.clear();
      warned.clear();
      const modules = options.scan();
      const reached = await reachedFromProject(this, modules, options.packages());
      for (const module of modules) {
        const runs = module.package === undefined || reached === null || reached.has(module.file);
        for (const specifier of module.clientScripts ?? []) {
          const target = specifier.slice(0, -CLIENT_SCRIPT_QUERY.length);
          const resolved = await this.resolve(target, module.file);
          if (resolved !== null && !resolved.external) (runs ? emitted : unused).add(resolved.id);
        }
      }
      for (const id of emitted) unused.delete(id);
      for (const id of [...emitted].toSorted()) {
        this.emitFile({ type: "chunk", id, name: chunkName(id), preserveSignature: false });
      }
    },

    generateBundle(_, bundle) {
      const config = this.environment.config;
      if (options.serve() || config.consumer !== "client" || emitted.size === 0) return;
      const chunks = new Map<string, Rollup.OutputChunk>();
      for (const file of Object.values(bundle)) {
        if (file.type === "chunk") chunks.set(file.fileName, file);
      }
      for (const entry of chunks.values()) {
        const id = entry.facadeModuleId;
        if (!entry.isEntry || id === null || !emitted.has(id)) continue;
        // When islands or SPA pages import the module too, Rolldown puts it in a chunk they share,
        // and the entry is a facade that only imports that chunk: pages load the chunk itself, the
        // file islands import, and the facade is not written, unless client code that calls the
        // script conditionally imports it with `import()`.
        let chunk = entry;
        for (const other of chunks.values()) {
          if (other !== entry && other.moduleIds.includes(id)) chunk = other;
        }
        const lazy = [...chunks.values()].some((other) =>
          other.dynamicImports.includes(entry.fileName),
        );
        if (chunk !== entry && !lazy) {
          delete bundle[entry.fileName];
          chunks.delete(entry.fileName);
        }
        // The chunks it imports, which the page modulepreloads with it.
        const preloads = new Set<string>();
        const visit = (name: string): void => {
          if (preloads.has(name) || name === chunk.fileName) return;
          preloads.add(name);
          for (const imported of chunks.get(name)?.imports ?? []) visit(imported);
        };
        for (const imported of chunk.imports) visit(imported);
        built.set(id, {
          url: config.base + chunk.fileName,
          preloads: [...preloads].map((name) => config.base + name),
        });
      }
    },
  };

  // Which client scripts a client module only calls conditionally, read from its JavaScript: a
  // normal plugin, so it runs after the Lumiose compile and TypeScript, and before the module's
  // imports are resolved (by Rolldown, or by Vite's import analysis in dev).
  const calls: Plugin = {
    name: "lumiose:client-script-calls",
    sharedDuringBuild: true,
    transform: {
      filter: { id: SCRIPT_MODULE, code: CLIENT_SCRIPT_QUERY },
      handler(code, id) {
        if (this.environment.config.consumer !== "client") return null;
        let found: string[];
        try {
          found = conditionalClientScripts(parseAst(code, { lang: langOf(id) }));
        } catch {
          // Not JavaScript this plugin can read: its client scripts load with it.
          found = [];
        }
        if (found.length > 0) conditional.set(id, new Set(found));
        else conditional.delete(id);
        return null;
      },
    },
  };

  return [plugin, calls];
}

function langOf(id: string): "ts" | "tsx" | "jsx" {
  const path = id.replace(/[?#].*$/, "");
  if (/\.[cm]?ts$/.test(path)) return "ts";
  return path.endsWith(".tsx") ? "tsx" : "jsx";
}

interface Node {
  type: string;
  [key: string]: any;
}

const FUNCTION = /^(?:FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/;

/**
 * The `?client` specifiers whose default import `program` only calls conditionally, so its client
 * code can load them on the first call (TASK-551). A call is unconditional when it is a statement
 * of its own at the top level, or in the body of a function (a component: `defineMenu();`); any
 * other call (under an `if`, in `a && f()` or `(f(), x)`) is conditional. A script whose import is
 * used otherwise (passed on, re-exported), or imported without a default binding, is not
 * conditional: it loads with the module, as when its calls cannot be told apart.
 */
export function conditionalClientScripts(program: {
  type: string;
  body: readonly Node[];
}): string[] {
  /** Local name → specifier. */
  const locals = new Map<string, string>();
  const eager = new Set<string>();
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration") continue;
    const specifier = statement.source.value as string;
    if (!specifier.endsWith(CLIENT_SCRIPT_QUERY)) continue;
    for (const imported of statement.specifiers as Node[]) {
      if (imported.type === "ImportDefaultSpecifier") locals.set(imported.local.name, specifier);
      else eager.add(specifier);
    }
    if (statement.specifiers.length === 0) eager.add(specifier);
  }
  if (locals.size === 0) return [];

  /** The nodes from the program down to the one being visited. */
  const path: Node[] = [];
  const visit = (node: Node): void => {
    if (node.type === "ImportDeclaration") return;
    if (node.type === "Identifier" && locals.has(node.name) && isReference(node, path.at(-1))) {
      if (!isConditionalCall(node, path)) eager.add(locals.get(node.name)!);
      return;
    }
    path.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const item of value) if (isNode(item)) visit(item);
      } else if (isNode(value)) visit(value);
    }
    path.pop();
  };
  visit(program);
  return [...new Set(locals.values())].filter((specifier) => !eager.has(specifier));
}

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && typeof (value as Node).type === "string";
}

/** Whether `node` reads a binding: not a property name (`a.name`, `{ name: 1 }`). */
function isReference(node: Node, parent: Node | undefined): boolean {
  if (parent === undefined) return true;
  if (parent.type === "MemberExpression") return parent.computed || parent.property !== node;
  if (/^(?:Property|MethodDefinition|PropertyDefinition)$/.test(parent.type)) {
    return parent.computed || parent.key !== node || parent.value === node;
  }
  return true;
}

/** Whether `callee` (an import's local name) is called, and not as a statement of its own. */
function isConditionalCall(callee: Node, path: readonly Node[]): boolean {
  const [container, statement, call] = path.slice(-3);
  if (call?.type !== "CallExpression" || call.callee !== callee) return false;
  const own =
    statement?.type === "ExpressionStatement" &&
    (container?.type === "Program" ||
      (container?.type === "BlockStatement" && FUNCTION.test(path.at(-4)?.type ?? "")));
  return !own;
}

/** `lumiose`'s own modules and Node's: no package components there. */
const NOT_A_COMPONENT_MODULE = /^(?:lumiose(?:\/|$)|node:)/;
const SOURCE_MODULE = /(?<!\.d)\.(?:[cm]?[jt]sx?|stsx)$/;

/** Whether `file` is below `dir`, and not in a `node_modules` there. */
function inside(file: string, dir: string): boolean {
  return file.startsWith(`${dir}/`) && !file.slice(dir.length).includes("/node_modules/");
}

/**
 * The package modules the project's modules can run (./reachable.ts), or `null` for all of them:
 * when no package module has client scripts, or when that cannot be told.
 *
 * The client build resolves imports as the browser does, but pages render with the server's
 * modules: a package that may resolve differently on the server (`exports` conditions, a `browser`
 * field) counts whole.
 */
async function reachedFromProject(
  context: Rollup.PluginContext,
  modules: readonly ScannedModule[],
  packages: readonly PackageRoot[],
): Promise<Set<string> | null> {
  if (!modules.some((module) => module.package !== undefined && module.clientScripts)) return null;
  const root = normalizePath(context.environment.config.root);
  const reached = await reachedPackageModules(modules, {
    async resolve(specifier, importer) {
      if (NOT_A_COMPONENT_MODULE.test(specifier)) return null;
      // A relative import of a project module: the project's modules all run.
      if (
        specifier.startsWith(".") &&
        inside(normalizePath(resolvePath(dirname(importer), specifier)), root)
      ) {
        return null;
      }
      const resolved = await context.resolve(specifier, importer);
      return resolved === null || resolved.external ? null : resolved.id;
    },
    isPackageSource: (id) =>
      SOURCE_MODULE.test(id) &&
      !id.startsWith("\0") &&
      !id.includes("?") &&
      packages.some((p) => inside(id, p.dir)),
  });
  if (reached === null) return null;
  const whole = new Set(packages.filter((p) => resolvesByEnvironment(p.dir)).map((p) => p.name));
  for (const module of modules) {
    if (module.package !== undefined && whole.has(module.package)) reached.add(module.file);
  }
  return reached;
}

/** The URL the dev server serves `file` at, as client code imports it. */
function devUrl(file: string, config: ResolvedConfig): string {
  const path = normalizePath(relative(config.root, file));
  const url =
    !path.startsWith("../") && !/^[a-z]:/i.test(path)
      ? config.base + path
      : `${config.base}@fs/${normalizePath(file).replace(/^\//, "")}`;
  return explicitImport(url);
}

/** Vite's known JavaScript extensions (its `isJSRequest()`). */
const JS_REQUEST = /\.(?:[jt]sx?|m[jt]s|vue|marko|svelte|astro|imba|mdx)$/;

/**
 * Adds the `import` query to the URL of a module that is not JavaScript by its extension, such as
 * the scripts of an `.html` file (`card.html?lumiose-script`, ./content.ts), as Vite's import
 * analysis does for client imports: the dev server only transforms such URLs with it, and the page
 * and client code (islands, SPA pages) load the same URL, so the module runs once.
 */
function explicitImport(url: string): string {
  const query = url.indexOf("?");
  const path = query === -1 ? url : url.slice(0, query);
  const file = path.slice(path.lastIndexOf("/") + 1);
  if (JS_REQUEST.test(path) || !file.includes(".")) return url;
  return query === -1 ? `${path}?import` : `${path}?import&${url.slice(query + 1)}`;
}

/** `menu.element.ts` → `menu.element`. */
function chunkName(id: string): string {
  const name = basename(id);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}
