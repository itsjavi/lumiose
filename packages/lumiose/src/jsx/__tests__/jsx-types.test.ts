// Type tests for `lumiose/jsx-runtime` and `lumiose/env` (TASK-42): runs TypeScript 7 on the `.fixtures`
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
 * location (config and resolution errors). The fixture program also checks the rest of `lumiose`
 * (reached through `lumiose/env`'s `declare module "lumiose"`); errors there are other areas' concern
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

  it("loads `lumiose/env` with `vite/client`: `?component` a component, bare `.svg` a URL", () => {
    const project = mkdtempSync(join(tmpdir(), "lumiose-jsx-vite-client-"));
    try {
      mkdirSync(join(project, "node_modules"));
      symlinkSync(packageDir, join(project, "node_modules/lumiose"), "junction");
      symlinkSync(
        dirname(require.resolve("vite/package.json")),
        join(project, "node_modules/vite"),
        "junction",
      );
      mkdirSync(join(project, "src"));
      writeFileSync(
        join(project, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            jsx: "preserve",
            jsxImportSource: "lumiose",
            module: "preserve",
            moduleResolution: "bundler",
            allowImportingTsExtensions: true,
            noEmit: true,
            strict: true,
            // No duplicate `*.svg` declaration between the two (decision-46), so library checks
            // stay on.
            skipLibCheck: false,
            types: ["vite/client", "lumiose/env"],
          },
          include: ["src"],
        }),
      );
      writeFileSync(
        join(project, "src/app.tsx"),
        [
          'import Icon from "./icon.svg?component";',
          'import url from "./icon.svg";',
          'import data from "./icon.svg?inline";',
          'export const icon: JSX.Element = <Icon title="Home" />;',
          "export const src: string[] = [url, data];",
          "export const hot = import.meta.hot;",
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

  it('works from a consumer project with the spec tsconfig and `types: ["lumiose/env"]`', () => {
    const project = mkdtempSync(join(tmpdir(), "lumiose-jsx-types-"));
    try {
      mkdirSync(join(project, "node_modules"));
      symlinkSync(packageDir, join(project, "node_modules/lumiose"), "junction");
      mkdirSync(join(project, "src"));
      writeFileSync(
        join(project, "tsconfig.json"),
        JSON.stringify({
          compilerOptions: {
            jsx: "preserve",
            jsxImportSource: "lumiose",
            module: "preserve",
            moduleResolution: "bundler",
            allowImportingTsExtensions: true,
            noEmit: true,
            strict: true,
            types: ["lumiose/env"],
          },
          include: ["src"],
        }),
      );
      writeFileSync(
        join(project, "src/app.tsx"),
        [
          'import type { Locals } from "lumiose";',
          "// Side-effect CSS imports are checked by TypeScript 7 (lumiose/env declares `*.css`).",
          'import "./app.css";',
          'import stylesheet from "./app.css?url";',
          "async function Greeting(props: { name: string }) {",
          "  const name = await Promise.resolve(props.name);",
          "  return <p class={{ hot: name.length > 3 }} onClick={(e) => e.currentTarget.title} onKeyDown={(e) => e.key}>{name}</p>;",
          "}",
          'export const app: JSX.Element = <Greeting name="Ada" client:visible="200px" />;',
          "export const url: string = import.meta.env.PUBLIC_URL;",
          "export const locals: Locals = {};",
          "export const href: string = stylesheet;",
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
