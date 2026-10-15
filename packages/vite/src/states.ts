// Scoped state ids (TASK-193, decision-33). The server sends the values of the `defineState()`
// states a page created to the browser, keyed by the same kind of id as island refs:
// `<module>#<export>`, the module named root-relatively (`/src/lib/cart.ts`) or package-relatively.
// The `lumiose:state` transform appends the id to each module-scope state,
//
//   export const cart = defineState(() => …);   →   …
//                                                    cart.$$id = "/src/lib/cart.ts#cart";
//
// at the end of the module, so no code moves and the source map stays valid. It runs after the
// TypeScript strip and the Lumiose compile, on modules that import `defineState` from `lumiose`.
//
// Only states that client code (islands, SPA routes) can reach are sent, so only they get an id
// on the server:
//
// - Client environment: every state it compiles is in a client graph; their refs are recorded.
// - Server build: the client environment builds first, so a state gets its id when the client
//   build recorded its ref.
// - Dev: client modules are compiled when the browser asks for them, after the server rendered the
//   page. The server compile gives every state its id, and `lumiose dev` asks `isClientState` at
//   render time: the state's module reaches an island module or an SPA route module through the
//   importers of the ssr module graph.

import type { PackageRoot } from "@lumiose/compiler";
import { parseAst, type EnvironmentModuleGraph, type Plugin } from "vite";
import type { Packages } from "./packages.ts";
import { cleanId } from "./styles.ts";

/** Script and Lumiose modules (compiled to JavaScript by the time this transform sees them). */
const SCRIPT_MODULE = /\.(?:[cm]?[jt]sx?|stsx)$/;
const TYPESCRIPT = /\.[cm]?ts$/;

/** A module-scope state: its local binding and the name its id uses (the export's, if exported). */
export interface StateBinding {
  local: string;
  name: string;
}

interface Node {
  type: string;
  [key: string]: any;
}

const nameOf = (node: Node): string =>
  node.type === "Identifier" ? node.name : String(node.value);

/**
 * The module-scope `const x = defineState(…)` bindings of `program`, where `defineState` is
 * imported from `lumiose`, named after their first export (or their local name).
 */
export function stateBindings(program: { body: readonly Node[] }): StateBinding[] {
  const callees = new Set<string>();
  const locals: string[] = [];
  const exported = new Map<string, string>();
  const declare = (declaration: Node | null | undefined, exportedToo: boolean): void => {
    if (declaration?.type !== "VariableDeclaration") return;
    for (const declarator of declaration.declarations as Node[]) {
      const init = declarator.init as Node | null;
      if (
        declarator.id.type === "Identifier" &&
        init?.type === "CallExpression" &&
        init.callee.type === "Identifier" &&
        callees.has(init.callee.name)
      ) {
        locals.push(declarator.id.name);
        if (exportedToo && !exported.has(declarator.id.name)) {
          exported.set(declarator.id.name, declarator.id.name);
        }
      }
    }
  };
  // Imports are hoisted: collect them before the declarations that call them.
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration" || statement.source.value !== "lumiose") continue;
    for (const specifier of statement.specifiers as Node[]) {
      if (specifier.type === "ImportSpecifier" && nameOf(specifier.imported) === "defineState") {
        callees.add(specifier.local.name);
      }
    }
  }
  if (callees.size === 0) return [];
  for (const statement of program.body) {
    if (statement.type === "VariableDeclaration") declare(statement, false);
    else if (statement.type === "ExportNamedDeclaration") {
      declare(statement.declaration, true);
      if (statement.source) continue;
      for (const specifier of statement.specifiers as Node[]) {
        const local = nameOf(specifier.local);
        if (!exported.has(local)) exported.set(local, nameOf(specifier.exported));
      }
    } else if (
      statement.type === "ExportDefaultDeclaration" &&
      statement.declaration.type === "Identifier" &&
      !exported.has(statement.declaration.name)
    ) {
      exported.set(statement.declaration.name, "default");
    }
  }
  return locals.map((local) => ({ local, name: exported.get(local) ?? local }));
}

/** The id island refs use for `file`: root- or package-relative (the innermost), else `file`. */
export function stableModuleId(
  file: string,
  root: string,
  packages: readonly PackageRoot[],
): string {
  const within = (dir: string): string | undefined => {
    const base = dir.replace(/\/$/, "");
    return file.startsWith(`${base}/`) ? file.slice(base.length) : undefined;
  };
  // The innermost of the root and the packages names the module, as in the compiler: a package
  // installed in the root's node_modules is named by its package (the root wins a tie).
  const inRoot = within(root);
  let found: { name: string; rest: string; depth: number } | undefined;
  for (const pkg of packages) {
    const rest = within(pkg.dir);
    const depth = pkg.dir.replace(/\/$/, "").length;
    if (rest !== undefined && (found === undefined || depth > found.depth)) {
      found = { name: pkg.name, rest, depth };
    }
  }
  if (
    inRoot !== undefined &&
    (found === undefined || found.depth <= root.replace(/\/$/, "").length)
  )
    return inRoot;
  return found === undefined ? file : found.name + found.rest;
}

/** What the transform knows about states across environments (shared during a build). */
export class StateRegistry {
  /** Refs of the states the client environment compiled: client code reaches them. */
  readonly client = new Set<string>();
  /** Dev: module id (`/src/lib/cart.ts`) → file, for states the server compiled. */
  readonly files = new Map<string, string>();

  /**
   * Dev: whether the module of the state `ref` reaches a module `isClientRoot` accepts (an island
   * or SPA route module) through the importers in `graph` (the ssr module graph, which holds
   * every module the render loaded).
   */
  reachable(
    ref: string,
    graph: EnvironmentModuleGraph,
    isClientRoot: (file: string) => boolean,
  ): boolean {
    const file = this.files.get(ref.slice(0, ref.lastIndexOf("#")));
    if (file === undefined) return false;
    const stack = [...(graph.getModulesByFile(file) ?? [])];
    const seen = new Set(stack);
    while (stack.length > 0) {
      const mod = stack.pop()!;
      if (mod.file !== null && isClientRoot(mod.file)) return true;
      for (const importer of mod.importers) {
        if (!seen.has(importer)) {
          seen.add(importer);
          stack.push(importer);
        }
      }
    }
    return false;
  }
}

/** The `lumiose:state` plugin: appends scoped state ids (see the module comment). */
export function statePlugin(context: {
  registry: StateRegistry;
  root: () => string;
  packages: () => Packages;
  serve: () => boolean;
}): Plugin {
  const { registry } = context;
  return {
    name: "lumiose:state",
    sharedDuringBuild: true,
    transform: {
      filter: { id: SCRIPT_MODULE, code: "defineState" },
      handler(code, id) {
        const file = cleanId(id);
        let bindings: StateBinding[];
        try {
          bindings = stateBindings(parseAst(code, { lang: TYPESCRIPT.test(file) ? "ts" : "js" }));
        } catch {
          // Not JavaScript this plugin can read (another plugin's output): leave it alone.
          return null;
        }
        if (bindings.length === 0) return null;
        const module = stableModuleId(file, context.root(), context.packages().for(file));
        let states = bindings.map((binding) => ({
          local: binding.local,
          ref: `${module}#${binding.name}`,
        }));
        if (this.environment.config.consumer === "client") {
          for (const state of states) registry.client.add(state.ref);
        } else if (context.serve()) {
          registry.files.set(module, file);
        } else {
          states = states.filter((state) => registry.client.has(state.ref));
          if (states.length === 0) return null;
        }
        const ids = states.map((state) => `\n${state.local}.$$id = ${JSON.stringify(state.ref)};`);
        return { code: code + ids.join(""), map: null };
      },
    },
  };
}
