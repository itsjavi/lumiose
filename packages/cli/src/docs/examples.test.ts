// Docs examples are type-checked (TASK-32): every ```tsx / ```stsx / ```ts block whose info
// string contains `check` is written into one temp project and checked with the `lumiose check`
// machinery (typegen, shadow TSX, TypeScript 7). Blocks without `check` (common mistakes,
// fragments, planned APIs) are not checked.
//
// Info string: `stsx check` puts the block in `src/docs/<topic>/<n>.stsx`; `stsx check file=x.stsx`
// puts it at `src/x.stsx`, so examples can import each other and route files get route types
// (`file=routes/blog/[slug].stsx`).
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { check, tsconfigTemplate } from "../check/index.ts";
import { loadDocs } from "./index.ts";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
/** Packages the examples import, linked into the temp project. */
const linked = {
  lumiose: join(here, "../../../lumiose"),
  "@lumiose/adapter-node": join(here, "../../../adapter-node"),
  typescript: dirname(require.resolve("typescript/package.json")),
  vitest: dirname(require.resolve("vitest/package.json")),
};
const binding = await import("@lumiose/compiler").catch(() => undefined);

interface DocExample {
  topic: string;
  /** 1-based index of the block within its doc. */
  index: number;
  /** Project-relative path the block is written to. */
  file: string;
  code: string;
}

const FENCE = /^```(tsx|stsx|ts)[ \t]+([^\n]*)\n([\s\S]*?)^```[ \t]*$/gm;

function extractExamples(topic: string, content: string): DocExample[] {
  const examples: DocExample[] = [];
  let index = 0;
  for (const [, lang, info, code] of content.matchAll(FENCE)) {
    const words = info!.trim().split(/\s+/);
    if (!words.includes("check")) continue;
    index++;
    const file = words.find((word) => word.startsWith("file="))?.slice("file=".length);
    examples.push({
      topic,
      index,
      file: file === undefined ? `src/docs/${topic}/${index}.${lang}` : `src/${file}`,
      code: code!,
    });
  }
  return examples;
}

/** Without a top-level import or export, a file is a script whose names would clash. */
function asModule(code: string): string {
  return /^(?:import|export)\s/m.test(code) ? code : `${code}\nexport {};\n`;
}

const examples = loadDocs().flatMap((doc) => extractExamples(doc.topic, doc.content));

const roots: string[] = [];
afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

describe("docs examples", () => {
  it("marks examples to check, each with its own file", () => {
    expect(examples.length).toBeGreaterThan(20);
    const files = examples.map((example) => example.file);
    expect(files.filter((file, i) => files.indexOf(file) !== i)).toEqual([]);
  });

  it.skipIf(!binding)("type-check with lumiose check", { timeout: 60_000 }, async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), "lumiose-docs-examples-")));
    roots.push(root);
    await mkdir(join(root, "node_modules"));
    for (const [name, dir] of Object.entries(linked)) {
      await mkdir(dirname(join(root, "node_modules", name)), { recursive: true });
      await symlink(dir, join(root, "node_modules", name), "junction");
    }
    await writeFile(join(root, "tsconfig.json"), JSON.stringify(tsconfigTemplate(), null, 2));
    for (const example of examples) {
      const path = join(root, example.file);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, asModule(example.code));
    }
    // A control file proves the check sees the examples (and the stsx shadows) at all.
    const control = "src/docs/__control__.stsx";
    await writeFile(
      join(root, control),
      'export const n: number = "text";\nexport function C() { return <p>{n}<style>p { color: red; }</style></p>; }\n',
    );

    const { diagnostics } = await check({ root });
    expect(diagnostics.filter((diagnostic) => diagnostic.file === control)).toMatchObject([
      { source: "ts", severity: "error", line: 1 },
    ]);
    const origin = new Map(examples.map((example) => [example.file, example]));
    const problems = diagnostics
      .filter((diagnostic) => diagnostic.severity !== "hint" && diagnostic.file !== control)
      .map((diagnostic) => {
        const example = origin.get(diagnostic.file);
        const where = example
          ? `docs/${example.topic}.md, example ${example.index}`
          : diagnostic.file;
        return `${where} (${diagnostic.file}:${diagnostic.line}:${diagnostic.column}) ${diagnostic.code}: ${diagnostic.message}`;
      });
    expect(problems).toEqual([]);
  });
});
