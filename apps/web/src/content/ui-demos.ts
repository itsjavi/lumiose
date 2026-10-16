// The live demos of the /ui pages (TASK-387). A demo is a ```tsx check example of a
// packages/ui/docs page, the same code the docs tests type-check and the page shows, so the pages
// stay the only source: scripts/ui-demos.ts writes each one to src/ui-demos/<id>.tsx, plus the
// UiDemo component that renders them by id, and the /ui page renders a demo above its code.
//
// An example becomes a demo when it exports exactly one component that takes no props. It is
// server-rendered, so it works without JavaScript as far as the component does, unless it uses
// signals, `bind:`, event handlers or another function prop (`validate={available}`): then it
// hydrates as an island (`client:visible`).
//
// Pure (no Vite, no file system), so the generator script and the content layer share it.

import { Lexer, type Tokens } from "marked";

export interface UiDemo {
  /** `dialog-1`: the page's name and the example's place among its `tsx check` blocks (from 1). */
  id: string;
  /** The page's name: `dialog` for packages/ui/docs/dialog.md. */
  page: string;
  /** The example's code, as the page shows it. */
  code: string;
  /** The component the example exports. */
  name: string;
  /** Hydrates in the browser (`client:visible`) instead of staying server HTML. */
  island: boolean;
}

/** Marks an island: Lumiose's runtime (signals), two-way bindings, DOM events or event props. */
const ISLAND = /\bbind:[a-z]|\bon:[a-z]|\bon[A-Z]\w*=|from "lumiose(?:\/[\w-]+)?"/;
/** A prop whose value is a function written in place: `validate={(value) => …}`. */
const FUNCTION_PROP =
  /\b([a-zA-Z][\w-]*)=\{\s*(?:async\s+)?(?:function\b|(?:\([^()]*\)|[\w$]+)\s*=>)/g;
/**
 * The functions an example declares under a lowercase name (`function available(…)`,
 * `const pick = (…) =>`): callbacks, where a capitalized one would be a component.
 */
const DECLARED_FUNCTION =
  /^\s*(?:(?:async\s+)?function\s+([a-z_$][\w$]*)|(?:const|let)\s+([a-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\b|(?:\([^()]*\)|[\w$]+)\s*=>))/gm;
/** Function props that also run on the server, as formatters: `getAriaValueText`. */
const SERVER_FUNCTION_PROP = /^get[A-Z]/;

/**
 * Whether an example needs the browser: the runtime, a binding or an event (`ISLAND`), or a
 * function prop such as `validate`, which only runs once the component hydrates (TASK-423).
 */
export function needsIsland(code: string): boolean {
  if (ISLAND.test(code)) return true;
  const props = [...code.matchAll(FUNCTION_PROP)].map(([, prop]) => prop!);
  for (const [, declared, assigned] of code.matchAll(DECLARED_FUNCTION)) {
    const name = (declared ?? assigned)!.replaceAll("$", "\\$");
    for (const [, prop] of code.matchAll(
      new RegExp(`\\b([a-zA-Z][\\w-]*)=\\{\\s*${name}\\s*\\}`, "g"),
    )) {
      props.push(prop!);
    }
  }
  return props.some((prop) => !SERVER_FUNCTION_PROP.test(prop));
}

/** Whether a fenced block's info string is a type-checked TSX example (`tsx check …`). */
export function isCheckedTsx(lang: string | undefined): boolean {
  const [language, ...meta] = (lang ?? "").split(/\s+/);
  return language === "tsx" && meta.includes("check");
}

/** The top-level tokens of a page, as the content layer reads them (HTML comments dropped). */
export function pageTokens(source: string): ReturnType<typeof Lexer.lex> {
  return Lexer.lex(source.replace(/<!--[\s\S]*?-->\n?/g, ""));
}

/** The demos of one page, in page order. Examples that cannot be demos are skipped. */
export function uiDemos(page: string, source: string): UiDemo[] {
  const demos: UiDemo[] = [];
  let count = 0;
  for (const token of pageTokens(source)) {
    if (token.type !== "code" || !isCheckedTsx((token as Tokens.Code).lang)) continue;
    count += 1;
    const code = (token as Tokens.Code).text;
    const exports = [...code.matchAll(/^export function ([A-Z]\w*)\(([^)]*)\)/gm)];
    if (exports.length !== 1 || exports[0]![2]!.trim() !== "") continue;
    demos.push({
      id: `${page}-${count}`,
      page,
      code,
      name: exports[0]![1]!,
      island: needsIsland(code),
    });
  }
  return demos;
}

/** The generated directory, relative to apps/web. */
export const DEMOS_DIR = "src/ui-demos";
export const GENERATE = "pnpm --filter @lumiose/web ui:demos";

/**
 * The files of src/ui-demos for the given pages (`{ dialog: "<markdown>" }`): one module per demo
 * and index.tsx with `UiDemo`. Paths are relative to the directory.
 */
export function uiDemoFiles(pages: Record<string, string>): Map<string, string> {
  const demos = Object.keys(pages)
    .toSorted()
    .flatMap((page) => uiDemos(page, pages[page]!));
  const names = new Map<string, string>();
  for (const demo of demos) {
    const other = names.get(demo.name);
    if (other !== undefined) {
      throw new Error(
        `The UI examples ${other} and ${demo.id} both export ${demo.name}: rename one of them.`,
      );
    }
    names.set(demo.name, demo.id);
  }

  const files = new Map<string, string>();
  for (const demo of demos) {
    files.set(
      `${demo.id}.tsx`,
      `// Generated from packages/ui/docs/${demo.page}.md by apps/web/scripts/ui-demos.ts: do not edit.\n` +
        `// Change the example there and run \`${GENERATE}\`.\n${demo.code}\n`,
    );
  }
  const index = [
    `// Generated by apps/web/scripts/ui-demos.ts: the live demos of the /ui pages, the \`tsx check\``,
    `// examples of packages/ui/docs (src/content/ui-demos.ts has the rules). Do not edit: run`,
    `// \`${GENERATE}\`.`,
    ...demos.map((demo) => `import { ${demo.name} } from "./${demo.id}.tsx";`),
    "",
    "/** A demo by id: server HTML, or an island that hydrates when it scrolls into view. */",
    "export function UiDemo(props: { id: string }) {",
    "  switch (props.id) {",
    ...demos.flatMap((demo) => [
      `    case ${JSON.stringify(demo.id)}:`,
      `      return <${demo.name}${demo.island ? " client:visible" : ""} />;`,
    ]),
    "    default:",
    `      throw new Error(\`No UI demo "\${props.id}": run ${GENERATE}.\`);`,
    "  }",
    "}",
    "",
  ];
  files.set("index.tsx", index.join("\n"));
  return files;
}
