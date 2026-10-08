import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { formatTokens, tokenize, type Token } from "./tokenize.ts";

const FIXTURES = ["component", "top-level", "edge-cases"] as const;

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}.stsx`, import.meta.url), "utf8");
}

/** Scopes of the `nth` token with exactly `text` on `line`. */
function scopes(tokens: readonly Token[], line: number, text: string, nth = 0): string {
  const token = tokens.filter((t) => t.line === line && t.text === text)[nth];
  if (!token) throw new Error(`no token ${JSON.stringify(text)} on line ${line}`);
  return token.scopes.join(" ");
}

describe("stsx grammar snapshots", () => {
  test.each(FIXTURES)("%s.stsx", async (name) => {
    await expect(formatTokens(await tokenize(fixture(name)))).toMatchFileSnapshot(
      `__snapshots__/${name}.stsx.tokens`,
    );
  });
});

describe("style blocks", () => {
  test("a block inside JSX embeds CSS and returns to TSX after </style>", async () => {
    const tokens = await tokenize(fixture("component"));
    expect(scopes(tokens, 11, "style")).toMatch(
      /meta\.embedded\.block\.style\.stsx entity\.name\.tag\.style\.stsx$/,
    );
    expect(scopes(tokens, 12, "counter")).toMatch(
      /source\.css meta\.selector\.css entity\.other\.attribute-name\.class\.css$/,
    );
    expect(scopes(tokens, 12, "display")).toMatch(/support\.type\.property-name\.css$/);
    expect(scopes(tokens, 15, "div")).toMatch(/meta\.tag\.tsx entity\.name\.tag\.tsx$/);
    expect(scopes(tokens, 15, "div")).not.toContain("source.css");
  });

  test("a single-line block tokenizes its selector right after the open tag", async () => {
    const tokens = await tokenize(fixture("component"));
    expect(scopes(tokens, 22, "badge")).toMatch(
      /source\.css meta\.selector\.css entity\.other\.attribute-name\.class\.css$/,
    );
    expect(scopes(tokens, 29, "li")).toMatch(
      /source\.css meta\.selector\.css entity\.name\.tag\.css$/,
    );
    expect(scopes(tokens, 29, "more text")).toMatch(/meta\.jsx\.children\.tsx$/);
  });

  test("top-level blocks, including <style global>", async () => {
    const tokens = await tokenize(fixture("top-level"));
    expect(scopes(tokens, 10, "style")).toBe(
      "meta.embedded.block.style.stsx entity.name.tag.style.stsx",
    );
    expect(scopes(tokens, 23, "global")).toBe(
      "meta.embedded.block.style.stsx entity.other.attribute-name.stsx",
    );
    expect(scopes(tokens, 16, "media")).toMatch(
      /source\.css .*keyword\.control\.at-rule\.media\.css$/,
    );
  });

  test("<style> in comments, strings and templates is not a block", async () => {
    const tokens = await tokenize(fixture("edge-cases"));
    const all = tokens.map((token) => token.scopes.join(" "));
    expect(
      tokens.filter((t) => t.scopes.includes("meta.embedded.block.style.stsx")).map((t) => t.line),
    ).toEqual(expect.arrayContaining([12, 14]));
    for (const line of [1, 2, 3, 8, 9, 10]) {
      expect(
        tokens.filter(
          (t) => t.line === line && t.scopes.includes("meta.embedded.block.style.stsx"),
        ),
      ).toEqual([]);
    }
    expect(all.some((scope) => scope.includes("source.css"))).toBe(true);
    expect(scopes(tokens, 4, "T")).toMatch(/meta\.type\.parameters\.tsx entity\.name\.type\.tsx$/);
    expect(scopes(tokens, 5, "<")).toMatch(/keyword\.operator\.relational\.tsx$/);
  });
});

describe("$ref highlighting", () => {
  test("$name and $a.b are variable tokens in property values, calc() and @media", async () => {
    const tokens = await tokenize(fixture("top-level"));
    expect(scopes(tokens, 12, "$")).toMatch(
      /meta\.ref\.stsx punctuation\.definition\.variable\.stsx$/,
    );
    expect(scopes(tokens, 12, "radius")).toMatch(
      /meta\.property-value\.css meta\.ref\.stsx variable\.other\.constant\.ref\.stsx$/,
    );
    expect(scopes(tokens, 12, ".")).toMatch(/meta\.ref\.stsx punctuation\.accessor\.stsx$/);
    expect(scopes(tokens, 12, "lg")).toMatch(
      /meta\.ref\.stsx variable\.other\.property\.ref\.stsx$/,
    );
    expect(scopes(tokens, 13, "primary")).toMatch(/variable\.other\.property\.ref\.stsx$/);
    expect(scopes(tokens, 14, "BREAKPOINT")).toMatch(
      /meta\.function\.calc\.css meta\.ref\.stsx variable\.other\.constant\.ref\.stsx$/,
    );
    expect(scopes(tokens, 16, "BREAKPOINT")).toMatch(
      /meta\.at-rule\.media\.header\.css meta\.ref\.stsx variable\.other\.constant\.ref\.stsx$/,
    );
    expect(scopes(tokens, 24, "tokens")).toMatch(/variable\.other\.constant\.ref\.stsx$/);
  });

  test("not in CSS strings, comments, url() or attribute operators", async () => {
    const tokens = await tokenize(fixture("top-level"));
    const refLines = tokens.filter((t) => t.scopes.includes("meta.ref.stsx")).map((t) => t.line);
    expect(refLines).not.toContain(19);
    expect(refLines).not.toContain(20);
    expect(scopes(tokens, 20, "$=")).toMatch(/keyword\.operator\.pattern\.css$/);
    expect(scopes(tokens, 20, "$notARef")).toMatch(/string\.quoted\.double\.css$/);
  });

  test("not outside style blocks", async () => {
    const tokens = await tokenize("const $gap = 1;\nconst t = `${$gap}`;\n");
    expect(tokens.filter((t) => t.scopes.includes("meta.ref.stsx"))).toEqual([]);
  });
});
