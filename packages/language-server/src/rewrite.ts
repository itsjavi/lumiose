// Deep URI rewriting for proxied LSP messages: every `file:` string value and object key (as in
// `WorkspaceEdit.changes`) is mapped, and text fields get embedded shadow paths rewritten.
// `data` fields are opaque round-trip payloads of the server that produced them, so they are
// never touched: TypeScript gets its own data back on `…/resolve`.

export type UriMap = (uri: string) => string | undefined;

/** Fields whose text may embed paths or links (hover markdown, messages, documentation). */
const TEXT_FIELDS = new Set(["value", "message", "detail", "documentation", "contents", "tooltip"]);

export function rewriteUris<T>(value: T, map: UriMap, mapText?: (text: string) => string): T {
  return rewrite(value, map, mapText, undefined) as T;
}

function rewrite(
  value: unknown,
  map: UriMap,
  mapText: ((text: string) => string) | undefined,
  field: string | undefined,
): unknown {
  if (typeof value === "string") {
    if (value.startsWith("file:")) return map(value) ?? value;
    if (mapText && field !== undefined && TEXT_FIELDS.has(field)) return mapText(value);
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => rewrite(item, map, mapText, field));
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const mappedKey = key.startsWith("file:") ? (map(key) ?? key) : key;
      result[mappedKey] = key === "data" ? item : rewrite(item, map, mapText, key);
    }
    return result;
  }
  return value;
}
