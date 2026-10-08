import { describe, expect, it } from "vitest";
import { readRouteModuleMeta } from "./meta.ts";

describe("readRouteModuleMeta", () => {
  it("reads literal mode and ssr exports", () => {
    expect(readRouteModuleMeta(`export const mode = "spa";\nexport const ssr = false;`)).toEqual({
      mode: "spa",
      ssr: false,
      problems: [],
    });
  });

  it.each([
    [`export const mode = 'server'`, "server"],
    ["export const mode = `server`;", "server"],
    [`export const mode = "server" as const;`, "server"],
    [`export const mode: RouteMode = "server";`, "server"],
    [`export const mode = "server" satisfies RouteMode;`, "server"],
    [`  export   const mode="static" // trailing comment`, "static"],
  ])("accepts %s", (source, mode) => {
    expect(readRouteModuleMeta(source)).toEqual({ mode, problems: [] });
  });

  it("ignores declarations inside comments and strings", () => {
    const source = [
      `// export const mode = "spa";`,
      `/* export const mode = "spa";`,
      `   export const ssr = false; */`,
      "const doc = `",
      `export const mode = "spa";`,
      "`;",
      `export const modes = "x";`,
      `const mode = "server";`,
    ].join("\n");
    expect(readRouteModuleMeta(source)).toEqual({ problems: [] });
  });

  it("survives JSX text and CSS around the exports", () => {
    const source = [
      `export default function Page() { return <p>Don't panic</p>; }`,
      `export const mode = "server";`,
      `<style> a { background: url(https://x.dev/a.png) } /* it's */ </style>`,
    ].join("\n");
    expect(readRouteModuleMeta(source).mode).toBe("server");
  });

  it("reports values that cannot be read statically", () => {
    const meta = readRouteModuleMeta(
      `export const mode = MODE;\nexport let ssr = false;\nexport const ssr = maybe();`,
    );
    expect(meta.mode).toBeUndefined();
    expect(meta.ssr).toBeUndefined();
    expect(meta.problems).toEqual([
      `"export const mode" must be a string literal, for example "server".`,
      `"export let ssr" must be declared with const.`,
      `"export const ssr" must be the literal true or false.`,
    ]);
  });

  it("finds HTTP method exports: declarations and export lists, not types or other names", () => {
    const source = [
      "export const GET: Endpoint = () => new Response();",
      "export async function POST(ctx) { return new Response(); }",
      "function remove() {}",
      "export { remove as DELETE, helper };",
      "export type { PUT } from './types';",
      "export const Gets = 1;",
      "// export function PATCH() {}",
    ].join("\n");
    expect(readRouteModuleMeta(source).methods).toEqual(["GET", "POST", "DELETE"]);
    expect(readRouteModuleMeta("export default function Page() {}").methods).toBeUndefined();
  });
});
