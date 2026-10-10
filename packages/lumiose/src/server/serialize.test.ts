import { describe, expect, it } from "vitest";
import { decodeData, encodeData } from "./serialize.ts";

const fail = (path: string, reason: string): never => {
  throw new Error(`${path || "<root>"}: ${reason}`);
};
const roundTrip = (value: unknown) =>
  decodeData(JSON.parse(JSON.stringify(encodeData(value, fail))));

describe("data-only serialization", () => {
  it("keeps JSON values as plain JSON", () => {
    const value = { a: [1, "two", true, null], b: { c: 1.5 } };
    expect(encodeData(value, fail)).toEqual(value);
  });

  it("round-trips tagged values", () => {
    const value = {
      date: new Date("2026-10-08T12:00:00.000Z"),
      invalid: new Date(Number.NaN),
      url: new URL("https://lumiose.dev/a?b=1"),
      map: new Map<unknown, unknown>([
        ["k", new Set([1n])],
        [2, { d: new Date(0) }],
      ]),
      numbers: [Number.NaN, Infinity, -Infinity, -0, undefined],
      $: "dollar key",
      nested: { $: { $: 1 } },
    };
    const decoded = roundTrip(value) as typeof value;
    expect(decoded).toEqual(value);
    expect(Object.is(decoded.numbers[3], -0)).toBe(true);
    expect(decoded.numbers).toHaveLength(5);
  });

  it("omits undefined properties like JSON", () => {
    expect(encodeData({ a: undefined, b: 1 }, fail)).toEqual({ b: 1 });
  });

  it("rejects non-data with the path", () => {
    expect(() => encodeData({ a: [{ b: () => 1 }] }, fail)).toThrow("a[0].b: a function");
    expect(() => encodeData({ "x-y": Symbol("s") }, fail)).toThrow('["x-y"]: a symbol');
    expect(() => encodeData({ res: new Response() }, fail)).toThrow(
      ".res: an instance of Response",
    );
    expect(() => encodeData(Promise.resolve(1), fail)).toThrow("<root>: an instance of Promise");
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(() => encodeData(cycle, fail)).toThrow(".self: a circular reference");
  });

  it("allows shared references that are not cycles", () => {
    const shared = { v: 1 };
    expect(roundTrip([shared, shared])).toEqual([{ v: 1 }, { v: 1 }]);
  });

  it("keeps a __proto__ key as data", () => {
    const value = JSON.parse('{"__proto__": {"polluted": true}}');
    const decoded = roundTrip(value) as Record<string, unknown>;
    expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
    expect(Object.hasOwn(decoded, "__proto__")).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
