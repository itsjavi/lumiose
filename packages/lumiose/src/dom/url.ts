// Unsafe URL blocking (decision-29, TASK-168): a dynamic value written to a URL attribute that
// would run script (`javascript:`, `vbscript:`) or load an HTML document from data
// (`data:text/html`) is replaced by a placeholder, on the client (`setAttr`, spread) and on the
// server (`attr`, `spreadAttrs`) alike. Static attribute literals never reach these writers.
// Shared by lumiose/dom and lumiose/server, so both sides decide the same way.

import { DEV } from "./dev.ts";

/** What a blocked URL renders as: a URL that does nothing. */
export const BLOCKED_URL = "about:blank#blocked";

/** Attributes whose value the browser follows as a URL. */
const URL_ATTRIBUTES = /^(?:href|src|action|formaction|xlink:href|poster|data|cite|background)$/i;

/**
 * Whether `value` would run script or load an HTML document when used as a URL. As the browser's
 * URL parser does, leading C0 controls and spaces are stripped and tabs and newlines ignored
 * anywhere, so `" java\tscript:"` is `javascript:`. Character references are not decoded: the
 * server escapes `&`, so `&#106;avascript:` stays literal text on both sides.
 */
export function isUnsafeUrl(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /^(?:javascript|vbscript):|^data:\s*text\/html/i.test(
    value.replace(/^[\0- ]+|[\t\n\r]/g, ""),
  );
}

/**
 * The value to write for attribute `name`: `value` itself, or {@link BLOCKED_URL} when `name`
 * takes a URL and `value` is unsafe (with a LUM4009 warning in dev).
 */
export function safeAttrValue(name: string, value: string): string {
  if (!URL_ATTRIBUTES.test(name) || !isUnsafeUrl(value)) return value;
  if (DEV) {
    console.warn(
      `Lumiose: LUM4009: blocked an unsafe URL in the "${name}" attribute (${JSON.stringify(value.slice(0, 40))}): javascript:, vbscript: and data:text/html URLs from dynamic values render as ${BLOCKED_URL}. Use an event handler instead of a script URL (run \`lumiose docs LUM4009\`).`,
    );
  }
  return BLOCKED_URL;
}
