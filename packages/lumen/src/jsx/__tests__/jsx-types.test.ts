// Type tests for `lumen/jsx-runtime` and `lumen/env` (TASK-42): runs TypeScript 7 on the `.fixtures`
// project, whose files hold accepted cases and `// @ts-expect-error` rejected cases, so a rejected
// case that starts type-checking fails as an unused directive.
//
// `.fixtures` is a dot-directory so the package tsconfig (`include: ["src"]`, no `jsx` option) skips
// it; the fixture tsconfig lists its files explicitly for the same reason.
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const jsxDir = resolve(here, "..");
const packageDir = resolve(jsxDir, "../..");
const require = createRequire(import.meta.url);
const tscBin = join(dirname(require.resolve("typescript/package.json")), "bin/tsc");

function tsc(project: string) {
  const result = spawnSync(process.execPath, [tscBin, "-p", project, "--pretty", "false"], {
    encoding: "utf8",
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}`.trim() };
}

/**
 * Diagnostics that belong to the JSX types: located in src/jsx (sources and fixtures), or without a
 * location (config and resolution errors). The fixture program also checks the rest of `lumen`
 * (reached through `lumen/env`'s `declare module "lumen"`); errors there are other areas' concern
 * and are reported by `pnpm typecheck`.
 */
function jsxDiagnostics(output: string, cwd: string): string[] {
  return output
    .split("\n")
    .filter((line) => /error TS\d+:/.test(line))
    .filter((line) => {
      const located = /^(.+?)\(\d+,\d+\): error TS/.exec(line);
      if (!located?.[1]) return true;
      return !relative(jsxDir, resolve(cwd, located[1])).startsWith("..");
    });
}

describe("JSX types (TypeScript 7)", () => {
  it("accepts and rejects the fixture cases", () => {
    const { status, output } = tsc(join(here, ".fixtures/tsconfig.json"));
    expect(jsxDiagnostics(output, process.cwd()), output).toEqual([]);
    // A failing run must have reported located diagnostics outside src/jsx, never crashed silently.
    if (status !== 0) expect(output).toMatch(/\(\d+,\d+\): error TS/);
  });

  it('works from a consumer project with the spec tsconfig and `types: ["lumen/env"]`', () => {
    const project = mkdtempSync(join(tmpdir(), "lumen-jsx-types-"));
    try {
      mkdirSync(join(project, "node_modules"));
      symlinkSync(packageDir, join(project, "node_modules/lumen"), "junction");
      mkdirSync(join(project, "src"));
      writeFileSync(
        join(project, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            jsx: "preserve",
            jsxImportSource: "lumen",
            module: "preserve",
            moduleResolution: "bundler",
            allowImportingTsExtensions: true,
            noEmit: true,
            strict: true,
            types: ["lumen/env"],
          },
          include: ["src"],
        }),
      );
      writeFileSync(
        join(project, "src/app.tsx"),
        [
          'import type { Locals } from "lumen";',
          "async function Greeting(props: { name: string }) {",
          "  const name = await Promise.resolve(props.name);",
          "  return <p class={{ hot: name.length > 3 }} onClick={(e) => e.currentTarget.title}>{name}</p>;",
          "}",
          'export const app: JSX.Element = <Greeting name="Ada" client:visible="200px" />;',
          "export const url: string = import.meta.env.PUBLIC_URL;",
          "export const locals: Locals = {};",
          "// @ts-expect-error <style> blocks belong in .stsx files.",
          "export const style = <style>{'p { color: red }'}</style>;",
          "",
        ].join("\n"),
      );
      const { status, output } = tsc(join(project, "tsconfig.json"));
      expect(output).toBe("");
      expect(status).toBe(0);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
