import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkCodes, type Dev, lumen, startDev, text } from "./helpers.ts";

let dev: Dev;
beforeAll(async () => {
  dev = await startDev();
});
afterAll(() => dev?.stop());

describe("theme toggle on the server", () => {
  it("renders the page", async () => {
    const response = await dev.get("/");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(text(/<button\b[^>]*>([\s\S]*?)<\/button>/.exec(html)?.[1] ?? "")).toBe("Theme: light");
  });

  it("has no browser APIs at module scope", () => {
    expect(checkCodes()).not.toContain("LUM4004");
  });

  it("builds", () => {
    const build = lumen(["build"]);
    expect(build.code, build.stderr).toBe(0);
  });
});
