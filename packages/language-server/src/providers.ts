// Diagnostic providers for `ServerOptions.diagnosticProviders`.

import { compileDiagnostics } from "lumen/tooling";
import type { LumenDiagnosticProvider } from "./server.ts";

/**
 * The compiler's diagnostics (reactivity LUM2xxx, styles LUM3xxx, islands LUM4xxx) from a client
 * `compile()` of the document, as `lumen check` reports them; scanner diagnostics are not repeated.
 * Constants imported by `$` references are read through the file's module host.
 */
export const compilerDiagnostics: LumenDiagnosticProvider = (file) =>
  compileDiagnostics(file.text, file.path, {
    root: file.root,
    reported: file.scan.diagnostics,
    modules: file.modules,
  });
