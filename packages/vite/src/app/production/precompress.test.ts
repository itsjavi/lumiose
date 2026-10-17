import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { precompress, startPrecompress } from "./precompress.ts";

const BIG = `body { color: red; }\n`.repeat(200);

describe("precompress", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "lumiose-precompress-"));
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

  it("compresses early files in the background, then new and changed ones (TASK-288)", async () => {
    const root = mkdtempSync(join(tmpdir(), "lumiose-precompress-"));
    try {
      const write = (name: string, content: string) => {
        mkdirSync(dirname(join(root, name)), { recursive: true });
        writeFileSync(join(root, name), content);
      };
      const brOf = (name: string) =>
        brotliDecompressSync(readFileSync(join(root, `${name}.br`))).toString();
      const files = Array.from({ length: 9 }, (_, i) => `assets/chunk-${i}.js`);
      for (const [i, name] of files.entries())
        write(name, `export const n${i} = 1;\n`.repeat(100 * (i + 1)));
      write("assets/changes.css", BIG);
      write("assets/stops.css", BIG);
      const started = startPrecompress(root, [...files, "assets/changes.css", "assets/stops.css"]);
      // Written while the early pass runs: a prerendered page, and two early files changed.
      write("index.html", `<p>${"home ".repeat(400)}</p>`);
      // The early pass has compressed both before they change.
      while (
        !["changes", "stops"].every((name) => existsSync(join(root, `assets/${name}.css.gz`)))
      ) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      const changed = `${BIG}a { color: blue; }\n`;
      write("assets/changes.css", changed);
      // Random bytes do not compress: the earlier copies would be stale.
      writeFileSync(join(root, "assets/stops.css"), randomBytes(4096));
      const result = await started.finish();
      for (const [i, name] of files.entries()) {
        expect(brOf(name)).toBe(`export const n${i} = 1;\n`.repeat(100 * (i + 1)));
      }
      expect(brOf("index.html")).toContain("home home");
      expect(brOf("assets/changes.css")).toBe(changed);
      expect(gunzipSync(readFileSync(join(root, "assets/changes.css.gz"))).toString()).toBe(
        changed,
      );
      expect(existsSync(join(root, "assets/stops.css.br"))).toBe(false);
      expect(existsSync(join(root, "assets/stops.css.gz"))).toBe(false);
      // Each file counts once, as it is now.
      expect(result.files).toBe(files.length + 2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
