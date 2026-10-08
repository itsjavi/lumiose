// `lumen check` and shadow TSX (TASK-27). Fixture projects under `__fixtures__` are copied to a
// temp dir with `node_modules/lumen` and `node_modules/typescript` linked, then checked with the
// real scanner and TypeScript 7. `__fixtures__` is excluded from the package tsconfig.
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { main } from "../main.ts";
import {
  checkCommand,
  formatTsconfig,
  LUM_TSCONFIG,
  parseTscOutput,
  shadowPathFor,
  standaloneTsconfig,
  syncShadows,
  tsconfigTemplate,
  type CheckDiagnostic,
  type CheckReport,
} from "./index.ts";
import { parseJsonc } from "./modules.ts";
import { SourceText } from "./text.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = join(here, "../../..");
const typescriptDir = dirname(createRequire(import.meta.url).resolve("typescript/package.json"));
const binding = await import("@lumen/compiler").catch(() => undefined);

const roots: string[] = [];
afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

/** Copies a fixture's `src` into a temp project with the given tsconfig (`null`: none). */
async function project(
  fixture: string,
  tsconfig: object | null = tsconfigTemplate(),
): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), `lumen-check-${fixture}-`)));
  roots.push(root);
  await cp(join(here, "__fixtures__", fixture, "src"), join(root, "src"), { recursive: true });
  await mkdir(join(root, "node_modules"));
  await symlink(packageDir, join(root, "node_modules/lumen"), "junction");
  await symlink(typescriptDir, join(root, "node_modules/typescript"), "junction");
  if (tsconfig !== null) {
    await writeFile(join(root, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));
  }
  return root;
}

async function runCheck(root: string, args: string[] = []) {
  let stdout = "";
  let stderr = "";
  const exitCode = await main(["check", "--root", root, ...args], {
    cwd: root,
    color: false,
    write: (text) => void (stdout += text),
    writeError: (text) => void (stderr += text),
  });
  return { exitCode, stdout, stderr };
}

async function checkJson(root: string) {
  const { exitCode, stdout } = await runCheck(root, ["--format", "json"]);
  return { exitCode, report: JSON.parse(stdout) as CheckReport };
}

/** 1-based line and UTF-16 column of `needle` (plus `shift`) in `text`. */
function locate(text: string, needle: string, shift = 0) {
  const index = text.indexOf(needle);
  expect(index, `${needle} not found`).toBeGreaterThanOrEqual(0);
  return new SourceText(text).positionAt(index + shift);
}

/** The expected range of an error at `needle` (plus `shift`) spanning `token`. */
function errorAt(
  file: string,
  text: string,
  code: string,
  needle: string,
  token: string,
  shift = 0,
) {
  const start = locate(text, needle, shift);
  return {
    file,
    code,
    severity: "error",
    line: start.line,
    column: start.column,
    endLine: start.line,
    endColumn: start.column + token.length,
  };
}

/** A Lumen diagnostic at `needle` (plus `shift`) on one line, with its docs topic. */
function lumenAt(file: string, code: string, text: string, needle: string, shift = 0) {
  const start = locate(text, needle, shift);
  return expect.objectContaining({
    source: "lumen",
    file,
    code,
    line: start.line,
    column: start.column,
    endColumn: start.column + needle.length - shift,
    docs: `errors/${code}`,
  });
}

/** A tsconfig warning located at the `"option"` key of the project's tsconfig. */
async function tsconfigWarning(root: string, option: string, message: string) {
  const at = locate(await readFile(join(root, "tsconfig.json"), "utf8"), `"${option}"`);
  return expect.objectContaining({
    source: "lumen",
    code: LUM_TSCONFIG,
    severity: "warning",
    file: "tsconfig.json",
    line: at.line,
    column: at.column,
    endColumn: at.column + option.length + 2,
    message: expect.stringContaining(message),
  });
}

describe("SourceText", () => {
  it("counts UTF-16 columns and TypeScript line breaks", () => {
    const text = new SourceText('a\r\n"🎉" + b\rc d\n');
    expect(text.lineCount).toBe(5);
    expect(text.positionAt(text.text.indexOf("b"))).toEqual({ line: 2, column: 8 });
    expect(text.lineText(2)).toBe('"🎉" + b');
    expect(text.positionAt(text.text.indexOf("d"))).toEqual({ line: 4, column: 1 });
    expect(text.offsetAt({ line: 2, column: 8 })).toBe(text.text.indexOf("b"));
    expect(text.tokenEnd(text.offsetAt({ line: 2, column: 1 }))).toBe(text.text.indexOf(" +"));
  });
});

describe("parseTscOutput", () => {
  it("parses located, chained and global diagnostics", () => {
    const output = [
      ".lumen/shadow/src/routes/(marketing)/[slug].stsx.tsx(6,40): error TS2339: Property 'lgg' does not exist.",
      "src/a.ts(4,3): error TS2345: Argument of type 'A' is not assignable to parameter of type 'B'.",
      "  Types of parameters 'a' and 'a' are incompatible.",
      "    Type 'number' is not assignable to type 'string'.",
      "error TS2688: Cannot find type definition file for 'nope'.",
      "  The file is in the program because:",
      "",
    ].join("\n");
    expect(parseTscOutput(output)).toEqual([
      {
        file: ".lumen/shadow/src/routes/(marketing)/[slug].stsx.tsx",
        line: 6,
        column: 40,
        category: "error",
        code: "TS2339",
        message: "Property 'lgg' does not exist.",
      },
      {
        file: "src/a.ts",
        line: 4,
        column: 3,
        category: "error",
        code: "TS2345",
        message:
          "Argument of type 'A' is not assignable to parameter of type 'B'.\nTypes of parameters 'a' and 'a' are incompatible.\n  Type 'number' is not assignable to type 'string'.",
      },
      {
        category: "error",
        code: "TS2688",
        message:
          "Cannot find type definition file for 'nope'.\nThe file is in the program because:",
      },
    ]);
  });
});

describe("tsconfigTemplate", () => {
  it("extends the generated tsconfig (decision-25)", () => {
    expect(tsconfigTemplate()).toEqual({ extends: "./.lumen/tsconfig.generated.json" });
    expect(parseJsonc(formatTsconfig())).toEqual(tsconfigTemplate());
  });

  it("writes out the spec §4.7 options in the standalone form", () => {
    expect(standaloneTsconfig()).toEqual({
      compilerOptions: {
        jsx: "preserve",
        jsxImportSource: "lumen",
        module: "preserve",
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        noEmit: true,
        strict: true,
        types: ["lumen/env"],
        rootDirs: ["src", ".lumen/shadow/src"],
      },
      include: ["src", ".lumen/shadow", ".lumen/types"],
    });
  });
});

describe.skipIf(!binding)("syncShadows", () => {
  it("mirrors every src/**/*.stsx as offset-identical masked TSX", async () => {
    const root = await project("valid");
    const result = await syncShadows(root);
    const shadow = (path: string) => join(root, ".lumen/shadow", `${path}.tsx`);
    expect(result.written).toEqual(
      [
        "src/components/Button.stsx",
        "src/components/Card.stsx",
        "src/routes/blog/[slug].stsx",
        "src/routes/index.stsx",
      ].map(shadow),
    );
    expect(result.deleted).toEqual([]);
    for (const file of result.files) {
      const masked = await readFile(file.shadow, "utf8");
      expect(masked).toBe(binding!.scan(file.text, file.source).masked);
      expect(masked.length).toBe(file.text.length);
      expect(masked.split("\n").length).toBe(file.text.split("\n").length);
      expect(masked).not.toContain("<style");
    }
  });

  it("rewrites only changed shadows and deletes those whose source is gone", async () => {
    const root = await project("valid");
    await syncShadows(root);
    expect((await syncShadows(root)).written).toEqual([]);

    const card = join(root, "src/components/Card.stsx");
    await writeFile(card, `${await readFile(card, "utf8")}\n// edited\n`);
    expect((await syncShadows(root)).written).toEqual([shadowPathFor(root, card)]);

    await rm(join(root, "src/routes/blog"), { recursive: true });
    const deletion = await syncShadows(root);
    expect(deletion.deleted).toEqual([join(root, ".lumen/shadow/src/routes/blog/[slug].stsx.tsx")]);
    expect(existsSync(join(root, ".lumen/shadow/src/routes/blog"))).toBe(false);
    expect(existsSync(join(root, ".lumen/shadow/src/routes/index.stsx.tsx"))).toBe(true);
  });

  it("syncs only the listed files with `files`", async () => {
    const root = await project("valid");
    await syncShadows(root);
    await rm(join(root, "src/routes/index.stsx"));
    const button = join(root, "src/components/Button.stsx");
    await writeFile(button, (await readFile(button, "utf8")).replace("$accent", "$radius.sm"));

    const result = await syncShadows(root, {
      files: ["src/routes/index.stsx", button, "src/tokens.ts"],
    });
    expect(result.files.map((file) => file.source)).toEqual([button]);
    expect(result.written).toEqual([shadowPathFor(root, button)]);
    expect(result.deleted).toEqual([join(root, ".lumen/shadow/src/routes/index.stsx.tsx")]);
  });
});

describe.skipIf(!binding)("lumen check", () => {
  it("passes a valid project: exit 0, no diagnostics, typegen ran", async () => {
    const root = await project("valid");
    const { exitCode, report } = await checkJson(root);
    expect(report).toEqual({
      command: "check",
      ok: true,
      diagnostics: [],
      summary: { errors: 0, warnings: 0, hints: 0, files: 0 },
    });
    expect(exitCode).toBe(0);
    expect(await readFile(join(root, ".lumen/types/routes.d.ts"), "utf8")).toContain(
      `"/blog/[slug]": { kind: "page"; params: { slug: string } };`,
    );
    expect((await runCheck(root)).stdout).toBe("No problems found.\n");
  });

  it("maps TypeScript and scanner diagnostics to .stsx positions", async () => {
    const root = await project("errors");
    const { exitCode, report } = await checkJson(root);
    const source = (file: string) => readFile(join(root, file), "utf8");
    const badge = await source("src/components/Badge.stsx");
    const theme = await source("src/components/Theme.stsx");
    const panel = await source("src/components/Panel.stsx");
    const post = await source("src/routes/blog/[slug].stsx");

    expect(report.diagnostics).toEqual(
      [
        // A TSX error after a style block, on a line with non-ASCII text before it.
        errorAt("src/components/Badge.stsx", badge, "TS2339", "toUpperCase", "toUpperCase"),
        // A scanner diagnostic, with help and docs.
        {
          ...errorAt("src/components/Panel.stsx", panel, "LUM1005", 'lang="scss"', 'lang="scss"'),
          source: "lumen",
          help: expect.any(String),
          docs: "errors/LUM1005",
        },
        // A type error across an import between .stsx files.
        errorAt("src/components/Panel.stsx", panel, "TS2322", "label={42}", "label"),
        // `$ref`s inside CSS: a misspelled member, a misspelled and an undefined constant.
        errorAt("src/components/Theme.stsx", theme, "TS2339", "$radius.lgg", "lgg", 8),
        errorAt("src/components/Theme.stsx", theme, "TS2552", "$acent", "acent", 1),
        errorAt("src/components/Theme.stsx", theme, "TS2304", "$spacing", "spacing", 1),
        // Typed route params.
        errorAt("src/routes/blog/[slug].stsx", post, "TS2339", "params.id", "id", 7),
      ].map((diagnostic) => expect.objectContaining(diagnostic)),
    );
    for (const diagnostic of report.diagnostics.filter((d) => d.source === "ts")) {
      expect(diagnostic.message).not.toBe("");
    }
    expect(report.summary).toEqual({ errors: 7, warnings: 0, hints: 0, files: 4 });
    expect(exitCode).toBe(1);
  });

  it("prints code frames in the human format", async () => {
    const root = await project("errors");
    const { exitCode, stdout } = await runCheck(root);
    expect(exitCode).toBe(1);
    expect(stdout).toContain(
      [
        "src/components/Theme.stsx:9:54 - error TS2552: Cannot find name 'acent'. Did you mean 'accent'?",
        "",
        "9 |         .theme { border-radius: $radius.lgg; color: $acent; }",
        "  |                                                      ~~~~~",
      ].join("\n"),
    );
    expect(stdout).toContain("  docs: lumen docs errors/LUM1005");
    expect(stdout).toMatch(/Found 7 errors, 0 warnings in 4 files\.\n$/);
  });

  it("warns about tsconfig options shadow checking needs, at the option", async () => {
    const { compilerOptions } = standaloneTsconfig();

    // Route shadows silently drop out of the program: a warning, not an error.
    const noShadows = await project("valid", { compilerOptions, include: ["src", ".lumen/types"] });
    const first = await checkJson(noShadows);
    expect(first.report.diagnostics).toEqual([
      await tsconfigWarning(noShadows, "include", '".lumen/shadow"'),
    ]);
    expect(first.exitCode).toBe(0);

    // Without `lumen/env` the global JSX namespace is missing: the warning explains the error.
    const noEnv = await project("valid", {
      ...standaloneTsconfig(),
      compilerOptions: { ...compilerOptions, types: [] },
    });
    const second = await checkJson(noEnv);
    expect(second.report.diagnostics).toEqual([
      expect.objectContaining({ file: "src/components/Card.stsx", code: "TS2503" }),
      await tsconfigWarning(noEnv, "types", '"lumen/env"'),
    ]);
    expect(second.exitCode).toBe(1);
  });

  it("merges diagnostics from providers", async () => {
    const root = await project("valid");
    const writes: string[] = [];
    const exitCode = await checkCommand({
      root,
      format: "json",
      write: (text) => writes.push(text),
      providers: [
        ({ files }) => {
          const card = files.find((file) => file.source.endsWith("Card.stsx"))!;
          const start = card.text.indexOf("$gap");
          return [
            {
              file: card.source,
              diagnostics: [
                {
                  code: "LUM3008",
                  severity: "error",
                  message: "not a constant",
                  span: { start, end: start + 4 },
                  labels: [],
                  docs: "errors/LUM3008",
                },
              ],
            },
          ];
        },
      ],
    });
    const report = JSON.parse(writes.join("")) as CheckReport;
    const card = await readFile(join(root, "src/components/Card.stsx"), "utf8");
    const at = locate(card, "$gap");
    expect(report.diagnostics).toEqual<CheckDiagnostic[]>([
      {
        source: "lumen",
        code: "LUM3008",
        severity: "error",
        file: "src/components/Card.stsx",
        line: at.line,
        column: at.column,
        endLine: at.line,
        endColumn: at.column + 4,
        message: "not a constant",
        docs: "errors/LUM3008",
      },
    ]);
    expect(exitCode).toBe(1);
  });

  it("reports compiler diagnostics for .stsx and .tsx files", async () => {
    const root = await project("valid");
    const calls = [
      "function Inner() { return <i />; }",
      "let width = 2;",
      "export function Calls() {",
      '  return <div class="calls">{Inner()}<style>.calls { width: $width; }</style></div>;',
      "}",
      "",
    ].join("\n");
    const raw = 'export const Raw = () => <div class="raw">\n  <style>.raw {}</style>\n</div>;\n';
    await writeFile(join(root, "src/components/Calls.stsx"), calls);
    await writeFile(join(root, "src/Raw.tsx"), raw);
    const { exitCode, report } = await checkJson(root);
    // (TypeScript also rejects `<style>` in the `.tsx` file.)
    expect(report.diagnostics.filter((d) => d.source === "lumen")).toEqual([
      lumenAt("src/Raw.tsx", "LUM1006", raw, "<style>"),
      lumenAt("src/components/Calls.stsx", "LUM2004", calls, "{Inner()", 1),
      lumenAt("src/components/Calls.stsx", "LUM3008", calls, "$width"),
    ]);
    expect(exitCode).toBe(1);
  });

  it("resolves constants imported through tsconfig paths and re-exports for style diagnostics", async () => {
    const template = standaloneTsconfig();
    const root = await project("valid", {
      ...template,
      compilerOptions: { ...template.compilerOptions, paths: { "~/*": ["./src/*"] } },
    });
    await mkdir(join(root, "src/styles"));
    await writeFile(
      join(root, "src/styles/tokens.ts"),
      'export const space = 4;\nexport let mutable = "1px";\n',
    );
    await writeFile(
      join(root, "src/styles/theme.ts"),
      'export * from "./tokens.ts";\nexport { space as gap } from "./tokens.ts";\n',
    );
    const tokens = [
      'import { gap, gapp, mutable } from "~/styles/theme.ts";',
      'import { brand } from "../styles/missing.ts";',
      "",
      "export function Tokens() {",
      "  return (",
      '    <div class="tokens">',
      "      <style>",
      "        .tokens { padding: calc($gap * 1px); margin: $mutable; color: $brand; inset: $gapp; }",
      "        .oops { color: red; }",
      "      </style>",
      "    </div>",
      "  );",
      "}",
      "",
    ].join("\n");
    const file = "src/components/Tokens.stsx";
    await writeFile(join(root, file), tokens);
    const { exitCode, report } = await checkJson(root);
    // Without the modules, the compiler would withhold the file's CSS and all four diagnostics.
    expect(report.diagnostics.filter((d) => d.source === "lumen")).toEqual([
      lumenAt(file, "LUM3008", tokens, "$mutable"),
      lumenAt(file, "LUM3008", tokens, "$brand"),
      lumenAt(file, "LUM3008", tokens, "$gapp"),
      lumenAt(file, "LUM3005", tokens, ".oops"),
    ]);
    const messages = report.diagnostics.map((d) => d.message);
    expect(messages).toContainEqual(expect.stringMatching(/`mutable` is a `let` binding/));
    expect(messages).toContainEqual(expect.stringMatching(/`\$brand`.*could not be resolved/));
    expect(messages).toContainEqual(expect.stringMatching(/theme\.ts` has no export `gapp`/));
    // TypeScript resolves the same way: only the two broken imports are type errors.
    expect(report.diagnostics.filter((d) => d.source === "ts").map((d) => d.code)).toEqual([
      "TS2724",
      "TS2307",
    ]);
    expect(exitCode).toBe(1);
  });

  it("exits with 2 when the tool cannot run", async () => {
    const root = await project("valid", null);
    const { exitCode, report } = await checkJson(root);
    expect(exitCode).toBe(2);
    expect(report.diagnostics).toEqual([]);
    expect(report.failure?.message).toMatch(/No tsconfig/);
    expect(report.failure?.help).toContain('"extends": "./.lumen/tsconfig.generated.json"');

    expect(
      await main(["check", "--format", "xml"], {
        cwd: root,
        color: false,
        write() {},
        writeError() {},
      }),
    ).toBe(2);
    expect(await main(["nope"], { cwd: root, color: false, write() {}, writeError() {} })).toBe(2);
  });

  it("runs from the bin with JSON on stdout and the exit code", async () => {
    const root = await project("errors");
    const result = spawnSync(
      process.execPath,
      [join(packageDir, "src/cli/bin.ts"), "check", "--format", "json"],
      { cwd: root, encoding: "utf8" },
    );
    expect(result.status).toBe(1);
    const report = JSON.parse(result.stdout) as CheckReport;
    expect(report.summary.errors).toBe(7);
  });
});
