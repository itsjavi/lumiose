// LUM4003 (spec §7.2, TASK-116): server-only modules never enter a client graph. A `*.server.*`
// file or a file under `src/server/` of the project (the compiler's rule, module_id.rs) may hold
// secrets; when the client environment reaches one (an island, an SPA route, a client entry or
// anything they import), `lumen build` fails and `lumen dev` reports the error, with the chain of
// importers from the client entry.
//
// - Build: at `buildEnd` of the client environment, every module of the graph is known with its
//   importers.
// - Dev: the client environment loads modules as the browser asks for them; the importers of a
//   module are in the module graph by the time it is requested.
//
// Stylesheets are not code: the CSS of a `.server.stsx` file is built in the client environment
// (./css-manifest.ts) and is allowed.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { Plugin, Rollup } from "vite";
import { cleanId, STYLE_QUERY } from "./styles.ts";

export const SERVER_ONLY_CODE = "LUM4003";

const NODE_MODULES = /[\\/]node_modules[\\/]/;
/** Stylesheets (Vite's `CSS_LANGS_RE`, on the file without its query), without loading Vite. */
const CSS_FILE = /\.(?:css|less|sass|scss|styl|stylus|pcss|postcss|sss)$/;

const posix = (path: string): string => path.replaceAll("\\", "/");

const realpaths = new Map<string, string>();

/** The real path of a file (symlinks resolved); the path itself when it does not exist. */
function real(path: string): string {
  let out = realpaths.get(path);
  if (out === undefined) {
    try {
      out = posix(realpathSync.native(path));
    } catch {
      out = posix(path);
    }
    realpaths.set(path, out);
  }
  return out;
}

const packageDirs = new Map<string, string | null>();

/**
 * The directory server-only paths are relative to for a file outside the project root: its
 * nearest package (a linked workspace package, a sibling folder), or `null` for `lumen` itself,
 * whose browser entry legitimately uses `src/server/` helpers.
 */
function packageDir(file: string): string | null {
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    let found = packageDirs.get(dir);
    if (found === undefined) {
      const manifest = join(dir, "package.json");
      if (existsSync(manifest)) {
        let name: unknown;
        try {
          name = (JSON.parse(readFileSync(manifest, "utf8")) as { name?: unknown }).name;
        } catch {
          name = undefined;
        }
        found = name === "lumen" ? null : posix(dir);
        packageDirs.set(dir, found);
      }
    }
    if (found !== undefined) return found;
    if (dirname(dir) === dir) return null;
  }
}

/**
 * Whether a module id names server-only code (spec §7.2): a `*.server.*` file or a file under
 * `src/server/`, of the project at `root` or of a package outside it that is not a dependency in
 * `node_modules` (TASK-170). Ids are matched by their real path (symlinks) and case-insensitively
 * (case-insensitive file systems); queries do not hide them (`?raw`, `?url`), but stylesheets,
 * including a `.server.stsx` file's style module, are not code.
 */
export function isServerOnly(id: string, root: string): boolean {
  if (id.startsWith("\0") || STYLE_QUERY.test(id)) return false;
  const clean = cleanId(id);
  if (CSS_FILE.test(clean)) return false;
  const file = real(clean);
  if (NODE_MODULES.test(file)) return false;
  let rest = posix(relative(real(root), file));
  if (rest.startsWith("../") || /^[a-zA-Z]:/.test(rest) || rest.startsWith("/")) {
    const base = packageDir(file);
    if (base === null) return false;
    rest = posix(relative(base, file));
  }
  rest = rest.toLowerCase();
  const name = rest.slice(rest.lastIndexOf("/") + 1);
  return name.split(".").slice(1).includes("server") || rest.startsWith("src/server/");
}

/** The LUM4003 message: the server-only module and the chain of importers that reach it. */
export function serverOnlyMessage(chain: readonly string[], root: string): string {
  const shown = chain.map((id) => relative(root, cleanId(id)).replaceAll("\\", "/"));
  const module = shown.at(-1)!;
  return (
    `${SERVER_ONLY_CODE}: ${module} is server-only, but client code imports it:\n` +
    shown.map((id, i) => `  ${i === 0 ? "" : "→ "}${id}`).join("\n") +
    `\nhelp: keep server code on the server: call it through an endpoint or a form action ` +
    `(fetchJSON, submit()) from the client. Server-only: *.server.* files and src/server/.`
  );
}

/** The importer chain from an entry down to `id`, following the first importer of each module. */
export function importerChain(id: string, importers: (id: string) => readonly string[]): string[] {
  const chain = [id];
  const seen = new Set(chain);
  for (let current = id; ;) {
    const next = importers(current).find((importer) => !seen.has(importer));
    if (next === undefined) return chain.toReversed();
    chain.push(next);
    seen.add(next);
    current = next;
  }
}

/** `new URL("./file", import.meta.url)`: Vite emits the file as an asset of the client build. */
const URL_REFERENCE = /\bnew\s+URL\s*\(\s*(["'`])([^"'`$]+)\1\s*,\s*import\.meta\.url\s*\)/g;
const SCRIPT = /\.(?:[cm]?[jt]sx?|stsx)(?:$|\?)/;

/**
 * The LUM4003 checks of client graphs. `worker`: the plugin of `worker.plugins`, whose bundles are
 * client code whatever their environment.
 */
export function serverOnlyPlugin(options: { worker?: boolean } = {}): Plugin {
  const client = (environment: { config: { consumer: string } }) =>
    options.worker === true || environment.config.consumer === "client";
  return {
    name: options.worker ? "lumen:server-only-worker" : "lumen:server-only",
    enforce: "pre",
    load: {
      handler(id) {
        const environment = this.environment;
        if (environment.mode !== "dev" || !client(environment)) return null;
        const root = environment.config.root;
        if (!isServerOnly(id, root)) return null;
        const graph = environment.moduleGraph;
        const chain = importerChain(id, (current) =>
          [...(graph.getModuleById(current)?.importers ?? [])].flatMap((mod) =>
            mod.id === null ? [] : [mod.id],
          ),
        );
        this.error({ message: serverOnlyMessage(chain, root), id });
      },
    },
    transform: {
      filter: { id: SCRIPT, code: "import.meta.url" },
      handler(code, id) {
        const environment = this.environment;
        if (!client(environment)) return null;
        const root = environment.config.root;
        for (const match of code.matchAll(URL_REFERENCE)) {
          const specifier = match[2]!;
          if (!/^\.{0,2}\//.test(specifier)) continue;
          const target = specifier.startsWith("/")
            ? join(root, specifier)
            : resolve(dirname(cleanId(id)), specifier);
          if (isServerOnly(target, root)) {
            this.error({
              message: serverOnlyMessage([id, target], root).replace(
                "client code imports it",
                `client code references it with new URL(${JSON.stringify(specifier)}, import.meta.url)`,
              ),
              id,
            });
          }
        }
        return null;
      },
    },
    buildEnd(error) {
      const environment = this.environment;
      if (error || environment.mode !== "build" || !client(environment)) return;
      const root = environment.config.root;
      const offenders = [...this.getModuleIds()].filter((id) => isServerOnly(id, root));
      if (offenders.length === 0) return;
      const importers = (id: string): readonly string[] => {
        const info: Rollup.ModuleInfo | null = this.getModuleInfo(id);
        return info === null ? [] : [...info.importers, ...info.dynamicImporters];
      };
      const messages = offenders.map((id) => serverOnlyMessage(importerChain(id, importers), root));
      this.error({ message: messages.join("\n\n"), id: offenders[0] });
    },
    // Backstop: an asset of the client build made from a server-only file (whatever emitted it).
    generateBundle(_, bundle) {
      const environment = this.environment;
      if (!client(environment)) return;
      const root = environment.config.root;
      for (const output of Object.values(bundle)) {
        if (output.type !== "asset") continue;
        const source = output.originalFileNames.find((name) =>
          isServerOnly(
            name.startsWith("/") || /^[a-zA-Z]:/.test(name) ? name : join(root, name),
            root,
          ),
        );
        if (source !== undefined) {
          this.error(
            `${SERVER_ONLY_CODE}: ${source} is server-only, but the client build emits it as the asset ` +
              `${output.fileName}.\nhelp: keep server code on the server; reference it only from server modules.`,
          );
        }
      }
    },
  };
}
