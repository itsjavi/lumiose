import { describe, expect, it, vi } from "vitest";
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
      url: new URL("https://example.com/a?b=1"),
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

  it("round-trips a FormData's text entries, leaving files out (TASK-430)", () => {
    const form = new FormData();
    form.append("email", "ada@example.com");
    form.append("colours", "red");
    form.append("colours", "blue");
    form.append("avatar", new Blob(["x"]), "a.png");
    expect(encodeData({ values: form }, fail)).toEqual({
      values: {
        $: "F",
        v: [
          ["email", "ada@example.com"],
          ["colours", "red"],
          ["colours", "blue"],
        ],
      },
    });
    const decoded = (roundTrip({ values: form }) as { values: FormData }).values;
    expect(decoded).toBeInstanceOf(FormData);
    expect(decoded.getAll("colours")).toEqual(["red", "blue"]);
    expect(decoded.has("avatar")).toBe(false);
  });

  it("warns in development when a FormData carries a name that looks secret (TASK-471)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const safe = new FormData();
      for (const name of ["username", "postal_code", "passport", "spinner", "email"]) {
        safe.append(name, "x");
      }
      encodeData({ values: safe }, fail);
      expect(warn).not.toHaveBeenCalled();

      const form = new FormData();
      form.append("username", "ada");
      form.append("newPassword", "hunter2");
      form.append("card-pin", "1234");
      form.append("api_key", "k");
      // Serialized as before: the warning changes nothing.
      expect(encodeData({ values: form }, fail)).toEqual({
        values: {
          $: "F",
          v: [
            ["username", "ada"],
            ["newPassword", "hunter2"],
            ["card-pin", "1234"],
            ["api_key", "k"],
          ],
        },
      });
      const messages = warn.mock.calls.map(([message]) => String(message));
      expect(messages).toHaveLength(3);
      expect(messages[0]).toContain('at values carries "newPassword"');
      expect(messages[0]).toContain("values: { username }");
      expect(messages[1]).toContain('"card-pin"');
      expect(messages[2]).toContain('"api_key"');
      // Once per name.
      encodeData(form, fail);
      expect(warn).toHaveBeenCalledTimes(3);
    } finally {
      warn.mockRestore();
    }
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
