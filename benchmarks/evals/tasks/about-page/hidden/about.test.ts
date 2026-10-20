import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Dev, source, startDev, text } from "./helpers.ts";

let dev: Dev;
beforeAll(async () => {
  dev = await startDev();
});
afterAll(() => dev?.stop());

const navLinks = (html: string) => {
  const header = /<header[\s\S]*?<\/header>/.exec(html)?.[0] ?? "";
  return [...header.matchAll(/<a\b[^>]*href="?([^"\s>]+)"?[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({
    href: m[1],
    text: text(m[2]!),
  }));
};

describe("about page", () => {
  it("serves /about with its heading", async () => {
    const response = await dev.get("/about");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "")).toBe("About this site");
  });

  for (const path of ["/", "/about"]) {
    it(`shows the navigation on ${path}`, async () => {
      const html = await (await dev.get(path)).text();
      const links = navLinks(html);
      expect(links).toContainEqual({ href: "/", text: "Home" });
      expect(links).toContainEqual({ href: "/about", text: "About" });
    });
  }

  it("keeps the home page", async () => {
    expect((await dev.get("/")).status).toBe(200);
  });

  it("builds the navigation URLs with href()", () => {
    const files = execSync("git ls-files --cached --others --exclude-standard src", {
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);
    const all = files.map((file) => source(file)).join("\n");
    expect(all).toMatch(/href\(\s*["']\/about["']/);
  });
});
