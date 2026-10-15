// @lumiose/ui's docs contract (decision-64, TASK-393): every component it exports has a page that
// follows the template, an entry in its llms.txt and a type-checked example (examples.test.ts checks
// the `check` blocks), and every prop of every part has a JSDoc comment, which editors and agents
// read from the types. Also: the generated llms files are current, links resolve, the MCP catalog
// reads every page, and `lumiose docs` finds the pages of an installed @lumiose/ui.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { main } from "../main.ts";
import { generateUiLlms } from "./generate.ts";
import { DOCS_DIR, loadDocs, type Doc } from "./index.ts";
import { isComponentPage, uiCatalog } from "./ui.ts";

const here = dirname(fileURLToPath(import.meta.url));
const UI_DIR = join(here, "../../../ui");
const UI_DOCS = join(UI_DIR, "docs");
const SRC = join(UI_DIR, "src");
const SITE_DOCS = "https://itsjavi.com/lumiose/docs/";
const docs = loadDocs(UI_DOCS);
const llms = readFileSync(join(UI_DOCS, "llms.txt"), "utf8");

/** Every component page has these `##` sections, in order; a heading may go on after a comma. */
const TEMPLATE = [
  "Anatomy",
  "API",
  "Example",
  "Styling",
  "Keyboard and focus",
  "Without JavaScript",
  "Browser support",
  "Related",
];

/** The value and type exports of `src/index.ts`. */
function exportsOf(index: string): { values: string[]; types: string[] } {
  const values: string[] = [];
  const types: string[] = [];
  for (const [, type, names] of index.matchAll(/^export (type )?\{([^}]*)\} from /gm)) {
    const list = names!
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
    (type ? types : values).push(...list);
  }
  return { values, types };
}

const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

function pageOf(component: string): Doc | undefined {
  return docs.find(
    (doc) => isComponentPage(doc) && (doc.title === component || doc.topic === kebab(component)),
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** The index after a string, comment-free, or after the comment at `at`. */
function skip(text: string, at: number): number {
  if (text.startsWith("//", at)) {
    const end = text.indexOf("\n", at);
    return end === -1 ? text.length : end;
  }
  if (text.startsWith("/*", at)) return text.indexOf("*/", at + 2) + 2;
  const quote = text[at]!;
  let i = at + 1;
  while (i < text.length && text[i] !== quote) i += text[i] === "\\" ? 2 : 1;
  return i + 1;
}

const OPEN = "{([";
const CLOSE = "})]";

/** The index of the bracket that closes the one at `open`. */
function matching(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length;) {
    const ch = text[i]!;
    if (
      ch === '"' ||
      ch === "'" ||
      ch === "`" ||
      text.startsWith("//", i) ||
      text.startsWith("/*", i)
    ) {
      i = skip(text, i);
      continue;
    }
    if (OPEN.includes(ch)) depth++;
    else if (CLOSE.includes(ch) && --depth === 0) return i;
    i++;
  }
  return -1;
}

const MEMBER = /^(?:readonly\s+)?(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$:-]*))\??\s*[:(]/;

/** The members of an object type body (between its braces), each with whether a JSDoc precedes it. */
function members(body: string): { name: string; jsdoc: boolean }[] {
  const found: { name: string; jsdoc: boolean }[] = [];
  let jsdoc = false;
  let start = true;
  for (let i = 0; i < body.length;) {
    const ch = body[i]!;
    if (body.startsWith("/**", i)) {
      jsdoc = true;
      i = skip(body, i);
      continue;
    }
    if (
      ch === '"' ||
      ch === "'" ||
      ch === "`" ||
      body.startsWith("//", i) ||
      body.startsWith("/*", i)
    ) {
      if (start && (ch === '"' || ch === "'")) {
        const member = MEMBER.exec(body.slice(i));
        if (member) {
          found.push({ name: member[1] ?? member[2]!, jsdoc });
          jsdoc = false;
          start = false;
        }
      }
      i = skip(body, i);
      continue;
    }
    if (OPEN.includes(ch)) {
      i = matching(body, i) + 1;
      start = false;
      continue;
    }
    if (ch === ";" || ch === "," || ch === "\n") start = true;
    else if (start && !/\s/.test(ch)) {
      const member = MEMBER.exec(body.slice(i));
      if (member) {
        found.push({ name: member[3] ?? member[1] ?? member[2]!, jsdoc });
        jsdoc = false;
        i += member[0].length;
      }
      start = false;
      continue;
    }
    i++;
  }
  return found;
}

/**
 * What a `*Props` type lacks in JSDoc: its declaration, then every member of the object types it
 * declares (an interface body, or the `{ … }` parts of a type alias). Props inherited from an
 * element (`JSX.IntrinsicElements["button"]`) are documented by lumiose's JSX types.
 */
function undocumented(name: string, files: readonly string[]): string[] {
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const at = source.search(new RegExp(`^export (?:interface|type) ${name}\\b`, "m"));
    if (at === -1) continue;
    const where = `${relative(UI_DIR, file)}: ${name}`;
    const missing = /\/\*\*[\s\S]*?\*\/\s*$/.test(source.slice(0, at)) ? [] : [where];
    const isInterface = source.startsWith(`export interface`, at);
    const bodies: string[] = [];
    for (let i = at; i < source.length; i++) {
      const ch = source[i]!;
      if (ch === "{") {
        const close = matching(source, i);
        bodies.push(source.slice(i + 1, close));
        i = close;
        if (isInterface) break;
      } else if (ch === "(" || ch === "[") {
        i = matching(source, i);
      } else if (ch === ";" && !isInterface) {
        break;
      }
    }
    for (const body of bodies) {
      for (const member of members(body)) {
        if (!member.jsdoc) missing.push(`${where}.${member.name}`);
      }
    }
    return missing;
  }
  return [`${name}: no declaration in packages/ui/src`];
}

describe("@lumiose/ui docs contract", () => {
  const { values, types } = exportsOf(readFileSync(join(SRC, "index.ts"), "utf8"));
  // Components are PascalCase (`Dialog`); a helper (`createToastManager`) is documented on its
  // component's page.
  const components = values.filter((name) => /^[A-Z]/.test(name));

  it("gives every exported component a page with the template's sections", () => {
    expect(components.length).toBeGreaterThan(0);
    for (const component of components) {
      const page = pageOf(component);
      expect(page, `${component} has no page in packages/ui/docs`).toBeDefined();
      const sections = [...page!.content.matchAll(/^## (.+)$/gm)].map((match) => {
        const heading = match[1]!;
        return (
          TEMPLATE.find((name) => heading === name || heading.startsWith(`${name}, `)) ?? heading
        );
      });
      expect(sections, page!.topic).toEqual(TEMPLATE);
      expect(page!.summary, `${page!.topic} summary`).toBeTruthy();
    }
  });

  it("lists every component in llms.txt, with a type-checked example", () => {
    for (const component of components) {
      const page = pageOf(component);
      if (!page) continue;
      expect(llms, `${page.topic} is not in packages/ui/docs/llms.txt`).toContain(
        `](${page.topic}.md)`,
      );
      const example = /^## Example\n([\s\S]*?)(?=^## )/m.exec(page.content)?.[1] ?? "";
      expect(example, `${page.topic}: its Example needs a \`\`\`tsx check block`).toMatch(
        /^```(?:tsx|stsx)[ \t]+(?:[^\n]*\s)?check\b/m,
      );
    }
  });

  it("documents every prop of every part with JSDoc", () => {
    const files = sourceFiles(SRC);
    const props = types.filter((name) => name.endsWith("Props"));
    for (const component of components) {
      expect(
        props.some((name) => name.startsWith(component)),
        `${component} exports no ${component}…Props types from src/index.ts`,
      ).toBe(true);
    }
    expect(props.flatMap((name) => undocumented(name, files))).toEqual([]);
  });

  it("finds undocumented members", () => {
    const body = `
  /** Documented. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** A nested type is one member. */
  nested?: { inner: string };
  "data-x"?: string;
`;
    expect(members(body)).toEqual([
      { name: "open", jsdoc: true },
      { name: "onOpenChange", jsdoc: false },
      { name: "nested", jsdoc: true },
      { name: "data-x", jsdoc: false },
    ]);
  });

  it("gives the MCP catalog the parts, props and styling hooks of every component page", () => {
    const { components: catalog } = uiCatalog(docs);
    expect(catalog.length).toBe(docs.filter(isComponentPage).length);
    for (const component of catalog) {
      expect(component.parts.length, `${component.topic} parts`).toBeGreaterThan(0);
      expect(component.props.length, `${component.topic} props`).toBeGreaterThan(0);
      expect(component.styling.length, `${component.topic} styling hooks`).toBeGreaterThan(0);
      expect(component.imports.length, `${component.topic} imports`).toBeGreaterThan(0);
    }
  });

  it("has current llms.txt and llms-full.txt", () => {
    for (const [path, content] of generateUiLlms(docs)) {
      expect(
        readFileSync(join(UI_DOCS, path), "utf8"),
        `packages/ui/docs/${path} is stale: run pnpm --filter @lumiose/ui docs:gen`,
      ).toBe(content);
    }
  });

  it("links to UI pages that exist and to Lumiose pages by their site URLs", () => {
    const broken: string[] = [];
    for (const doc of docs) {
      const prose = doc.content.replace(/^```[\s\S]*?^```/gm, "");
      for (const [, target] of prose.matchAll(/\]\(([^)\s]+)\)/g)) {
        const path = target!.split("#")[0]!;
        if (target!.startsWith(SITE_DOCS)) {
          const topic = path.slice(SITE_DOCS.length).replace(/\/$/, "") || "README";
          const found = [`${topic}.md`, `${topic}/README.md`].some((file) =>
            existsSync(join(DOCS_DIR, file)),
          );
          if (!found) broken.push(`${doc.topic}: ${target}`);
        } else if (/^https?:/.test(target!)) {
          continue;
        } else if (path.startsWith("../") || !existsSync(join(UI_DOCS, dirname(doc.topic), path))) {
          // `../` would leave the package: Lumiose's pages are linked by their site URLs.
          broken.push(`${doc.topic}: ${target}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });
});

describe("lumiose docs with @lumiose/ui installed", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "lumiose-ui-docs-")));
  mkdirSync(join(root, "node_modules/@lumiose"), { recursive: true });
  symlinkSync(UI_DIR, join(root, "node_modules/@lumiose/ui"), "junction");
  mkdirSync(join(root, "src"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  async function run(...argv: string[]) {
    let stdout = "";
    const exitCode = await main(argv, {
      cwd: join(root, "src"),
      color: false,
      write: (text) => void (stdout += text),
      writeError: () => {},
    });
    return { exitCode, stdout };
  }

  it("prints the UI index and component pages, and lists them", async () => {
    expect((await run("docs", "ui")).stdout).toMatch(/^# UI components$/m);
    const dialog = await run("docs", "dialog");
    expect(dialog.exitCode).toBe(0);
    expect(dialog.stdout).toMatch(/^# Dialog$/m);
    const list = JSON.parse((await run("docs", "--format", "json")).stdout);
    const topics = list.topics.map((entry: { topic: string }) => entry.topic);
    expect(topics).toEqual(expect.arrayContaining(["concepts/signals", "ui/README", "ui/dialog"]));
  });
});
