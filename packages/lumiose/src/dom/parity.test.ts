// The `lumiose` entry exposes the same names in the browser and under the `node` condition, so code
// (and its types, which resolve through the browser entry) works in both (contract doc-2 §2-3).
import { describe, expect, it } from "vitest";
import * as browser from "../index.ts";
import * as server from "../index.server.ts";

describe("lumiose entry parity", () => {
  it("exports the same names from the browser and node entries", () => {
    expect(Object.keys(browser).toSorted()).toEqual(Object.keys(server).toSorted());
  });

  it("throws LUM4003 from the server-only render functions in the browser", () => {
    expect(() => browser.renderToString(() => null)).toThrow(
      /renderToString\(\) is server-only.*LUM4003/,
    );
    expect(() => browser.renderToStream(() => null)).toThrow(
      /renderToStream\(\) is server-only.*LUM4003/,
    );
  });

  it("gives the server isBusy(), isPending() and resource() their request-time behavior", () => {
    expect(server.isBusy()).toBe(false);
    expect(server.isPending()).toBe(false);
    const r = server.resource(() => 1);
    expect([r(), r.loading(), r.error()]).toEqual([undefined, true, undefined]);
  });
});
