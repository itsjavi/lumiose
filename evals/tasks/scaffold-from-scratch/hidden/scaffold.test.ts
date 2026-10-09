import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Dev, lumen, root, startDev, text } from "./helpers.ts";

let dev: Dev;
beforeAll(async () => {
  dev = await startDev();
});
afterAll(() => dev?.stop());

describe("scaffolded app", () => {
  it("serves the home page in dev", async () => {
    const response = await dev.get("/");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(text(/<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? "")).toBe("Hello");
    expect(text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "")).toBe("Hello Lumen");
  });

  it("has the package scripts", () => {
    const { scripts = {} } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(scripts.dev).toMatch(/\blumen dev\b/);
    expect(scripts.build).toMatch(/\blumen build\b/);
    expect(scripts.check).toMatch(/\blumen check\b/);
  });

  it("prerenders the home page", () => {
    const build = lumen(["build"]);
    expect(build.code, build.stderr).toBe(0);
    const file = join(root, "dist/client/index.html");
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toContain("Hello Lumen");
  });
});
