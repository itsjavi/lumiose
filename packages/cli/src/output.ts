// The CLI's output contract (decision-10): exit codes and the `--format json` envelope shared by
// every command.

/** Exit codes: success, problems found (errors, unformatted files, nothing found), tool failure or misuse. */
export const EXIT_OK = 0;
export const EXIT_PROBLEMS = 1;
export const EXIT_FAILURE = 2;

export type OutputFormat = "human" | "json";

/** Why a command could not do its job: present in the envelope when no diagnostics explain it. */
export interface Failure {
  message: string;
  help?: string;
}

/**
 * The `--format json` document of every command: `{ command, ok, ...payload }`. `ok` is true exactly
 * when the exit code is 0. Stable: fields are only ever added.
 */
export type Envelope<Payload extends object = object> = {
  command: string;
  ok: boolean;
} & Payload;

/** The envelope as printed: indented JSON, or one line (`compact`) for long-running commands. */
export function formatEnvelope(
  command: string,
  ok: boolean,
  payload: object = {},
  options: { compact?: boolean } = {},
): string {
  const document = { command, ok, ...payload };
  return `${options.compact ? JSON.stringify(document) : JSON.stringify(document, null, 2)}\n`;
}

/** A thrown value as a {@link Failure}; errors with a `help` field (CheckFailure) keep it. */
export function failureOf(error: unknown): Failure {
  const message = error instanceof Error ? error.message : String(error);
  const help = (error as { help?: unknown } | null)?.help;
  return typeof help === "string" ? { message, help } : { message };
}
