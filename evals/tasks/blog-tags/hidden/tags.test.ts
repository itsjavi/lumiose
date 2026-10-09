import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Dev, lumen, root, startDev, text } from "./helpers.ts";

let dev: Dev;
beforeAll(async () => {
  dev = await startDev();
});
afterAll(() => dev?.stop());

const links = (html: string) =>
  [...(/<main[\s\S]*<\/main>|<body[\s\S]*<\/body>/.exec(html)?.[0] ?? html).matchAll(/<a\b[^>]*href="?([^"\s>]+)"?[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => ({ href: m[1]!, text: text(m[2]!) }))
    .filter((link) => link.href.startsWith("/blog/"));

describe("tag pages", () => {
  it("lists the posts of a tag, newest first", async () => {
    const response = await dev.get("/tags/lumen");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "")).toBe("Posts tagged “lumen”");
    expect(links(html)).toEqual([
      { href: "/blog/adding-pages", text: "Adding pages" },
      { href: "/blog/hello-lumen", text: "Hello, Lumen" },
    ]);
  });

  it("works for a single-post tag", async () => {
    const html = await (await dev.get("/tags/css")).text();
    expect(links(html)).toEqual([{ href: "/blog/styling", text: "Styling components" }]);
  });

  it("is a 404 for an unknown tag", async () => {
    const response = await dev.get("/tags/unknown-tag");
    expect(response.status).toBe(404);
  });

  it("prerenders every tag", () => {
    const build = lumen(["build"]);
    expect(build.code, build.stderr).toBe(0);
    for (const tag of ["lumen", "intro", "routing", "css"]) {
      const file = ["dist/client/tags", tag, "index.html"].join("/");
      const alt = `dist/client/tags/${tag}.html`;
      const path = existsSync(join(root, file)) ? file : alt;
      expect(existsSync(join(root, path)), `${file} or ${alt}`).toBe(true);
      expect(readFileSync(join(root, path), "utf8")).toContain(`Posts tagged “${tag}”`);
    }
  });
});
