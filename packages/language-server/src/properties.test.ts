import { describe, expect, it } from "vitest";
import { cssImports } from "./project-styles.ts";
import { propertyContext, propertyDeclarations } from "./properties.ts";

describe("propertyDeclarations", () => {
  it("finds custom property declarations with their values and rules", () => {
    const css = `:root { --brand: #f60; --font: "a;b", serif; }
@media (prefers-color-scheme: dark) {
  .theme { --bg: rgb(0 0 0 / 0.5) }
}
.x { color: var(--brand); /* --no: 1; */ --nested: { a: b }; }
--top: 1;`;
    expect(
      propertyDeclarations(css).map((found) => [
        found.name,
        css.slice(found.valueStart, found.valueEnd),
        found.selector,
      ]),
    ).toEqual([
      ["--brand", "#f60", ":root"],
      ["--font", '"a;b", serif', ":root"],
      ["--bg", "rgb(0 0 0 / 0.5)", "@media (prefers-color-scheme: dark) .theme"],
      ["--nested", "{ a: b }", ".x"],
    ]);
  });
});

/** The context at `|` in `css`. */
function at(css: string) {
  return propertyContext(css.replace("|", ""), css.indexOf("|"));
}

describe("propertyContext", () => {
  it("detects var() arguments and declaration names", () => {
    expect(at(".a { color: var(|) }")).toMatchObject({ kind: "var", typed: "" });
    expect(at(".a { color: var( --br|and) }")).toMatchObject({ kind: "var", typed: "--br" });
    expect(at(".a { --b| }")).toMatchObject({ kind: "declaration", typed: "--b" });
    expect(at(".a { color: red; --| }")).toMatchObject({ kind: "declaration", typed: "--" });
  });

  it("ignores other positions", () => {
    expect(at(".a { colo| }")).toBeUndefined();
    expect(at(".a { color: --x| }")).toBeUndefined();
    expect(at(".a { color: calc(|) }")).toBeUndefined();
  });
});

describe("cssImports", () => {
  it("lists global CSS imports, not CSS modules or query imports", () => {
    const text = `import "./app.css";
import theme from "../theme.css";
import styles from "./card.module.css";
import inline from "./a.css?inline";
import { x } from "./x.ts";
const lazy = import("./lazy.css");`;
    expect(cssImports(text)).toEqual(["./app.css", "../theme.css"]);
  });
});
