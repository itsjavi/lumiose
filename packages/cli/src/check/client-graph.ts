// LUM4003 in `lumiose check` (TASK-116): server-only modules (`*.server.*`, `src/server/`) imported
// from code that reaches the browser, reported at the import site. The client graph here starts at
// the modules that are client code by construction: island components (`client:*` call sites)
// and modules that import `lumiose/dom` (client entries), and follows their imports. `lumiose dev`
// and `lumiose build` enforce the rule on the real client graph (@lumiose/vite's server-only.ts).

import type {
  CompileResult,
  Diagnostic as CompilerDiagnostic,
  ImportMeta,
} from "@lumiose/compiler";
import { join, relative } from "node:path";
import { isServerOnly, SERVER_ONLY_CODE } from "@lumiose/vite/internal/server-only.ts";
import type { FileDiagnostics } from "./index.ts";
import type { ModuleHost } from "./modules.ts";
import { loadCompiler } from "./shadow.ts";

const CODE = /\.(?:stsx|tsx|ts|mts|jsx|js|mjs)$/;
const NODE_MODULES = /[\\/]node_modules[\\/]/;

/**
 * LUM4003 diagnostics for the project's client graph. `compiled` holds the project's compiled
 * Lumiose modules (absolute file → result); other modules the graph reaches are compiled here for
 * their imports.
 */
export async function clientGraphDiagnostics(
  root: string,
  compiled: ReadonlyMap<string, CompileResult>,
  host: ModuleHost,
): Promise<FileDiagnostics[]> {
  const imports = new Map<string, readonly ImportMeta[]>();
  for (const [file, result] of compiled) imports.set(file, result.meta.imports ?? []);
  const importsOf = async (file: string): Promise<readonly ImportMeta[]> => {
    let found = imports.get(file);
    if (found === undefined) {
      const text = await host.load(file);
      found =
        text === undefined
          ? []
          : ((await loadCompiler()).compile(text, file, {
              sourceMap: false,
              emitCss: false,
              styleImport: false,
              root,
            }).meta.imports ?? []);
      imports.set(file, found);
    }
    return found;
  };

  // Entries: island components and client entries, each with the chain that made it client code.
  const parent = new Map<string, string | null>();
  const queue: string[] = [];
  const enqueue = (file: string, from: string | null) => {
    if (parent.has(file) || NODE_MODULES.test(file) || !CODE.test(file)) return;
    parent.set(file, from);
    queue.push(file);
  };
  for (const [file, result] of compiled) {
    for (const island of result.meta.islands) {
      if (island.module.startsWith("/")) enqueue(join(root, island.module), file);
    }
    if (result.meta.imports?.some((i) => i.specifier === "lumiose/dom")) enqueue(file, null);
  }

  const reports = new Map<string, CompilerDiagnostic[]>();
  while (queue.length > 0) {
    const file = queue.shift()!;
    for (const imported of await importsOf(file)) {
      const target = host.resolve(imported.specifier, file);
      if (target === null) continue;
      if (!isServerOnly(target, root)) {
        enqueue(target, file);
        continue;
      }
      const chain = [file];
      for (let at = parent.get(file); at; at = parent.get(at)) chain.unshift(at);
      const shown = chain.map((step) => relative(root, step).replaceAll("\\", "/"));
      const diagnostics = reports.get(file) ?? [];
      diagnostics.push({
        code: SERVER_ONLY_CODE,
        severity: "error",
        message:
          `\`${imported.specifier}\` is server-only, but this module reaches the browser ` +
          `(${shown.join(" → ")})`,
        span: imported.span,
        labels: [],
        help:
          "Keep server code on the server: call it through an endpoint or a form action " +
          "(fetchJSON, submit()). Server-only: *.server.* files and src/server/.",
        docs: `errors/${SERVER_ONLY_CODE}`,
      });
      reports.set(file, diagnostics);
    }
  }
  return [...reports].map(([file, diagnostics]) => ({ file, diagnostics }));
}
