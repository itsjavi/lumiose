import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Dev, islands, startDev, text } from "./helpers.ts";

let dev: Dev;
beforeAll(async () => {
  dev = await startDev();
});
afterAll(() => dev?.stop());

const results = (html: string) => {
  const list = /<ul\b[^>]*class="?results"?[^>]*>([\s\S]*?)<\/ul>/.exec(html)?.[1];
  return list === undefined ? null : [...list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]!));
};

describe("search page", () => {
  it("lists matching products", async () => {
    const response = await dev.get("/search?q=tea");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(results(html)).toEqual(["Green tea — 4.50 €", "Black tea — 3.90 €", "Tea mug — 12.00 €"]);
    expect(html).toMatch(/<input\b[^>]*name="?q"?[^>]*value="?tea"?|<input\b[^>]*value="?tea"?[^>]*name="?q"?/);
  });

  it("has a GET form to /search", async () => {
    const html = await (await dev.get("/search")).text();
    const form = /<form\b[^>]*>/.exec(html)?.[0] ?? "";
    expect(form).toMatch(/action="?\/search"?/);
    expect(form).not.toMatch(/method="?post"?/i);
  });

  it("says when nothing matches", async () => {
    const html = await (await dev.get("/search?q=pizza")).text();
    expect(results(html)).toBeNull();
    expect(text(html)).toContain("No products match “pizza”.");
  });

  it("asks for a query when there is none", async () => {
    for (const path of ["/search", "/search?q="]) {
      const html = await (await dev.get(path)).text();
      expect(results(html)).toBeNull();
      expect(text(html)).toContain("Type something to search.");
    }
  });

  it("ships no islands", async () => {
    expect(islands(await (await dev.get("/search?q=tea")).text())).toEqual([]);
  });
});
