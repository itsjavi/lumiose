// `@lumiose/language-server`: the Lumiose language server (spec §9.2).
export {
  foldedValue,
  startServer,
  type LumioseDiagnosticProvider,
  type LumioseFile,
  type ServerOptions,
} from "./server.ts";
export { compilerDiagnostics } from "./providers.ts";
export { resolveTypeScript, type TypeScriptExecutable } from "./typescript.ts";
