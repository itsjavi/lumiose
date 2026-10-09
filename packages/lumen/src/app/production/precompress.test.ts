import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { precompress } from "./precompress.ts";

const BIG = `body { color: red; }\n`.repeat(200);

describe("precompress", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "lumen-precompress-"));
    const files: Record<string, string> = {
      "assets/app.css": BIG,
      "about/index.html": `<p>${"about ".repeat(400)}</p>`,
      "assets/tiny.js": "console.log(1)",
      "logo.png": "x".repeat(4000),
    };
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, name)), { recursive: true });
      writeFileSync(join(dir, name), content);
    }
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("writes .br and .gz copies of compressible files of at least 1 kB", async () => {
    const result = await precompress(dir);
    expect(result.files).toBe(2);
    const css = join(dir, "assets/app.css");
    expect(brotliDecompressSync(readFileSync(`${css}.br`)).toString()).toBe(BIG);
    expect(gunzipSync(readFileSync(`${css}.gz`)).toString()).toBe(BIG);
    expect(existsSync(join(dir, "about/index.html.br"))).toBe(true);
    expect(existsSync(join(dir, "assets/tiny.js.br"))).toBe(false);
    expect(existsSync(join(dir, "logo.png.br"))).toBe(false);
    expect(result.brotliBytes).toBeLessThan(result.bytes);
  });
});
