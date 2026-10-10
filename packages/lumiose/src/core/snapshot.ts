// Deep copies of plain data (spec §4.3), shared by `snapshot()` in the browser (./store.ts, which
// reads through store proxies) and on the server (./server.ts, where stores are plain objects).

/**
 * Copies plain objects and arrays deeply, reading each value through `raw` (which unwraps store
 * proxies). Other values (Dates, Maps, class instances, functions) are kept as they are; shared
 * and circular references stay shared and circular in the copy.
 */
export function copyPlain<T>(value: T, raw: (value: unknown) => unknown): T {
  const copies = new Map<object, unknown>();
  const copy = (input: unknown): unknown => {
    const source = raw(input);
    if (source === null || typeof source !== "object") return source;
    const done = copies.get(source);
    if (done !== undefined) return done;
    if (Array.isArray(source)) {
      const out: unknown[] = [];
      copies.set(source, out);
      for (let i = 0; i < source.length; i++) out[i] = copy(source[i]);
      return out;
    }
    const proto: unknown = Object.getPrototypeOf(source);
    if (proto !== Object.prototype && proto !== null) return source;
    const out: Record<string, unknown> = proto === null ? Object.create(null) : {};
    copies.set(source, out);
    for (const key of Object.keys(source))
      out[key] = copy((source as Record<string, unknown>)[key]);
    return out;
  };
  return copy(value) as T;
}
