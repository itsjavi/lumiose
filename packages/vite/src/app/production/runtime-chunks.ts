// Which runtime modules stay out of the runtime chunk (./client-runtime.ts, TASK-228): those that
// only one lazy chunk (an island, or an SPA page) needs. They go into that chunk, which exists
// anyway, so the pages that render it load them and no other page does.
//
// Rolldown cuts chunks by the set of entries (static and dynamic) that reach each module through
// static imports. A module that one dynamic entry alone reaches lands in that entry's chunk. One that
// several reach would land in a chunk of its own, one more request for each of those islands, so it
// goes into the runtime chunk instead, with what the client entries import.
//
// The public entries (`lumiose`, `lumiose/dom`) are barrels: they only re-export. The build marks
// them free of side effects (`moduleSideEffects: false`), so Rolldown follows an import through them
// to the module that declares the name. This analysis does the same: an import of `For` from
// `lumiose/dom` reaches dom/list.ts, not every module `lumiose/dom` re-exports. Where it cannot tell
// (a namespace import, a name it cannot find), it keeps the whole barrel, which can only count a
// module as shared when it is not: such a module stays in the runtime chunk, as before.

import { parseAst, type Rollup } from "vite";

/** A barrel's re-exports, by exported name, plus its `export *` sources (unresolved specifiers). */
export interface Barrel {
  named: Map<string, { source: string; imported: string }>;
  stars: string[];
}

type Program = ReturnType<typeof parseAst>;
type Statement = Program["body"][number];

const name = (node: { type: string; name?: string; value?: unknown }): string =>
  node.type === "Identifier" ? node.name! : String(node.value);

/**
 * The re-exports of a TypeScript module that only re-exports (`export … from`, plus types), or
 * undefined: importing such a module runs no code of its own, so it can be marked free of side
 * effects.
 */
export function barrel(code: string): Barrel | undefined {
  // Cheap rejection before parsing: a barrel declares nothing.
  if (/^\s*(?:export\s+)?(?:const|let|var|function|class|async|enum)\b/m.test(code)) return;
  const body = parseAst(code, { lang: "ts" }).body;
  if (body.length === 0) return;
  const result: Barrel = { named: new Map(), stars: [] };
  for (const node of body) {
    if (node.type === "ExportAllDeclaration") {
      if (node.exportKind === "type") continue;
      if (node.exported === null) result.stars.push(node.source.value);
      else result.named.set(name(node.exported), { source: node.source.value, imported: "*" });
    } else if (node.type === "ExportNamedDeclaration") {
      if (node.exportKind === "type") continue;
      if (node.source === null || node.source === undefined) return;
      for (const specifier of node.specifiers) {
        if (specifier.exportKind === "type") continue;
        result.named.set(name(specifier.exported), {
          source: node.source.value,
          imported: name(specifier.local),
        });
      }
    } else if (
      !(node.type === "ImportDeclaration" && node.importKind === "type") &&
      node.type !== "TSTypeAliasDeclaration" &&
      node.type !== "TSInterfaceDeclaration"
    ) {
      return;
    }
  }
  return result;
}

/** The static imports and re-exports of a JS module: specifier → imported names (`*`: all). */
export function importedNames(code: string): Map<string, Set<string>> {
  const imports = new Map<string, Set<string>>();
  const add = (source: string, names: Iterable<string>): void => {
    let set = imports.get(source);
    if (set === undefined) imports.set(source, (set = new Set()));
    for (const item of names) set.add(item);
  };
  for (const node of parseAst(code).body as Statement[]) {
    if (node.type === "ImportDeclaration") {
      const names = node.specifiers.map((specifier) =>
        specifier.type === "ImportSpecifier"
          ? name(specifier.imported)
          : specifier.type === "ImportDefaultSpecifier"
            ? "default"
            : "*",
      );
      // A side-effect import of a barrel: keep all of it.
      add(node.source.value, names.length === 0 ? ["*"] : names);
    } else if (node.type === "ExportAllDeclaration") {
      add(node.source.value, ["*"]);
    } else if (node.type === "ExportNamedDeclaration" && node.source) {
      add(
        node.source.value,
        node.specifiers.map((specifier) => name(specifier.local)),
      );
    }
  }
  return imports;
}

/** What the analysis needs of the module graph. */
export interface ChunkGraph {
  ids: Iterable<string>;
  info(
    id: string,
  ): Pick<
    Rollup.ModuleInfo,
    "isEntry" | "importedIds" | "dynamicallyImportedIds" | "exports" | "code"
  > | null;
  /** Resolves an import specifier of `importer` to a module id, or null. */
  resolve(source: string, importer: string): Promise<string | null>;
}

/**
 * The runtime modules (`isRuntime`) that no static entry reaches and exactly one dynamic entry
 * does, through static imports, with imports of `barrels` followed to the declaring modules.
 */
export async function singleEntryModules(
  graph: ChunkGraph,
  barrels: ReadonlyMap<string, Barrel>,
  isRuntime: (id: string) => boolean,
): Promise<Set<string>> {
  const ids = [...graph.ids];
  const statics: string[] = [];
  const dynamics = new Set<string>();
  for (const id of ids) {
    const info = graph.info(id);
    if (info === null) continue;
    if (info.isEntry) statics.push(id);
    for (const target of info.dynamicallyImportedIds) dynamics.add(target);
  }

  // `name` of barrel `id` → the modules that declare it (the barrel itself when unknown).
  const resolved = new Map<string, Promise<string | null>>();
  const resolve = (source: string, importer: string): Promise<string | null> => {
    const key = `${importer}\0${source}`;
    let result = resolved.get(key);
    if (result === undefined) resolved.set(key, (result = graph.resolve(source, importer)));
    return result;
  };
  // Whether a module that is not a barrel may export `item`: one with `export *` may, unseen.
  const mayExport = (id: string, item: string): boolean => {
    const info = graph.info(id);
    return info === null || info.exports.includes(item) || /\bexport\s*\*/.test(info.code ?? "*");
  };
  // The modules that declare export `item` of barrel `id`, or undefined when it does not export it
  // (`export *` skips `default`). Any other module declares what it exports.
  const declaring = async (id: string, item: string, depth = 0): Promise<string[] | undefined> => {
    const exports = barrels.get(id);
    if (exports === undefined || item === "*" || depth > 16) return [id];
    const named = exports.named.get(item);
    if (named !== undefined) {
      const target = await resolve(named.source, id);
      if (target === null) return [id];
      return (await declaring(target, named.imported, depth + 1)) ?? [target];
    }
    if (item === "default") return undefined;
    const found: string[] = [];
    for (const source of exports.stars) {
      const target = await resolve(source, id);
      if (target === null) return [id];
      if (barrels.has(target)) found.push(...((await declaring(target, item, depth + 1)) ?? []));
      else if (mayExport(target, item)) found.push(target);
    }
    return found.length > 0 ? found : undefined;
  };

  // Static edges, with those into a barrel replaced by edges to the modules it re-exports from.
  const edges = new Map<string, string[]>();
  for (const id of ids) {
    const info = graph.info(id);
    if (info === null) continue;
    const imported = info.importedIds;
    if (barrels.has(id) || info.code === null || !imported.some((target) => barrels.has(target))) {
      edges.set(id, imported);
      continue;
    }
    const targets = new Set(imported.filter((target) => !barrels.has(target)));
    const named = new Set<string>();
    for (const [source, names] of importedNames(info.code)) {
      const target = await resolve(source, id);
      if (target === null || !barrels.has(target)) continue;
      named.add(target);
      for (const item of names) {
        for (const module of (await declaring(target, item)) ?? [target]) targets.add(module);
      }
    }
    // A barrel the code does not name (an import a plugin added): keep it whole.
    for (const target of imported)
      if (barrels.has(target) && !named.has(target)) targets.add(target);
    edges.set(id, [...targets]);
  }

  // Who reaches each module: a static entry, the one dynamic entry (its id), or several of them.
  const STATIC = "\0static";
  const SHARED = "\0shared";
  const reached = new Map<string, string>();
  const visit = (entry: string, mark: string): void => {
    const stack = [entry];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const previous = reached.get(id);
      if (previous === undefined || mark === STATIC) reached.set(id, mark);
      else if (previous !== mark && previous !== STATIC) reached.set(id, SHARED);
      stack.push(...(edges.get(id) ?? []));
    }
  };
  for (const entry of statics) visit(entry, STATIC);
  for (const entry of dynamics) visit(entry, entry);

  const single = new Set<string>();
  for (const [id, mark] of reached) {
    if (mark !== STATIC && mark !== SHARED && isRuntime(id)) single.add(id);
  }
  return single;
}

/**
 * Where the client helpers (`isHelper`: Vite's preload helper and the like) go that `entries`
 * import: the client entries that pages load without the runtime, `src/instrumentation.client.ts`
 * (decision-49) and client scripts (TASK-354). The runtime chunk would hold them, so a page loading
 * such an entry would load the runtime too (TASK-346):
 *
 * - `own`: those only one of these entries uses (with its lazy imports), for its own chunk.
 * - `shared`: those something else uses too (another such entry, the island loader, the SPA entry,
 *   the chunks they load), for a chunk of their own.
 *
 * An entry that imports the runtime (`isRuntime`) loads the runtime chunk anyway: its helpers stay
 * there, unless an entry without the runtime needs them too.
 */
export function plainEntryHelpers(
  graph: Pick<ChunkGraph, "ids" | "info">,
  entries: readonly string[],
  isHelper: (id: string) => boolean,
  isRuntime: (id: string) => boolean,
): { shared: Set<string>; own: Set<string> } {
  const shared = new Set<string>();
  const own = new Set<string>();
  const plain = new Set(entries);
  // What `starts` reach, without entering another of `entries` (a chunk of its own).
  const reach = (starts: string[], lazy: boolean): Set<string> => {
    const seen = new Set<string>();
    const stack = [...starts];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const info = graph.info(id);
      if (info === null) continue;
      const targets = lazy
        ? [...info.importedIds, ...info.dynamicallyImportedIds]
        : info.importedIds;
      for (const target of targets) if (!plain.has(target)) stack.push(target);
    }
    return seen;
  };
  const SHARED = "\0shared";
  /** Helper → the one entry without the runtime that imports it, or SHARED. */
  const owners = new Map<string, string>();
  const others: string[] = [];
  for (const entry of entries) {
    const reached = reach([entry], false);
    if ([...reached].some((id) => isRuntime(id) && !isHelper(id))) {
      others.push(entry);
      continue;
    }
    for (const id of reached) {
      if (isHelper(id)) owners.set(id, owners.has(id) ? SHARED : entry);
    }
  }
  if (owners.size === 0) return { shared, own };
  for (const id of graph.ids) {
    if (!plain.has(id) && graph.info(id)?.isEntry === true) others.push(id);
  }
  const rest = reach(others, true);
  for (const [id, owner] of owners) (owner === SHARED || rest.has(id) ? shared : own).add(id);
  return { shared, own };
}
