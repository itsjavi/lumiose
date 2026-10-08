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

export const LUM_INVALID_ROUTE_FILE = "LUM5002";
export const LUM_DUPLICATE_ROUTE = "LUM5003";
/** A server-only API was reached from client code. */
export const LUM_SERVER_ONLY = "LUM4003";
/** Status, headers, cookies or head changed after the SSR shell was sent (decision-19). */
export const LUM_AFTER_SHELL = "LUM5004";

/** A runtime error carrying a Lumen code and its docs URL (contract doc-2 §6). */
export class LumenError extends Error {
  readonly code: AppDiagnostic["code"];

  constructor(code: AppDiagnostic["code"], message: string) {
    super(`${message} (${code}: https://lumen.dev/errors/${code})`);
    this.name = "LumenError";
    this.code = code;
  }
}
