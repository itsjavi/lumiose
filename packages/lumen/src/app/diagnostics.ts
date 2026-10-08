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
