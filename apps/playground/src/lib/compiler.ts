// The compiler in the browser: crates/lumen_wasm, loaded on demand from public/generated/wasm
// (scripts/assets.ts). Its `compile` takes the napi binding's options and returns the same
// result shape, so the types of @lumen/compiler describe it.

import type {
  CompileOptions,
  CompileResult,
  Diagnostic,
  ScanResult,
  SvgCompileOptions,
} from "@lumen/compiler";

/** The wasm-bindgen module (`--target web`). */
export interface WasmCompiler {
  default(input: { module_or_path: string }): Promise<unknown>;
  compile(source: string, filename: string, options?: WasmCompileOptions): CompileResult;
  compileSvg(source: string, filename: string, options?: SvgCompileOptions): CompileResult;
  scan(source: string, filename: string): ScanResult;
  version(): string;
}

/** `cssTargets` needs browserslist, which the wasm build leaves out. */
export type WasmCompileOptions = Omit<CompileOptions, "cssTargets">;

let loading: Promise<WasmCompiler> | undefined;

/** Loads and instantiates the wasm compiler once; `base` is the playground's base URL. */
export function loadCompiler(base: string): Promise<WasmCompiler> {
  loading ??= (async () => {
    const dir = `${base}generated/wasm/`;
    const module = (await import(/* @vite-ignore */ `${dir}lumen_wasm.js`)) as WasmCompiler;
    await module.default({ module_or_path: `${dir}lumen_wasm_bg.wasm` });
    return module;
  })().catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

/** Where the playground's file lives: island refs and scope tokens are relative to the root. */
export const FILENAME = "/src/App.stsx";
export const ROOT = "/";

export interface PlaygroundDiagnostic {
  code: string;
  severity: Diagnostic["severity"];
  message: string;
  help?: string;
  /** Docs topic, such as `errors/LUM2001`. */
  docs: string;
  /** UTF-16 offsets into the source. */
  from: number;
  to: number;
  /** 1-based. */
  line: number;
  column: number;
  /** Which compile reported it. */
  target: "client" | "server";
}

export interface PlaygroundOutput {
  client: CompileResult;
  server: CompileResult;
  /** Client and server diagnostics, without duplicates, in source order. */
  diagnostics: PlaygroundDiagnostic[];
  errors: number;
}

/** Compiles the source for both targets, as the Vite plugin does (without source maps). */
export function compileBoth(compiler: WasmCompiler, source: string): PlaygroundOutput {
  const options: WasmCompileOptions = { sourceMap: false, root: ROOT };
  const client = compiler.compile(source, FILENAME, { ...options, target: "client" });
  const server = compiler.compile(source, FILENAME, {
    ...options,
    target: "server",
    emitCss: false,
  });
  const diagnostics = mergeDiagnostics(source, [
    ...client.diagnostics.map((diagnostic) => ({ diagnostic, target: "client" as const })),
    ...server.diagnostics.map((diagnostic) => ({ diagnostic, target: "server" as const })),
  ]);
  return {
    client,
    server,
    diagnostics,
    errors: diagnostics.filter((diagnostic) => diagnostic.severity === "error").length,
  };
}

function mergeDiagnostics(
  source: string,
  entries: { diagnostic: Diagnostic; target: "client" | "server" }[],
): PlaygroundDiagnostic[] {
  const seen = new Set<string>();
  const merged: PlaygroundDiagnostic[] = [];
  for (const { diagnostic, target } of entries) {
    const key = `${diagnostic.code}:${diagnostic.span.start}:${diagnostic.span.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { line, column } = position(source, diagnostic.span.start);
    merged.push({
      code: diagnostic.code,
      severity: diagnostic.severity,
      message: diagnostic.message,
      ...(diagnostic.help === undefined ? {} : { help: diagnostic.help }),
      docs: diagnostic.docs,
      from: diagnostic.span.start,
      to: Math.max(diagnostic.span.end, diagnostic.span.start),
      line,
      column,
      target,
    });
  }
  return merged.toSorted((a, b) => a.from - b.from || a.code.localeCompare(b.code));
}

/** 1-based line and UTF-16 column of `offset`. */
export function position(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let start = 0;
  for (let index = source.indexOf("\n"); index !== -1 && index < offset;) {
    line++;
    start = index + 1;
    index = source.indexOf("\n", start);
  }
  return { line, column: offset - start + 1 };
}
