// Diagnostic providers for `ServerOptions.diagnosticProviders`.

import { compileTsx, type HostModule } from "@lumiose/compiler";
import {
  compileDiagnostics,
  compileWithModules,
  isServerRoute,
  ProjectChecks,
} from "@lumiose/cli/tooling";
import type { LumioseDiagnosticProvider, ProjectDiagnosticsFactory } from "./server.ts";
import { isStsxProject } from "./stsx-mode.ts";

/** Rounds of module requests before giving up (`$name` constants re-exported through modules). */
const MAX_ROUNDS = 16;

/**
 * The compiler's diagnostics (reactivity LUM2xxx, styles LUM3xxx, islands LUM4xxx) from a client
 * `compile()` of the document, as `lumiose check` reports them; scanner diagnostics are not repeated.
 * Constants imported by `$` references are read through the file's module host. In an stsx-mode
 * project the file is another framework's JSX: only style diagnostics (`compileTsx`).
 */
export const compilerDiagnostics: LumioseDiagnosticProvider = async (file) => {
  if (isStsxProject(file.root)) return stsxDiagnostics(file);
  return compileDiagnostics(file.text, file.path, {
    root: file.root,
    reported: file.scan.diagnostics,
    modules: file.modules,
    // Server-rendered pages read their own props as plain values (TASK-109).
    serverRoute: await isServerRoute(file.root, file.path),
  });
};

/** Style diagnostics of an stsx-mode file; its classes are `className` unless it writes `class=`. */
const stsxDiagnostics: LumioseDiagnosticProvider = async (file) => {
  const classAttribute = /\sclassName\s*=/.test(file.text) ? "className" : "class";
  const modules: HostModule[] = [];
  for (let round = 1; ; round++) {
    const result = compileTsx(file.text, file.path, {
      classAttribute,
      root: file.root,
      sourceMap: false,
      modules,
    });
    if (result.moduleRequests.length === 0 || file.modules === undefined || round === MAX_ROUNDS) {
      const reported = new Set(file.scan.diagnostics.map((d) => `${d.code}:${d.span.start}`));
      return result.diagnostics.filter((d) => !reported.has(`${d.code}:${d.span.start}`));
    }
    for (const { importer, specifier } of result.moduleRequests) {
      const id = file.modules.resolve(specifier, importer);
      const source = id === null ? undefined : await file.modules.load(id);
      modules.push(
        id === null || source === undefined
          ? { importer, specifier }
          : { importer, specifier, resolved: { id, source } },
      );
    }
  }
};

/**
 * Project-wide diagnostics (LUM4003 at import sites, LUM3012), as `lumiose check` reports them: each
 * run recompiles only the project files whose text changed. None in stsx-mode projects.
 */
export const projectDiagnostics: ProjectDiagnosticsFactory = (root, modules) => {
  if (isStsxProject(root)) return () => Promise.resolve(new Map());
  const checks = new ProjectChecks(root, modules, (text, file) =>
    compileWithModules(text, file, { target: "client", sourceMap: false, root }, modules),
  );
  return () => checks.run();
};
