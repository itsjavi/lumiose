import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeFrame, overlayError, overlayScript } from "./errors.ts";

describe("dev errors", () => {
  it("draws a code frame around the line, with a caret at the column", () => {
    const source = "one\ntwo\nthree\nfour\nfive\nsix";
    expect(codeFrame(source, 3, 2)).toBe(
      ["1  |  one", "2  |  two", "3  |  three", "   |   ^", "4  |  four", "5  |  five"].join("\n"),
    );
  });

  it("keeps the location and frame of compiler errors", () => {
    const error = Object.assign(new Error("LUM1001: Unexpected token"), {
      plugin: "lumen",
      id: "/app/src/routes/index.stsx",
      loc: { file: "/app/src/routes/index.stsx", line: 2, column: 5 },
      frame: "\u001b[31m2 | <div>\u001b[39m",
    });
    expect(overlayError(error, "/app")).toMatchObject({
      message: "LUM1001: Unexpected token",
      plugin: "lumen",
      id: "/app/src/routes/index.stsx",
      loc: { file: "/app/src/routes/index.stsx", line: 2, column: 5 },
      frame: "2 | <div>",
    });
  });

  it("locates runtime errors at the first project frame, route groups included", () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "lumen-errors-")));
    try {
      const file = join(root, "src/routes/(app)/page.stsx");
      const error = new Error("Boom");
      error.stack = [
        "Error: Boom",
        `    at /dep/node_modules/lib/index.js:1:1`,
        `    at <h1>Page</h1> (${file}:2:9)`,
        `    at runComponent (/elsewhere/frame.ts:218:20)`,
      ].join("\n");
      mkdirSync(join(root, "src/routes/(app)"), { recursive: true });
      writeFileSync(file, 'export default function Page() {\n  throw new Error("Boom");\n}\n');
      const prepared = overlayError(error, root);
      expect(prepared.loc).toEqual({ file, line: 2, column: 9 });
      expect(prepared.frame).toContain('2  |    throw new Error("Boom");');
      expect(prepared.stack.startsWith("    at /dep/node_modules")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("opens the first error in the overlay, escaped for an inline script", () => {
    const script = overlayScript(
      [
        { message: "</script><b>", stack: "" },
        { message: "second", stack: "" },
      ],
      "/base/",
    );
    expect(script).toContain('import { ErrorOverlay } from "/base/@vite/client"');
    expect(script).not.toContain("</script><b>");
    expect(script).toContain("(+1 more; see the terminal)");
    expect(overlayScript([], "/")).toBe("");
  });
});
