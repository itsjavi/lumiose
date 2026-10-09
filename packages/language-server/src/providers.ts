// Diagnostic providers for `ServerOptions.diagnosticProviders`.

import {
  compileDiagnostics,
  compileWithModules,
  isServerRoute,
  ProjectChecks,
} from "lumen/tooling";
import type { LumenDiagnosticProvider, ProjectDiagnosticsFactory } from "./server.ts";

/**
 * The compiler's diagnostics (reactivity LUM2xxx, styles LUM3xxx, islands LUM4xxx) from a client
 * `compile()` of the document, as `lumen check` reports them; scanner diagnostics are not repeated.
 * Constants imported by `$` references are read through the file's module host.
 */
export const compilerDiagnostics: LumenDiagnosticProvider = async (file) =>
  compileDiagnostics(file.text, file.path, {
    root: file.root,
    reported: file.scan.diagnostics,
    modules: file.modules,
    // Server-rendered pages read their own props as plain values (TASK-109).
    serverRoute: await isServerRoute(file.root, file.path),
  });

/**
 * Project-wide diagnostics (LUM4003 at import sites, LUM3012), as `lumen check` reports them: each
 * run recompiles only the project files whose text changed.
 */
export const projectDiagnostics: ProjectDiagnosticsFactory = (root, modules) => {
  const checks = new ProjectChecks(root, modules, (text, file) =>
    compileWithModules(text, file, { target: "client", sourceMap: false, root }, modules),
  );
  return () => checks.run();
};
