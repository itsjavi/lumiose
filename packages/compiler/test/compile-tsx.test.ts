import { describe, expect, it } from "vitest";

// The addon exists only after `pnpm --filter @lumiose/compiler build`.
const binding = await import("../index.js").catch(() => undefined);

describe.skipIf(!binding)("@lumiose/compiler compileTsx (decision-86)", () => {
  const { compileTsx } = binding!;
  const react = [
    'import { useState } from "react";',
    "// Grüße 🎉",
    "export function Counter() {",
    "  const [n, setN] = useState(0);",
    '  return <button className="btn" onClick={() => setN(n + 1)}>{n}<style>.btn { color: red; } .gone { margin: 0; }</style></button>;',
    "}",
    "",
  ].join("\n");

  it("compiles React-style TSX with attribute markers and UTF-16 spans", () => {
    const result = compileTsx(react, "/app/src/Counter.stsx", {
      classAttribute: "className",
      root: "/app",
      styleImport: "/app/src/Counter.stsx.css",
    });
    const token = result.scopeTokens.components.Counter![0]!.attribute;
    expect(token).toMatch(/^data-lum-[0-9a-z]{8}$/);
    expect(result.code).toContain(`<button ${token}="" className="btn"`);
    expect(result.code).not.toContain("<style>");
    expect(result.code.startsWith('import "/app/src/Counter.stsx.css";\n')).toBe(true);
    expect(result.css).toContain(`.btn[${token}]`);
    // `.gone` matches nothing in the component: the inventory reads `className`.
    const unused = result.diagnostics.find((d) => d.code === "LUM3005")!;
    expect(unused.message).toContain("`.gone`");
    expect(react.slice(unused.span.start, unused.span.end)).toBe(".gone");
    expect(JSON.parse(result.map!).sources).toEqual(["/app/src/Counter.stsx"]);
  });

  it("compiles Solid-style TSX with class markers and zero specificity", () => {
    const solid = [
      "export function Item(props: { on: boolean }) {",
      '  return <li class={props.on ? "on" : ""}>item<style>.on { color: teal; }</style></li>;',
      "}",
      "",
    ].join("\n");
    const result = compileTsx(solid, "/src/Item.stsx", {
      classAttribute: "class",
      scopedStyles: { strategy: "class", specificity: "zero", namespace: "app" },
    });
    const marker = result.scopeTokens.components.Item![0]!.attribute;
    expect(marker).toMatch(/^app-[0-9a-z]{8}$/);
    expect(result.code).toContain(
      `class={[props.on ? "on" : "", "${marker}"].filter(Boolean).join(" ")}`,
    );
    expect(result.css).toContain(`.on:where(.${marker})`);
    expect(result.diagnostics).toEqual([]);
  });

  it("rejects an invalid namespace", () => {
    expect(() =>
      compileTsx(react, "/src/A.stsx", {
        classAttribute: "className",
        scopedStyles: { namespace: "Bad" },
      }),
    ).toThrow(/must start with a lowercase letter/);
  });
});
