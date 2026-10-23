// Which modules of the Lumiose packages the project's own modules can run (TASK-542). The client
// build builds the client scripts (./client-scripts.ts) of those alone: an app that renders one
// component of @lumiose/ui does not ship the scripts of the other 28.
//
// The server graph, which knows, is built after the client, so the one-time scan (./scan.ts)
// records each module's imports and exports, and this follows them from every module of the
// project, by name: `import { Menu } from "@lumiose/ui"` reaches the index, which only re-exports
// `Menu` from ./menu/menu.tsx, so only menu.tsx runs. A module that runs runs all its imports.
//
// It errs on the side of building too much: a module whose code runs builds all its client
// scripts, whichever of its exports the project uses. When it cannot tell, it gives up (`null`)
// and the client build builds every script, as before:
//
// - a module of a package has an `import()` whose specifier is not a string, or
//   `import.meta.glob()`: it could load any module of its package (the project's own modules run
//   anyway, and Vite can only bundle relative patterns);
// - a module that runs could not be parsed;
// - an import resolves to a source module of a package that the scan did not read.
//
// Modules outside the scan (other dependencies, assets, virtual modules) import no package's
// components: a package that renders Lumiose components depends on `lumiose`, so it is one of the
// Lumiose packages (./packages.ts), and the scan reads it.

import { parseSync } from "vite";
import type { ScannedModule } from "./scan.ts";

/** A module's imports and exports, as the scan records them. */
export interface ModuleLinks {
  /** Static imports. */
  imports: readonly LinkImport[];
  /** `export … from` statements. */
  reexports: readonly LinkReexport[];
  /** The names the module exports from its own code (`default` included). */
  exports: readonly string[];
  /** Specifiers of `import()` with a string specifier. */
  dynamic: readonly string[];
  /** It has an `import()` of a computed specifier, or `import.meta.glob()`. */
  unknownImports: boolean;
}

export interface LinkImport {
  specifier: string;
  /** The names imported (`default`, `*` for a namespace); none for `import "x"`. */
  names: readonly string[];
}

export interface LinkReexport {
  specifier: string;
  /** The exported name; `*` for `export * from`. */
  exported: string;
  /** The name it re-exports; `*` for `export *` and `export * as x`. */
  imported: string;
}

/** Specifiers handled elsewhere: client scripts (`?client`), which never run on the server. */
const SKIPPED_SPECIFIER = /\?client$/;
const GLOB = /\bimport\.meta\.glob\b/;
const STRING = /^(?:"([^"\\]*)"|'([^'\\]*)'|`([^`\\$]*)`)$/;

/**
 * The imports and exports of `code` (JavaScript, or TypeScript when `lang` says so), or `null` when
 * it does not parse. Type-only imports and exports are left out.
 */
export function moduleLinks(
  code: string,
  file: string,
  lang: "js" | "jsx" | "ts" | "tsx",
): ModuleLinks | null {
  const result = parseSync(file, code, { lang, sourceType: "module" });
  if (result.errors.some((error) => error.severity === "Error")) return null;
  const { staticImports, staticExports, dynamicImports } = result.module;
  const imports: LinkImport[] = [];
  for (const statement of staticImports) {
    const specifier = statement.moduleRequest.value;
    if (SKIPPED_SPECIFIER.test(specifier)) continue;
    // `import type { A }` and `import { type A }` alike: TypeScript drops the statement.
    if (statement.entries.length > 0 && statement.entries.every((entry) => entry.isType)) continue;
    const names = statement.entries
      .filter((entry) => !entry.isType)
      .map((entry) =>
        entry.importName.kind === "NamespaceObject"
          ? "*"
          : entry.importName.kind === "Default"
            ? "default"
            : entry.importName.name!,
      );
    imports.push({ specifier, names });
  }
  const reexports: LinkReexport[] = [];
  const exports: string[] = [];
  for (const statement of staticExports) {
    for (const entry of statement.entries) {
      if (entry.isType) continue;
      const exported =
        entry.exportName.kind === "Name"
          ? entry.exportName.name!
          : entry.exportName.kind === "Default"
            ? "default"
            : "*";
      if (entry.moduleRequest === null) {
        exports.push(exported);
        continue;
      }
      const imported = entry.importName.kind === "Name" ? entry.importName.name! : "*";
      reexports.push({ specifier: entry.moduleRequest.value, exported, imported });
    }
  }
  const dynamic: string[] = [];
  let unknownImports = GLOB.test(code);
  for (const call of dynamicImports) {
    const match = STRING.exec(code.slice(call.moduleRequest.start, call.moduleRequest.end).trim());
    const specifier = match === null ? undefined : (match[1] ?? match[2] ?? match[3]);
    if (specifier === undefined) unknownImports = true;
    else if (!SKIPPED_SPECIFIER.test(specifier)) dynamic.push(specifier);
  }
  return { imports, reexports, exports, dynamic, unknownImports };
}

export interface ReachOptions {
  /** Resolves `specifier`, imported by `importer`, to a module id; `null` when unresolved. */
  resolve(specifier: string, importer: string): Promise<string | null>;
  /** Whether `id` is a source module of a Lumiose package, which the scan reads. */
  isPackageSource(id: string): boolean;
}

/**
 * The modules of Lumiose packages (`ScannedModule.package`) whose code the project's modules can
 * run, or `null` when that cannot be told (see the top of the file).
 */
export async function reachedPackageModules(
  modules: readonly ScannedModule[],
  options: ReachOptions,
): Promise<Set<string> | null> {
  const byFile = new Map(modules.map((module) => [module.file, module]));
  /** Modules whose code runs. */
  const running = new Set<string>();
  /** The names asked of each module (`*`: all of them). */
  const asked = new Map<string, Set<string>>();
  /**
   * Module and name to visit: `null` runs its code (`import "x"`), `*` asks for every export. A
   * name found through `export *` is not looked for in the module's code when the module does not
   * export it (`viaStar`): other modules of the `export *` do.
   */
  const queue: { file: string; name: string | null; viaStar: boolean }[] = [];
  for (const module of modules) {
    if (module.package === undefined) queue.push({ file: module.file, name: "*", viaStar: false });
  }

  const resolved = new Map<string, Promise<string | null>>();
  let unscanned = false;
  /** Queues `name` of the module `specifier` names, unless the scan did not read it. */
  const ask = async (
    importer: string,
    specifier: string,
    name: string | null,
    viaStar = false,
  ): Promise<void> => {
    const key = `${importer}\0${specifier}`;
    let id = resolved.get(key);
    if (id === undefined) resolved.set(key, (id = options.resolve(specifier, importer)));
    const file = await id;
    if (file === null) return;
    if (byFile.has(file)) queue.push({ file, name, viaStar });
    else if (options.isPackageSource(file)) unscanned = true;
  };

  /** Runs a module's code: its client scripts are built, and its imports run. */
  const run = async (module: ScannedModule): Promise<boolean> => {
    if (running.has(module.file)) return true;
    running.add(module.file);
    const links = module.links;
    if (links === null || (links.unknownImports && module.package !== undefined)) return false;
    for (const link of links.imports) {
      if (link.names.length === 0) await ask(module.file, link.specifier, null);
      for (const name of link.names) await ask(module.file, link.specifier, name);
    }
    for (const specifier of links.dynamic) await ask(module.file, specifier, "*");
    return true;
  };

  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    const module = byFile.get(next.file)!;
    const { name } = next;
    if (name === null) {
      if (!(await run(module))) return null;
      continue;
    }
    let names = asked.get(module.file);
    if (names === undefined) asked.set(module.file, (names = new Set()));
    if (names.has("*") || names.has(name)) continue;
    names.add(name);
    const links = module.links;
    if (links === null) return null;
    if (name === "*") {
      if (!(await run(module))) return null;
      for (const reexport of links.reexports) {
        await ask(module.file, reexport.specifier, reexport.imported);
      }
      continue;
    }
    const named = links.reexports.filter((reexport) => reexport.exported === name);
    if (named.length > 0) {
      for (const reexport of named) await ask(module.file, reexport.specifier, reexport.imported);
      continue;
    }
    const stars = links.reexports.filter((reexport) => reexport.exported === "*");
    if (links.exports.includes(name) || (stars.length === 0 && !next.viaStar)) {
      // Its own export, or one this could not find: its code runs.
      if (!(await run(module))) return null;
      continue;
    }
    for (const star of stars) await ask(module.file, star.specifier, name, true);
  }
  if (unscanned) return null;
  return new Set([...running].filter((file) => byFile.get(file)!.package !== undefined));
}
