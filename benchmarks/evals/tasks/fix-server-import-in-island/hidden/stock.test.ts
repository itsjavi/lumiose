import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkCodes, type Dev, islands, lumiose, source, startDev, text } from "./helpers.ts";

let dev: Dev;
beforeAll(async () => {
  dev = await startDev();
});
afterAll(() => dev?.stop());

describe("stock", () => {
  it("serves the stock endpoint", async () => {
    const ok = await dev.get("/api/stock/TEA-1");
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ sku: "TEA-1", stock: 7 });
    expect(await (await dev.get("/api/stock/TEA-2")).json()).toEqual({ sku: "TEA-2", stock: 0 });
    const missing = await dev.get("/api/stock/NOPE");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "unknown sku" });
  });

  it("renders the stock in the product page HTML, inside the island", async () => {
    const response = await dev.get("/products/MUG-1");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(text(html)).toContain("In stock: 42");
    const records = islands(html);
    expect(records.map((r) => r.ref.split("#")[1])).toContain("StockBadge");
  });

  it("keeps server code out of the island", () => {
    expect(checkCodes()).not.toContain("LUM4003");
    const island = source("src/components/StockBadge.stsx");
    expect(island).not.toMatch(/\.server(\.ts)?["']|\/server\//);
    expect(island).toMatch(/\/api\/stock/);
  });

  it("builds", () => {
    const build = lumiose(["build"]);
    expect(build.code, build.stderr).toBe(0);
  });
});
