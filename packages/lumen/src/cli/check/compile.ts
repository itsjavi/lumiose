// Compiler diagnostics (spec §9.1 step 3, §9.2): `compile()` on `.stsx` / `.tsx` sources for the
// reactivity, style and island checks (LUM2xxx–LUM4xxx) that scanning and type checking miss.
// Shared by `lumen check` (as a built-in diagnostic provider) and the language server.

import type { Diagnostic as CompilerDiagnostic } from "@lumen/compiler";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { DiagnosticProvider, FileDiagnostics } from "./index.ts";
import { listFiles, loadCompiler, SOURCE_DIR } from "./shadow.ts";

/** TypeScript reports syntax errors itself, on the same (masked) text. */
const REPORTED_BY_TYPESCRIPT = new Set(["LUM1001"]);

export interface CompileDiagnosticsOptions {
  /** The project root (island refs are root-relative). */
  root?: string;
  /** Diagnostics already reported for this text (its scan's); not repeated. */
  reported?: readonly CompilerDiagnostic[];
}

/**
 * The client compile's diagnostics for one source (UTF-16 spans), without syntax errors and
 * without diagnostics already in `options.reported`.
 */
export async function compileDiagnostics(
  text: string,
  filename: string,
  options: CompileDiagnosticsOptions = {},
): Promise<CompilerDiagnostic[]> {
  const { compile } = await loadCompiler();
  const result = compile(text, filename, {
    target: "client",
    sourceMap: false,
    ...(options.root === undefined ? {} : { root: options.root }),
  });
  const reported = new Set((options.reported ?? []).map(diagnosticKey));
  return result.diagnostics.filter(
    (diagnostic) =>
      !REPORTED_BY_TYPESCRIPT.has(diagnostic.code) && !reported.has(diagnosticKey(diagnostic)),
  );
}

/**
 * `lumen check`'s compiler provider: every scanned `.stsx` (its scan diagnostics are already
 * reported) and every `src/**\/*.tsx`.
 */
export const compilerDiagnostics: DiagnosticProvider = async ({ root, files }) => {
  const tsx = await listFiles(join(root, SOURCE_DIR), (name) => name.endsWith(".tsx"));
  const sources = [
    ...files.map((file) => ({
      file: file.source,
      text: file.text,
      reported: file.scan.diagnostics,
    })),
    ...(await Promise.all(
      tsx.map(async (file) => ({ file, text: await readFile(file, "utf8"), reported: [] })),
    )),
  ];
  const results: FileDiagnostics[] = [];
  for (const { file, text, reported } of sources) {
    const diagnostics = await compileDiagnostics(text, resolve(root, file), { root, reported });
    if (diagnostics.length > 0) results.push({ file, diagnostics });
  }
  return results;
};

function diagnosticKey(diagnostic: CompilerDiagnostic): string {
  return `${diagnostic.code}:${diagnostic.span.start}:${diagnostic.span.end}`;
}
