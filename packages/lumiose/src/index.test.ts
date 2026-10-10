import { fileURLToPath } from "node:url";
import { build, type Rollup } from "vite";
import { describe, expect, it } from "vitest";
import * as browser from "./index.ts";
import * as server from "./index.server.ts";

describe("lumiose package", () => {
  it("loads the public entry", async () => {
    await expect(import("./index.ts")).resolves.toBeTypeOf("object");
  });
});

describe("isServer", () => {
  it("is false in the browser entry and true in the server entry", () => {
    expect(browser.isServer).toBe(false);
    expect(server.isServer).toBe(true);
  });

  it("is folded by a production client build, which drops server branches", async () => {
    const entry = fileURLToPath(new URL("./index.ts", import.meta.url)).replaceAll("\\", "/");
    const code = `import { isServer } from "${entry}";
if (isServer) console.log("SERVER_IF");
console.log(isServer ? "SERVER_TERNARY" : "CLIENT_TERNARY");`;
    const result = (await build({
      configFile: false,
      logLevel: "silent",
      plugins: [
        {
          name: "fold-entry",
          resolveId: (id) => (id === "virtual:fold-entry" ? "\0fold-entry" : undefined),
          load: (id) => (id === "\0fold-entry" ? code : undefined),
        },
      ],
      build: {
        write: false,
        minify: true,
        modulePreload: false,
        rollupOptions: { input: "virtual:fold-entry" },
      },
    })) as Rollup.RollupOutput;
    const output = result.output
      .map((chunk) => (chunk.type === "chunk" ? chunk.code : ""))
      .join("\n");
    expect(output).toContain("CLIENT_TERNARY");
    expect(output).not.toContain("SERVER_TERNARY");
    expect(output).not.toContain("SERVER_IF");
  }, 30_000);
});
