// Diagnostic providers for `ServerOptions.diagnosticProviders`.

import { compileDiagnostics, isServerRoute } from "lumen/tooling";
import type { LumenDiagnosticProvider } from "./server.ts";

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
