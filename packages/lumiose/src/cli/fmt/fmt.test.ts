// `lumiose fmt` (TASK-31): real oxfmt and the real scanner.
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { format as oxfmt } from "oxfmt";
import { afterAll, describe, expect, it } from "vitest";
import { main } from "../main.ts";
import { protectRefs } from "../style-css.ts";
import { formatStsx, type FormatConfig, type Formatter } from "./index.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);
const format: Formatter = oxfmt;

async function formatted(source: string, config: FormatConfig = {}): Promise<string> {
  const result = await formatStsx(source, "/p/src/A.stsx", format, config);
  if (!result.ok) throw new Error(result.error);
  expect(result.warnings).toEqual([]);
  return result.code;
}

/** Formats twice: the second pass must not change anything. */
async function stable(source: string, config: FormatConfig = {}): Promise<string> {
  const once = await formatted(source, config);
  expect(await formatted(once, config)).toBe(once);
  return once;
}

const MESSY = `import {tokens} from "./tokens.ts"
const gap=8
const radius = {lg:"12px",sm:"4px"} as const

export function Card(props:{title:string}){
  return <article class="card"><h3>{props.title}</h3>
  <style>.card h3{margin:0;padding:calc($gap  *  1px)}
      .card{border-radius:$radius.lg}</style>
  </article>
}

<style>
.card{color:$tokens.color.primary;border:1px solid $tokens.color.primary}
@media (width < $tokens.bp.md){.card{border-radius:$radius.sm}}
</style>
<style global>:root{--gap:$gap}</style>
`;

describe("protectRefs", () => {
  it("uses same-length identifiers that do not occur in the block and restores them", () => {
    const css = ".a { margin: $gap; padding: _gap; color: $c.d; }";
    const refs = [
      { start: css.indexOf("$gap"), end: css.indexOf("$gap") + 4 },
      { start: css.indexOf("$c.d"), end: css.indexOf("$c.d") + 4 },
    ];
    const guarded = protectRefs(css, refs);
    expect(guarded.css).toBe(".a { margin: _ga0; padding: _gap; color: _c_d; }");
    expect(guarded.restore(".a {\n  margin: _ga0;\n  padding: _gap;\n  color: _c_d;\n}")).toBe(
      ".a {\n  margin: $gap;\n  padding: _gap;\n  color: $c.d;\n}",
    );
    expect(guarded.restore(".a { padding: _gap; color: _c_d; }")).toBeUndefined();
  });
});

describe.skipIf(!binding)("formatStsx", () => {
  it("formats the TSX and each block, re-indented at its placement", async () => {
    expect(await stable(MESSY)).toBe(`import { tokens } from "./tokens.ts";
const gap = 8;
const radius = { lg: "12px", sm: "4px" } as const;

export function Card(props: { title: string }) {
  return (
    <article class="card">
      <h3>{props.title}</h3>
      <style>
        .card h3 {
          margin: 0;
          padding: calc($gap * 1px);
        }
        .card {
          border-radius: $radius.lg;
        }
      </style>
    </article>
  );
}

<style>
  .card {
    color: $tokens.color.primary;
    border: 1px solid $tokens.color.primary;
  }
  @media (width < $tokens.bp.md) {
    .card {
      border-radius: $radius.sm;
    }
  }
</style>
<style global>
  :root {
    --gap: $gap;
  }
</style>
`);
  });

  it("keeps every $ reference, also next to identifiers that look like their placeholders", async () => {
    const source = `const gap = 1;\nconst a = { b: 2 };\n<style>.x{margin:$gap;padding:_gap;inset:$a.b _a_b}</style>\n`;
    const code = await stable(source);
    expect(code).toContain("margin: $gap;\n    padding: _gap;\n    inset: $a.b _a_b;");
  });

  it("is idempotent on nested, inline, SVG, empty and line-sharing blocks", async () => {
    await stable(`export const A = () => (
  <ul>
    <li>
      text<style>li { margin: 0 }</style>more text
    </li>
    <svg viewBox="0 0 1 1"><style>circle{fill:red}</style></svg>
    <p><style></style><style>   </style></p>
  </ul>
);
const x = 1; <style>.a{b:c}</style> const y = 2;
`);
    const code = await stable(`export const A = () => <p>a <style>.p{color:red}</style> b</p>;\n`);
    expect(code).toContain(".p");
  });

  it("is idempotent on multi-line CSS comments, keeping their relative indentation (TASK-134)", async () => {
    const source = `export const A = () => (
  <main>
    <style>
      /* The page grid:
         sidebar and content. */
      main {
        display: grid;
        /*
         * Nested comment.
         */
        gap: 1rem;
      }
    </style>
  </main>
);
<style>
  /* Top level,
     two lines. */
  .a { color: red; }
</style>
`;
    const code = await stable(source);
    expect(code).toContain(
      "      /* The page grid:\n         sidebar and content. */\n      main {",
    );
    expect(code).toContain(
      "        /*\n         * Nested comment.\n         */\n        gap: 1rem;",
    );
    expect(code).toContain("  /* Top level,\n     two lines. */\n  .a {");
  });

  it("follows the oxfmt config: tabs, tab width, semicolons, line endings", async () => {
    const source =
      "const g = 1\nexport const A = () => <div><style>.a{margin:$g}</style></div>\n<style>.b{c:d}</style>\n";
    expect(await stable(source, { useTabs: true, semi: false })).toBe(
      "const g = 1\nexport const A = () => (\n\t<div>\n\t\t<style>\n\t\t\t.a {\n\t\t\t\tmargin: $g;\n\t\t\t}\n\t\t</style>\n\t</div>\n)\n<style>\n\t.b {\n\t\tc: d;\n\t}\n</style>\n",
    );
    const crlf = await stable(source, { endOfLine: "crlf", tabWidth: 4 });
    expect(crlf.split("\r\n").join("")).not.toContain("\n");
    expect(crlf).toContain("<style>\r\n    .b {\r\n        c: d;\r\n    }\r\n</style>\r\n");
  });

  it("reports scanner and syntax errors, and leaves a block with invalid CSS as it is", async () => {
    const unclosed = await formatStsx("const a = 1;\n<style>.a{}", "/p/A.stsx", format);
    expect(unclosed).toMatchObject({ ok: false, error: expect.stringContaining("LUM1004") });
    const syntax = await formatStsx("const = ;\n<style>.a{}</style>\n", "/p/A.stsx", format);
    expect(syntax.ok).toBe(false);

    const css = await formatStsx("const  a=1\n<style>.a{color:red</style>\n", "/p/A.stsx", format);
    expect(css).toMatchObject({
      ok: true,
      code: "const a = 1;\n<style>.a{color:red</style>\n",
      warnings: [expect.stringContaining("style block 1")],
    });
  });
});

const roots: string[] = [];
afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function project(files: Record<string, string>): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "lumiose-fmt-")));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

async function run(argv: string[], root: string) {
  let out = "";
  let err = "";
  const code = await main([...argv, "--root", root], {
    cwd: root,
    write: (text) => void (out += text),
    writeError: (text) => void (err += text),
    color: false,
  });
  return { code, out, err };
}

describe.skipIf(!binding)("lumiose fmt", () => {
  it("checks, writes with the project's .oxfmtrc.json, honours ignorePatterns, and is stable", async () => {
    const messy = "export const A=()=><p class='a'><style>.a{color:red}</style></p>\n";
    const root = await project({
      ".oxfmtrc.json": `{ "semi": false, /* c */ "ignorePatterns": ["**/generated/**"], }`,
      "src/A.stsx": messy,
      "src/generated/G.stsx": messy,
      "src/Broken.stsx": "<style>.a{}\n",
    });

    const check = await run(["fmt", "--check"], root);
    expect(check.code).toBe(1);
    expect(check.out).toBe(
      "src/A.stsx\n1 file not formatted (of 2 .stsx files). Run `lumiose fmt`.\n",
    );
    expect(check.err).toContain("src/Broken.stsx: could not format: LUM1004");
    expect(await readFile(join(root, "src/A.stsx"), "utf8")).toBe(messy);

    const write = await run(["fmt", "src/A.stsx"], root);
    expect(write).toMatchObject({ code: 0, out: "Formatted 1 file (of 1 .stsx file).\n" });
    expect(await readFile(join(root, "src/A.stsx"), "utf8")).toBe(
      'export const A = () => (\n  <p class="a">\n    <style>\n      .a {\n        color: red;\n      }\n    </style>\n  </p>\n)\n',
    );
    expect(await readFile(join(root, "src/generated/G.stsx"), "utf8")).toBe(messy);
    expect(await run(["fmt", "--check", "src/A.stsx"], root)).toMatchObject({
      code: 0,
      out: "All 1 .stsx file formatted.\n",
    });
  });

  it("checks several projects with scripts/fmt-examples.ts, one summary each (CI)", async () => {
    const clean = await project({ "src/A.stsx": "export const A = () => <p>a</p>;\n" });
    const messy = await project({ "src/B.stsx": "export const B=()=><p>b</p>\n" });
    const script = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../../scripts/fmt-examples.ts",
    );
    const result = spawnSync(process.execPath, [script, clean, messy], { encoding: "utf8" });
    expect(result.status).toBe(1);
    const name = (dir: string) => relative(join(script, "../.."), dir).split(sep).join("/");
    expect(result.stdout).toBe(
      `${name(clean)}: All 1 .stsx file formatted.\n` +
        `${name(messy)}: src/B.stsx\n` +
        `${name(messy)}: 1 file not formatted (of 1 .stsx file). Run \`lumiose fmt\`.\n`,
    );
    expect(result.stderr).toBe("fmt:examples: 1 of 2 projects need `lumiose fmt`.\n");
    expect(`${result.stdout}${result.stderr}`).not.toContain("undefined");
  });

  it("rejects --check outside fmt", async () => {
    const root = await project({});
    expect((await run(["lint", "--check"], root)).code).toBe(2);
  });
});
