// `@lumen/language-server`: the Lumen language server (spec §9.2).
export {
  foldedValue,
  startServer,
  type LumenDiagnosticProvider,
  type LumenFile,
  type ServerOptions,
} from "./server.ts";
export { compilerDiagnostics } from "./providers.ts";
export { resolveTypeScript, type TypeScriptExecutable } from "./typescript.ts";
