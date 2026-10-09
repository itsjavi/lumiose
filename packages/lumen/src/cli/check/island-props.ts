// LUM4002 at check time (TASK-119). `lumen/jsx-runtime` types the props of an island call site
// (`<X client:load … />`) so that a value that cannot be serialized fails against a
// `NotSerializable<"a function">` marker. TypeScript reports that at the component's tag, with the
// prop in the elaboration chain; `lumen check` and the language server turn it into a LUM4002
// diagnostic on the prop.

export const LUM_ISLAND_PROP = "LUM4002";

export interface IslandPropProblem {
  /** The prop as written at the call site (`onDone`); `undefined` when the chain does not name it. */
  prop: string | undefined;
  /** The path to the offending value, from the prop (`point.length`). */
  path: string | undefined;
  /** What the value is: `a function`, `a symbol`, `a promise`. */
  what: string;
}

const MARKER = /NotSerializable<"([^"]+)">/;
// "Types of property 'a' are incompatible." and "The types of 'a.b' are incompatible …", in order.
const SEGMENTS = /(?:Types of property|The types of) '([^']+)' are incompatible/g;

/** The island prop problem a TypeScript message describes, if it is one. */
export function islandPropProblem(message: string): IslandPropProblem | undefined {
  const marker = MARKER.exec(message);
  if (!marker) return undefined;
  const segments = [...message.matchAll(SEGMENTS)].map((match) => match[1]!);
  const path = segments.length > 0 ? segments.join(".") : undefined;
  return { prop: path?.split(".")[0], path, what: marker[1]! };
}

/** The LUM4002 message and help for a problem. */
export function islandPropMessage(problem: IslandPropProblem): { message: string; help: string } {
  const { prop, path, what } = problem;
  const subject = prop === undefined ? "An island prop" : `Island prop \`${prop}\``;
  const detail = path === undefined || path === prop ? `it is ${what}` : `\`${path}\` is ${what}`;
  return {
    message: `${subject} is not serializable: ${detail}. Island props are sent to the browser as data.`,
    help:
      "Pass data only, and do the work inside the island (call an endpoint with `fetchJSON` or post " +
      "a form with `submit()`), or drop the `client:*` directive to keep a server component.",
  };
}

/**
 * The UTF-16 range of the `prop` attribute name of the element whose tag starts at or after
 * `from` (TypeScript reports the error at the tag name). Attribute values are skipped, so a
 * same-named attribute of a nested element is not matched; `undefined` when not found.
 */
export function islandPropRange(
  text: string,
  from: number,
  prop: string,
): { start: number; end: number } | undefined {
  let i = from;
  // Skip the tag name.
  while (i < text.length && /[\w$.:-]/.test(text[i]!)) i++;
  let depth = 0;
  let quote: string | undefined;
  for (; i < text.length; i++) {
    const char = text[i]!;
    if (quote !== undefined) {
      if (char === quote) quote = undefined;
      continue;
    }
    if (depth > 0) {
      if (char === "{") depth++;
      else if (char === "}") depth--;
      else if (char === '"' || char === "'" || char === "`") quote = char;
      continue;
    }
    if (char === "{") depth++;
    else if (char === '"' || char === "'") quote = char;
    else if (char === ">") return undefined;
    else if (/[\w$]/.test(char) && /[\s{]/.test(text[i - 1] ?? " ")) {
      let end = i;
      while (end < text.length && /[\w$:-]/.test(text[end]!)) end++;
      if (text.slice(i, end) === prop) return { start: i, end };
      i = end - 1;
    }
  }
  return undefined;
}
