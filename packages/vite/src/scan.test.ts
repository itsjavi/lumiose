// The one-time project scan (./scan.ts): the client-script markers it reports (TASK-354). The client
// build end to end: app/production/build.test.ts.
import { describe, expect, it } from "vitest";
import { clientScriptImports } from "./scan.ts";

describe("clientScriptImports()", () => {
  it("lists the static imports with the client-script marker", () => {
    const code = `import defineMenu from "./menu.element.ts?client";
import define, { other } from "@acme/ui/combobox.element.ts?client";
import "./menu.element.ts?client";
import "./theme.css";
import plain from "./menu.element.ts";
const lazy = () => import("./lazy.ts?client");
`;
    expect(clientScriptImports(code)).toEqual([
      "./menu.element.ts?client",
      "@acme/ui/combobox.element.ts?client",
    ]);
  });

  it("finds none in a module without markers", () => {
    expect(clientScriptImports(`import { signal } from "lumiose";\n`)).toEqual([]);
  });
});
