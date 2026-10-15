// Text for the in-page inspector (./inspector.ts): value previews, element names, write locations
// and source links. Pure functions, so they are tested without a page.

/** The attribute the compiler puts on every element in dev (crates/lumiose_compiler dev_source.rs). */
export const SOURCE_ATTRIBUTE = "data-lumiose-source";

const MAX_STRING = 60;
const MAX_ITEMS = 5;

/** A one-line preview of any value, two levels deep at most and `max` characters long. */
export function preview(value: unknown, max = 100): string {
  let text: string;
  try {
    text = previewOf(value, 0);
  } catch {
    // A getter or proxy that throws.
    return "(unreadable)";
  }
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function previewOf(value: unknown, depth: number): string {
  switch (typeof value) {
    case "string":
      return JSON.stringify(value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value);
    case "function":
      return `ƒ ${value.name || "anonymous"}()`;
    case "symbol":
    case "bigint":
      return value.toString() + (typeof value === "bigint" ? "n" : "");
    case "object":
      break;
    default:
      return String(value);
  }
  if (value === null) return "null";
  if (typeof Node !== "undefined" && value instanceof Node) return describeNode(value);
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  if (value instanceof Map) return `Map(${value.size})`;
  if (value instanceof Set) return `Set(${value.size})`;
  if (value instanceof Promise) return "Promise";
  if (Array.isArray(value)) {
    if (depth > 1) return `Array(${value.length})`;
    const items = value.slice(0, MAX_ITEMS).map((item) => previewOf(item, depth + 1));
    if (value.length > MAX_ITEMS) items.push("…");
    return `${value.length > MAX_ITEMS ? `(${value.length}) ` : ""}[${items.join(", ")}]`;
  }
  if (depth > 1) return "{…}";
  const keys = Object.keys(value);
  const entries = keys
    .slice(0, MAX_ITEMS)
    .map((key) => `${key}: ${previewOf((value as Record<string, unknown>)[key], depth + 1)}`);
  if (keys.length > MAX_ITEMS) entries.push("…");
  const name = (value as object).constructor?.name;
  const prefix = name && name !== "Object" ? `${name} ` : "";
  return `${prefix}{${entries.length > 0 ? ` ${entries.join(", ")} ` : ""}}`;
}

/** `<button.counter>`, `<input#email>`, `"text"`. */
export function describeNode(node: Node): string {
  if (node.nodeType === 3) {
    const text = (node.textContent ?? "").trim();
    return `"${text.length > 24 ? `${text.slice(0, 24)}…` : text}"`;
  }
  if (node.nodeType === 8) return "<!---->";
  if (node.nodeType !== 1) return node.nodeName.toLowerCase();
  const el = node as Element;
  const id = el.id ? `#${el.id}` : "";
  const classes = [...el.classList]
    .slice(0, 2)
    .map((name) => `.${name}`)
    .join("");
  return `<${el.localName}${id}${classes}>`;
}

/** The file part of a source location (`src/Counter.stsx:4:17` → `src/Counter.stsx`). */
export function sourceFile(source: string): string {
  return source.replace(/:\d+:\d+$/, "");
}

/** `Counter.stsx:4` for a source location. */
export function shortSource(source: string): string {
  const match = /([^/]*):(\d+):\d+$/.exec(source);
  return match === null ? source : `${match[1]}:${match[2]}`;
}

/**
 * The URL of Vite's open-in-editor endpoint for a source location: root-relative files are
 * resolved against the project root, since the endpoint resolves against the server's cwd.
 */
export function openInEditorUrl(base: string, root: string, source: string): string {
  const absolute = source.startsWith("/") || /^[a-z]:[\\/]/i.test(source);
  const file = absolute ? source : `${root.replace(/\/$/, "")}/${source}`;
  return `${base}__open-in-editor?file=${encodeURIComponent(file)}`;
}

/** Runtime frames: the reactive core, the DOM runtime, the app layer. */
const RUNTIME_FRAME = /\/lumiose\/(?:src|dist)\/(?:core|dom|app)\//;

/**
 * Where a write happened, from its stack: the first frame outside Lumiose's runtime, as
 * `src/Counter.stsx (onClick)`, or the file alone for an anonymous function. Lines are left out:
 * they are those of the compiled module.
 */
export function writeLocation(error: Error | undefined): string | undefined {
  const stack = error?.stack;
  if (stack === undefined) return undefined;
  for (const line of stack.split("\n").slice(1)) {
    // V8: `    at fn (url:1:2)` or `    at url:1:2`; Firefox and Safari: `fn@url:1:2`.
    const match =
      /^\s*at (?:(.+?) \()?(.+?):\d+:\d+\)?$/.exec(line) ?? /^(.*?)@(.+?):\d+:\d+$/.exec(line);
    if (match === null) continue;
    const url = match[2]!;
    if (RUNTIME_FRAME.test(url) || url.includes("/@vite/") || url.includes("lumiose:")) continue;
    const name = (match[1] ?? "").replace(/^async /, "");
    let file = url;
    try {
      file = new URL(url).pathname;
    } catch {
      // Not a URL (`<anonymous>`).
    }
    file = file.replace(/^\//, "").replace(/\?.*$/, "");
    return name === "" || name === "<anonymous>" ? file : `${file} (${name})`;
  }
  return undefined;
}

/** `12 ms ago`, `3.2 s ago`. */
export function ago(time: number, now: number): string {
  const ms = Math.max(0, now - time);
  if (ms < 1000) return `${Math.round(ms)} ms ago`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s ago`;
  return `${Math.round(ms / 60_000)} min ago`;
}

/** A duration between two `performance.now()` readings, when both happened. */
export function duration(from: number | undefined, to: number | undefined): string {
  return from === undefined || to === undefined ? "–" : `${Math.max(0, to - from).toFixed(1)} ms`;
}
