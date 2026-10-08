// Data-only serialization for island props and await records (decision-9, spec §6.4).
//
// The output is plain JSON: nothing is evaluated when decoding. Values JSON cannot represent are
// tagged objects keyed by "$":
//   { $: "u" }                        undefined (array items and top-level values)
//   { $: "N", v: "NaN" | "Infinity" | "-Infinity" | "-0" }
//   { $: "B", v: "123" }              BigInt
//   { $: "D", v: "2026-10-08T…Z" }    Date (v is null for an invalid date)
//   { $: "U", v: "https://…" }        URL
//   { $: "M", v: [[key, value], …] }  Map
//   { $: "S", v: [value, …] }         Set
//   { $: "O", v: { … } }              a plain object that has its own "$" key (escaped)
// Object properties whose value is undefined are omitted, as in JSON. Anything else (functions,
// symbols, class instances, promises, cycles) is rejected with the path of the offending value.
//
// `decodeData` is isomorphic and dependency-free so the island loader (TASK-18) can reuse it.

type Fail = (path: string, reason: string) => never;

export function encodeData(input: unknown, fail: Fail): unknown {
  const ancestors = new Set<object>();

  const walk = (value: unknown, path: string): unknown => {
    switch (typeof value) {
      case "string":
      case "boolean":
        return value;
      case "number":
        if (Number.isFinite(value) && !Object.is(value, -0)) return value;
        return { $: "N", v: Object.is(value, -0) ? "-0" : String(value) };
      case "undefined":
        return { $: "u" };
      case "bigint":
        return { $: "B", v: value.toString() };
      case "object":
        break;
      default:
        return fail(path, `a ${typeof value}`);
    }
    if (value === null) return null;
    if (ancestors.has(value)) return fail(path, "a circular reference");
    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        const out: unknown[] = [];
        for (let i = 0; i < value.length; i++) out.push(walk(value[i], `${path}[${i}]`));
        return out;
      }
      const proto = Object.getPrototypeOf(value);
      if (proto === Object.prototype || proto === null) {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(value)) {
          const item = (value as Record<string, unknown>)[key];
          if (item !== undefined) setOwn(out, key, walk(item, `${path}${propertyPath(key)}`));
        }
        return Object.hasOwn(out, "$") ? { $: "O", v: out } : out;
      }
      if (value instanceof Date) {
        return { $: "D", v: Number.isNaN(value.getTime()) ? null : value.toISOString() };
      }
      if (value instanceof URL) return { $: "U", v: value.href };
      if (value instanceof Map) {
        let i = 0;
        const entries: unknown[] = [];
        for (const [key, item] of value) {
          entries.push([walk(key, `${path}<map key ${i}>`), walk(item, `${path}<map value ${i}>`)]);
          i++;
        }
        return { $: "M", v: entries };
      }
      if (value instanceof Set) {
        let i = 0;
        const items: unknown[] = [];
        for (const item of value) items.push(walk(item, `${path}<set item ${i++}>`));
        return { $: "S", v: items };
      }
      const name = (proto as { constructor?: { name?: string } } | null)?.constructor?.name;
      return fail(path, name ? `an instance of ${name}` : "a non-plain object");
    } finally {
      ancestors.delete(value);
    }
  };

  return walk(input, "");
}

function propertyPath(key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
}

/** Inverse of `encodeData`, applied to the result of `JSON.parse`. */
export function decodeData(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) return value.map(decodeData);
  const record = value as Record<string, unknown>;
  if (!Object.hasOwn(record, "$")) return decodeObject(record);
  const v = record.v;
  switch (record.$) {
    case "u":
      return undefined;
    case "N":
      return v === "-0" ? -0 : Number(v);
    case "B":
      return BigInt(v as string);
    case "D":
      return new Date(v === null ? Number.NaN : (v as string));
    case "U":
      return new URL(v as string);
    case "M":
      return new Map((v as [unknown, unknown][]).map(([k, x]) => [decodeData(k), decodeData(x)]));
    case "S":
      return new Set((v as unknown[]).map(decodeData));
    case "O":
      return decodeObject(v as Record<string, unknown>);
    default:
      throw new Error(`Unknown serialized tag ${JSON.stringify(record.$)}.`);
  }
}

function decodeObject(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(record)) setOwn(out, key, decodeData(record[key]));
  return out;
}

/** Assigns an own property, also for "__proto__" (which plain assignment would treat as the prototype). */
function setOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  if (key === "__proto__") {
    Object.defineProperty(target, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  } else {
    target[key] = value;
  }
}
