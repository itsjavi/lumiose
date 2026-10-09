// @lumen/eslint-plugin (TASK-41): the rules report the compiler's diagnostics, the processor hands
// ESLint offset-identical masked TSX, and real oxlint loads the plugin through `jsPlugins`.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import plugin, { lumenDiagnostics } from "./index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "../../..");
const binding = await import("@lumen/compiler").catch(() => undefined);

// A frozen read (LUM2001, a warning) and a component called as a function (LUM2004, an error).
const FROZEN = `import { signal } from "lumen";
function Inner() {
  return <i />;
}
export function Counter() {
  const count = signal(0);
  const doubled = count() * 2;
  return <button onClick={() => count.set(count() + 1)}>{doubled}{Inner()}</button>;
}
`;

/** ESLint's position (1-based line, 0-based column) of `needle` in `text`, plus `shift`. */
function at(text: string, needle: string, shift = 0) {
  const offset = text.indexOf(needle) + shift;
  const before = text.slice(0, offset);
  return { line: before.split("\n").length, column: offset - (before.lastIndexOf("\n") + 1) };
}

interface Report {
  loc: { start: { line: number; column: number }; end: { line: number; column: number } };
  message: string;
}

/** Runs a rule on `text` as ESLint would, with a minimal context. */
function run(rule: keyof typeof plugin.rules, text: string, filename: string): Report[] {
  const reports: Report[] = [];
  const visitor = plugin.rules[rule].create({
    filename,
    sourceCode: { text },
    report: (descriptor) => reports.push(descriptor),
  });
  visitor.Program();
  return reports;
}

describe.skipIf(!binding)("rules", () => {
  it("reports the compiler's errors and warnings at their positions, with help and docs", () => {
    const errors = run("compiler", FROZEN, "/p/src/Counter.tsx");
    expect(errors).toEqual([
      {
        loc: { start: at(FROZEN, "{Inner()}", 1), end: expect.any(Object) },
        message: expect.stringMatching(/^LUM2004: [\s\S]*\(lumen docs errors\/LUM2004\)$/),
      },
    ]);
    const warnings = run("compiler-warnings", FROZEN, "/p/src/Counter.tsx");
    expect(warnings.map((report) => [report.message.slice(0, 7), report.loc.start])).toEqual([
      ["LUM2001", at(FROZEN, "doubled = count()")],
    ]);
  });

  it("ignores files the compiler does not handle and leaves syntax errors to the parser", () => {
    expect(run("compiler", FROZEN, "/p/src/counter.ts")).toEqual([]);
    expect(lumenDiagnostics("export const = ;", "/p/src/Broken.tsx")).toEqual([]);
  });
});

describe.skipIf(!binding)("stsx processor", () => {
  it("lints the masked TSX with the source's offsets, and the rules read the source", () => {
    const source = FROZEN.replace("</button>;", `<style>button { color: red; }</style></button>;`);
    const file = "/p/src/Counter.stsx";
    const [block] = plugin.processors.stsx.preprocess(source, file);
    expect(block!.filename).toBe("component.tsx");
    expect(block!.text).toHaveLength(source.length);
    expect(block!.text).not.toContain("color: red");
    // While the file is processed, the rule compiles the source, not the masked text.
    const reports = run("compiler", block!.text, file);
    expect(reports.map((report) => report.message.slice(0, 7))).toEqual(["LUM2004"]);
    const messages = plugin.processors.stsx.postprocess([[{ ruleId: "lumen/compiler" }]], file);
    expect(messages).toEqual([{ ruleId: "lumen/compiler" }]);
  });

  it("is wired by the recommended flat config", () => {
    const [stsx, tsx] = plugin.configs["recommended"] as { files: string[] }[];
    expect(stsx).toMatchObject({ files: ["**/*.stsx"], processor: "lumen/stsx" });
    expect(tsx).toMatchObject({
      files: ["**/*.tsx", "**/*.stsx/*.tsx"],
      rules: { "lumen/compiler": "error", "lumen/compiler-warnings": "warn" },
    });
  });
});

describe.skipIf(!binding)("oxlint", () => {
  const dir = mkdtempSync(join(tmpdir(), "lumen-oxlint-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("loads the plugin through jsPlugins and reports compiler diagnostics in .tsx files", () => {
    writeFileSync(
      join(dir, ".oxlintrc.json"),
      JSON.stringify({
        jsPlugins: [join(here, "index.ts")],
        rules: { "lumen/compiler": "error", "lumen/compiler-warnings": "warn" },
      }),
    );
    writeFileSync(join(dir, "Counter.tsx"), FROZEN);
    let output = "";
    try {
      // oxlint's JS bin through Node: `.bin/oxlint` is a shell shim on Windows.
      const oxlint = join(repo, "node_modules/oxlint/bin/oxlint");
      execFileSync(process.execPath, [oxlint, "--format", "unix", "."], {
        cwd: dir,
        encoding: "utf8",
      });
    } catch (error) {
      output = (error as { stdout: string }).stdout;
    }
    const error = at(FROZEN, "{Inner()}", 1);
    expect(output).toContain(`Counter.tsx:${error.line}:${error.column + 1}`);
    expect(output).toContain("LUM2004");
    expect(output).toContain("LUM2001");
  });
});
