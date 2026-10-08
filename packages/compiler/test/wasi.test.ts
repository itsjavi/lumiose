// The WASI fallback (`pnpm --filter @lumen/compiler build:wasm`): same results as the native
// addon. Skipped until the wasm artifact is built (it is not checked in).
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const wasm = resolve(import.meta.dirname, "../compiler.wasm32-wasi.wasm");
const native = await import("../index.js").catch(() => undefined);

describe.skipIf(!existsSync(wasm) || !native)("WASI fallback", () => {
  it("compiles like the native addon", () => {
    const wasi = createRequire(import.meta.url)("../compiler.wasi.cjs") as typeof native;
    const source = `import { signal } from "lumen";
export function Counter() {
  const count = signal(0);
  return <button onClick={() => count.set(count() + 1)}>Clicked {count()} times</button>;
}`;
    for (const target of ["client", "server"] as const) {
      const expected = native!.compile(source, "/src/Counter.tsx", { target });
      const actual = wasi!.compile(source, "/src/Counter.tsx", { target });
      expect(actual.code).toBe(expected.code);
      expect(actual.map).toBe(expected.map);
      expect(actual.diagnostics).toEqual(expected.diagnostics);
    }
  });

  it("compiles style blocks like the native addon (Lightning CSS, browserslist)", () => {
    const wasi = createRequire(import.meta.url)("../compiler.wasi.cjs") as typeof native;
    const source = `const gap = 4;
export const A = () => <p class="a">x<style>.a { margin: calc($gap * 2px); & b { color: red } }</style></p>;`;
    const options = { cssTargets: ["safari 15"], cssMinify: true };
    const expected = native!.compile(source, "/src/A.stsx", options);
    const actual = wasi!.compile(source, "/src/A.stsx", options);
    expect(expected.css).toContain("margin:8px");
    expect(actual.css).toBe(expected.css);
    expect(actual.cssMap).toBe(expected.cssMap);
  });
});
