import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Dev, islands, startDev, text } from "./helpers.ts";

let dev: Dev;
beforeAll(async () => {
  dev = await startDev();
});
afterAll(() => dev?.stop());

describe("like button on post pages", () => {
  for (const [slug, likes] of [
    ["hello-lumiose", 12],
    ["adding-pages", 3],
  ] as const) {
    it(`is an idle island with the likes of ${slug}`, async () => {
      const html = await (await dev.get(`/blog/${slug}`)).text();
      const records = islands(html);
      expect(records).toHaveLength(1);
      expect(records[0]!.ref).toMatch(/\/src\/components\/LikeButton\.stsx#LikeButton$/);
      expect(records[0]!.strategy).toBe("idle");
      expect(records[0]!.props).toEqual({ count: likes });
      const button = /<button\b[^>]*>[\s\S]*?<\/button>/.exec(html)?.[0] ?? "";
      expect(text(button)).toBe(`♥ ${likes}`);
      expect(button).toMatch(/aria-pressed="?false"?/);
    });
  }
});
