// `lumiose({ streamTimeout })` (decision-58): how long a page render waits for its pending
// `<Suspense>` boundaries before they fail with LUM5009 and the response ends.

/** A duration in milliseconds, or a string like `"30s"`, `"500ms"` or `"2m"`; `false` disables it. */
export type StreamTimeoutOption = number | string | false;

/** 30 seconds (decision-58). */
export const DEFAULT_STREAM_TIMEOUT = 30_000;

/** The longest delay `setTimeout` keeps: past it, timers fire at once. */
const MAX_TIMEOUT = 2 ** 31 - 1;

const UNITS: Record<string, number> = { ms: 1, s: 1000, m: 60_000 };

/**
 * Milliseconds of a `streamTimeout` option, or `false`; the default when `undefined`. Throws a
 * `TypeError` naming `what` for anything else.
 */
export function resolveStreamTimeout(option: unknown, what = "streamTimeout"): number | false {
  if (option === undefined) return DEFAULT_STREAM_TIMEOUT;
  if (option === false) return false;
  let ms: number | undefined;
  if (typeof option === "number") ms = option;
  if (typeof option === "string") {
    const match = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m)\s*$/i.exec(option);
    if (match !== null) ms = Number(match[1]) * UNITS[match[2]!.toLowerCase()]!;
  }
  if (ms !== undefined && ms > 0 && ms <= MAX_TIMEOUT) return Math.ceil(ms);
  throw new TypeError(
    `${what}: expected a duration in milliseconds (1 to 2^31 - 1) or a string like "30s", "500ms" or "2m", or false, got ${JSON.stringify(option)}`,
  );
}
