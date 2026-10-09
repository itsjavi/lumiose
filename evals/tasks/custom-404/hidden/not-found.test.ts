import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Dev, startDev, text } from "./helpers.ts";

let dev: Dev;
beforeAll(async () => {
  dev = await startDev();
});
afterAll(() => dev?.stop());

const anchors = (html: string) =>
  [...html.matchAll(/<a\b[^>]*href="?([^"\s>]+)"?[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1], text: text(m[2]!) }));

describe("not-found page", () => {
  for (const path of ["/nope", "/a/b/c"]) {
    it(`renders ${path} as a 404 inside the layout`, async () => {
      const response = await dev.get(path);
      expect(response.status).toBe(404);
      const html = await response.text();
      expect(text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "")).toBe("Page not found");
      expect(html).toMatch(/<div\b[^>]*class="?site"?/);
      const header = /<header[\s\S]*?<\/header>/.exec(html)?.[0] ?? "";
      expect(anchors(header)).toContainEqual({ href: "/", text: "Home" });
      expect(anchors(html)).toContainEqual({ href: "/", text: "Go to the home page" });
    });
  }

  it("keeps the home page in the layout", async () => {
    const response = await dev.get("/");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toMatch(/<div\b[^>]*class="?site"?/);
    expect(text(html)).not.toContain("Page not found");
  });
});
