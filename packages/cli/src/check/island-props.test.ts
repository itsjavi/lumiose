// LUM4002 at check time (TASK-119): `lumiose check` reports TypeScript's island-prop errors (from the
// `lumiose/jsx-runtime` types) as LUM4002 on the prop. The fixture project is checked with the real
// scanner and TypeScript 7, like check.test.ts.
import { linkLumiose } from "@lumiose/vite/internal/test-links.ts";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { main } from "../main.ts";
import { islandPropProblem, islandPropRange, tsconfigTemplate, type CheckReport } from "./index.ts";
import { SourceText } from "./text.ts";

const here = dirname(fileURLToPath(import.meta.url));
const typescriptDir = dirname(createRequire(import.meta.url).resolve("typescript/package.json"));
const binding = await import("@lumiose/compiler").catch(() => undefined);

let root: string | undefined;
afterAll(async () => {
  if (root) await rm(root, { recursive: true, force: true });
});

describe("islandPropProblem", () => {
  it("reads the prop, the path and the kind from TypeScript's chain", () => {
    expect(
      islandPropProblem(
        "Type '{ x: 1; }' is not assignable to type 'A'.\n" +
          "Types of property 'onDone' are incompatible.\n" +
          "  Type '() => void' is not assignable to type 'NotSerializable<\"a function\">'.",
      ),
    ).toEqual({ prop: "onDone", path: "onDone", what: "a function" });
    expect(
      islandPropProblem(
        "The types of 'tool.use' are incompatible between these types.\n" +
          "  Type '() => void' is not assignable to type 'NotSerializable<\"a function\">'.",
      ),
    ).toEqual({ prop: "tool", path: "tool.use", what: "a function" });
    expect(islandPropProblem("Type 'string' is not assignable to type 'number'.")).toBeUndefined();
  });
});

describe("islandPropRange", () => {
  it("finds the attribute on the element, skipping attribute values", () => {
    const text = '<A b={<A onDone={x} />} c="onDone=" onDone={() => {}} />';
    const range = islandPropRange(text, 1, "onDone")!;
    expect(range.start).toBe(text.lastIndexOf("onDone"));
    expect(text.slice(range.start, range.end)).toBe("onDone");
    expect(islandPropRange(text, 1, "missing")).toBeUndefined();
  });
});

describe.skipIf(!binding)("lumiose check: LUM4002", () => {
  it("reports non-serializable island props on the prop, in .stsx and .tsx files", async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), "lumiose-check-islands-")));
    await cp(join(here, "__fixtures__/islands/src"), join(root, "src"), { recursive: true });
    await mkdir(join(root, "node_modules"));
    linkLumiose(root);
    await symlink(typescriptDir, join(root, "node_modules/typescript"), "junction");
    await writeFile(join(root, "tsconfig.json"), JSON.stringify(tsconfigTemplate()));

    let stdout = "";
    const exitCode = await main(["check", "--root", root, "--format", "json"], {
      cwd: root,
      color: false,
      write: (text) => void (stdout += text),
      writeError: () => {},
    });
    const report = JSON.parse(stdout) as CheckReport;
    const at = async (file: string, needle: string, token: string) => {
      const text = await readFile(join(root!, file), "utf8");
      const start = new SourceText(text).positionAt(text.indexOf(needle));
      return {
        file,
        line: start.line,
        column: start.column,
        endLine: start.line,
        endColumn: start.column + token.length,
      };
    };

    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        ...(await at("src/components/Gallery.tsx", "images={[{", "images")),
        source: "lumiose",
        code: "LUM4002",
        severity: "error",
        message:
          "Island prop `images` is not serializable: `images.load` is a function. Island props are sent to the browser as data.",
        docs: "errors/LUM4002",
      }),
      expect.objectContaining({
        ...(await at("src/components/Toolbar.stsx", "onClick={save} />\n      <Picker", "onClick")),
        code: "LUM4002",
        message:
          "Island prop `onClick` is not serializable: it is a function. Island props are sent to the browser as data.",
        help: expect.stringContaining("drop the `client:*` directive"),
      }),
      expect.objectContaining({
        ...(await at("src/components/Toolbar.stsx", "tool={", "tool")),
        code: "LUM4002",
        message: expect.stringContaining("`tool.use` is a function"),
      }),
    ]);
    expect(exitCode).toBe(1);
  });
});
