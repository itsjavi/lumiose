import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkCodes, type Dev, islands, startDev, text } from "./helpers.ts";

let dev: Dev;
beforeAll(async () => {
  dev = await startDev();
});
afterAll(() => dev?.stop());

describe("price editor island", () => {
  it("is an island with serializable props only", async () => {
    const response = await dev.get("/");
    expect(response.status).toBe(200);
    const html = await response.text();
    const records = islands(html);
    expect(records).toHaveLength(1);
    expect(records[0]!.ref).toMatch(/PriceEditor\.stsx#PriceEditor$/);
    expect(records[0]!.props).toEqual({ initial: 9.5 });
    expect(text(/<output[^>]*>([\s\S]*?)<\/output>/.exec(html)?.[1] ?? "")).toBe("9.50 €");
  });

  it("has no non-serializable island props", () => {
    expect(checkCodes()).not.toContain("LUM4002");
  });
});
