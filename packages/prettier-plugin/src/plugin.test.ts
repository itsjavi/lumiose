// @lumiose/prettier-plugin (TASK-41): Prettier formats .stsx like lumiose fmt, with its own printers
// and options, keeps `$` references, is idempotent, and reports files it cannot format.
import { format } from "prettier";
import { describe, expect, it } from "vitest";
import plugin from "./index.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);

const MESSY = `import {tokens} from "./tokens.ts"
const gap=8

export function Card(props:{title:string}){
  return <article class="card"><h3>{props.title}</h3>
  <style>.card h3{margin:0;padding:calc($gap  *  1px)}
      /* A comment
         on two lines. */
      .card{color:$tokens.color.primary}</style>
  </article>
}

<style>
.card{display:grid}
</style>
`;

const prettier = (text: string, options: Record<string, unknown> = {}) =>
  format(text, { filepath: "/p/src/Card.stsx", plugins: [plugin], ...options });

describe.skipIf(!binding)("@lumiose/prettier-plugin", () => {
  it("formats the TSX and each block with Prettier's printers, re-indented at its placement", async () => {
    const once = await prettier(MESSY);
    expect(once).toBe(`import { tokens } from "./tokens.ts";
const gap = 8;

export function Card(props: { title: string }) {
  return (
    <article class="card">
      <h3>{props.title}</h3>
      <style>
        .card h3 {
          margin: 0;
          padding: calc($gap * 1px);
        }
        /* A comment
           on two lines. */
        .card {
          color: $tokens.color.primary;
        }
      </style>
    </article>
  );
}

<style>
  .card {
    display: grid;
  }
</style>
`);
    expect(await prettier(once)).toBe(once);
  });

  it("follows Prettier's options", async () => {
    const code = await prettier(MESSY, { useTabs: true, semi: false, singleQuote: true });
    expect(code).toContain("import { tokens } from './tokens.ts'\n");
    expect(code).toContain("\t\t\t<style>\n\t\t\t\t.card h3 {\n\t\t\t\t\tmargin: 0;");
  });

  it("reports files with scanner or syntax errors instead of changing them", async () => {
    await expect(prettier('const a = 1;\n<style lang="scss">.a{}</style>\n')).rejects.toThrow(
      /LUM1005/,
    );
    await expect(prettier("const = ;\n<style>.a{}</style>\n")).rejects.toThrow();
  });
});
