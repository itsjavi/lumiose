// Structured app-layer diagnostics (spec §5.4). Codes are registered in the compiler's
// diagnostics registry; this is the file-level subset the app layer reports (no spans yet).

export type DiagnosticSeverity = "error" | "warning";

export interface AppDiagnostic {
  /** Stable code, e.g. `LUM5002`. */
  code: `LUM${number}`;
  severity: DiagnosticSeverity;
  message: string;
  /** Project-relative POSIX path of the offending file. */
  file: string;
  /** How to fix it, when there is an obvious fix. */
  help?: string;
}

/** A request API was used while a static route was prerendered (spec §7.1). */
export const LUM_PRERENDER_REQUEST = "LUM5001";
export const LUM_INVALID_ROUTE_FILE = "LUM5002";
export const LUM_DUPLICATE_ROUTE = "LUM5003";
/** An island prop is not plain data (decision-9). */
export const LUM_ISLAND_PROP = "LUM4002";
/** A server-only API was reached from client code. */
export const LUM_SERVER_ONLY = "LUM4003";
/** A value awaited inside an island is not plain data (spec §4.4). */
export const LUM_AWAIT_VALUE = "LUM4007";
/** An island read a context the page provided outside it (dev warning, TASK-194). */
export const LUM_ISLAND_PAGE_CONTEXT = "LUM4010";
/** Status, headers, cookies or head changed after the SSR shell was sent (decision-19). */
export const LUM_AFTER_SHELL = "LUM5004";
/** A static endpoint exports a method other than GET (it is prerendered to a file). */
export const LUM_STATIC_ENDPOINT_METHOD = "LUM5005";

/** A runtime error carrying a Lumiose code and where to read about it (contract doc-2 §6). */
export class LumioseError extends Error {
  readonly code: AppDiagnostic["code"];

  constructor(code: AppDiagnostic["code"], message: string) {
    // `lumiose docs <code>` until the docs site is online (TASK-122).
    super(`${message} (${code}: run \`lumiose docs ${code}\`)`);
    this.name = "LumioseError";
    this.code = code;
  }
}
