// `lumiose lint` (TASK-31): real oxlint on temp projects (outside any git repo), real scanner.
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { CheckDiagnostic, CheckReport } from "../check/index.ts";
import { main } from "../main.ts";
import { lint, type Stylelint } from "./index.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);

const roots: string[] = [];
afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function project(files: Record<string, string>): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "lumiose-lint-")));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

const OXLINT_CONFIG = JSON.stringify({
  // Comments and trailing commas are fine (JSONC).
  categories: { correctness: "error" },
  rules: { "no-undef": "error" },
  ignorePatterns: ["**/.lumiose/**", "src/ignored/**"],
  overrides: [{ files: ["src/components/**"], rules: { "no-debugger": "warn" } }],
});

const LINT_STSX = `import { tokens } from "../tokens.ts";

const gap = 8;
const unused = 1;

<style>
  .x { content: "→→→"; margin: $gap; color: $tokens.color.primary; width: $missing; }
</style>

export function Lint(props: { title: string }) {
  const label = "→é😀"; debugger;
  return (
    <section class="lint">
      <h2>{props.title} {label}</h2>
      <style>
        .lint { padding: calc($gap * 1px); color: #ggg; }
      </style>
    </section>
  );
}
`;

function find(diagnostics: CheckDiagnostic[], code: string, file = "src/components/Lint.stsx") {
  return diagnostics.filter((d) => d.code === code && d.file === file);
}

describe.skipIf(!binding)("lumiose lint", () => {
  it("lints .stsx through shadows with source positions, and the project's own files", async () => {
    const root = await project({
      "package.json": "{}",
      ".gitignore": ".lumiose/\n",
      ".oxlintrc.json": `// lint config\n${OXLINT_CONFIG.replace(/}$/, ",}")}`,
      "src/tokens.ts": 'export const tokens = { color: { primary: "#7c3aed" } } as const;\n',
      "src/main.ts": "const unusedTs = 1;\nexport {};\n",
      "src/components/Lint.stsx": LINT_STSX,
      "src/ignored/Skip.stsx": "export const Skip = () => { debugger; return null; };\n",
    });
    const { diagnostics } = await lint({ root, stylelint: null });

    const [unused] = find(diagnostics, "eslint(no-unused-vars)");
    expect(unused).toMatchObject({ source: "oxlint", severity: "error", line: 4, column: 7 });
    expect(unused).toMatchObject({ endLine: 4, endColumn: 13 });

    // After "→é😀" (4 UTF-16 units, 9 UTF-8 bytes) and after a block with non-ASCII CSS.
    const [debuggerStatement] = find(diagnostics, "eslint(no-debugger)");
    const line = LINT_STSX.split("\n")[10]!;
    expect(debuggerStatement).toMatchObject({
      severity: "warning", // the override for src/components/** applies to the shadow
      line: 11,
      column: line.indexOf("debugger") + 1,
    });

    // `$missing` is a real reference: kept. `;gap;`-style masking statements are not reported,
    // nor is anything else inside blocks (the CSS `#ggg`, the masked spaces).
    const undefRef = find(diagnostics, "eslint(no-undef)");
    expect(undefRef).toHaveLength(1);
    expect(undefRef[0]).toMatchObject({
      line: 7,
      column: LINT_STSX.split("\n")[6]!.indexOf("$missing") + 2,
    });
    expect(find(diagnostics, "eslint(no-unused-expressions)")).toEqual([]);
    const blockLines = new Set([6, 7, 8, 15, 16, 17]);
    expect(
      diagnostics.filter(
        (d) => d.file.endsWith(".stsx") && blockLines.has(d.line) && d !== undefRef[0],
      ),
    ).toEqual([]);

    expect(find(diagnostics, "eslint(no-unused-vars)", "src/main.ts")).toHaveLength(1);
    expect(diagnostics.some((d) => d.file.startsWith("src/ignored/"))).toBe(false);
    expect(diagnostics.some((d) => d.file.includes(".lumiose"))).toBe(false);
    expect(existsSync(join(root, ".lumiose/shadow/.oxlintrc.json"))).toBe(true);
  });

  it("runs stylelint on block CSS at source positions, skipping $ref placeholders", async () => {
    const root = await project({
      "package.json": "{}",
      "src/components/Lint.stsx": LINT_STSX,
      "src/tokens.ts": "export const tokens = { color: { primary: '#000' } } as const;\n",
    });
    const calls: { code: string; codeFilename?: string }[] = [];
    const stylelint: Stylelint = {
      async lint({ code, codeFilename }) {
        calls.push({ code, ...(codeFilename ? { codeFilename } : {}) });
        const warnings = [];
        const lines = code.split("\n");
        for (const [index, text] of lines.entries()) {
          for (const [token, rule] of [
            ["#ggg", "color-no-invalid-hex"],
            ["_missing", "value-keyword-case"],
          ] as const) {
            const column = text.indexOf(token) + 1;
            if (column > 0) {
              warnings.push({
                line: index + 1,
                column,
                rule,
                severity: "error" as const,
                text: `Bad "${token}" (${rule})`,
              });
            }
          }
        }
        return { results: [{ warnings }] };
      },
    };
    const { diagnostics } = await lint({ root, stylelint });

    expect(calls).toHaveLength(2);
    expect(calls[0]!.code).toHaveLength(LINT_STSX.length);
    expect(calls[0]!.code).toContain("margin: _gap; color: _tokens_color_primary;");
    expect(calls[0]!.codeFilename).toBe(join(root, "src/components/Lint.stsx.css"));
    const styled = diagnostics.filter((d) => d.source === "stylelint");
    expect(styled).toEqual([
      expect.objectContaining({
        code: "color-no-invalid-hex",
        message: 'Bad "#ggg"',
        file: "src/components/Lint.stsx",
        line: 16,
        column: LINT_STSX.split("\n")[15]!.indexOf("#ggg") + 1,
      }),
    ]);
  });

  it("notes an unconfigured stylelint and goes on", async () => {
    const root = await project({
      "package.json": "{}",
      "src/A.stsx": "export const A = () => <p><style>p { color: red }</style></p>;\n",
    });
    const stylelint: Stylelint = {
      lint: () => Promise.reject(new Error("No configuration provided for /x/A.stsx.css")),
    };
    const result = await lint({ root, stylelint });
    expect(result.notes).toEqual(["stylelint is installed but not configured; skipped."]);
  });

  it("`lumiose lint --format json` reports and exits 1 on errors", async () => {
    const root = await project({
      "package.json": "{}",
      ".oxlintrc.json": JSON.stringify({ categories: { correctness: "error" } }),
      "src/A.stsx":
        'const unused = 1;\nexport const A = () => <p class="a"><style>.a { color: red }</style></p>;\n',
    });
    let out = "";
    const code = await main(["lint", "--format", "json", "--root", root], {
      cwd: root,
      write: (text) => void (out += text),
      writeError: () => {},
      color: false,
    });
    const report = JSON.parse(out) as CheckReport;
    expect(code).toBe(1);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        source: "oxlint",
        code: "eslint(no-unused-vars)",
        file: "src/A.stsx",
        line: 1,
        column: 7,
      }),
    ]);
    expect(report.summary).toMatchObject({ errors: 1, files: 1 });
    expect(await readFile(join(root, ".lumiose/shadow/src/A.stsx.tsx"), "utf8")).toContain(
      "export const A",
    );
  });
});
