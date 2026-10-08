import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  documentLanguages,
  resolveServerEntry,
  shouldPromptTakeover,
  takeoverActive,
  usesLumen,
} from "../src/workspace.ts";

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "lumen-vscode-test-")));
  temps.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const SERVER_MANIFEST = JSON.stringify({
  name: "@lumen/language-server",
  bin: { "lumen-language-server": "./src/bin.ts" },
  exports: { ".": "./src/index.ts", "./package.json": "./package.json" },
});

describe("resolveServerEntry", () => {
  test("prefers the lumen.server.path setting, relative to the first folder", () => {
    const root = project({ "tools/server.js": "" });
    expect(
      resolveServerEntry({ configured: "tools/server.js", folders: [root], extensionPath: "/x" }),
    ).toEqual({
      path: join(root, "tools/server.js"),
      source: "setting",
    });
    expect(
      resolveServerEntry({ configured: "missing.js", folders: [root], extensionPath: "/x" }),
    ).toBeUndefined();
  });

  test("resolves @lumen/language-server's bin from a workspace folder", () => {
    const root = project({
      "package.json": "{}",
      "node_modules/@lumen/language-server/package.json": SERVER_MANIFEST,
      "node_modules/@lumen/language-server/src/bin.ts": "",
    });
    expect(resolveServerEntry({ folders: [root], extensionPath: "/x" })).toEqual({
      path: join(root, "node_modules/@lumen/language-server/src/bin.ts"),
      source: "workspace",
    });
  });

  test("resolves the server through the folder's lumen dependency", () => {
    const root = project({
      "package.json": "{}",
      "node_modules/lumen/package.json": JSON.stringify({ name: "lumen" }),
      "node_modules/lumen/node_modules/@lumen/language-server/package.json": SERVER_MANIFEST,
      "node_modules/lumen/node_modules/@lumen/language-server/src/bin.ts": "",
    });
    expect(resolveServerEntry({ folders: [root], extensionPath: "/x" })?.path).toBe(
      join(root, "node_modules/lumen/node_modules/@lumen/language-server/src/bin.ts"),
    );
  });

  test("falls back to a bundled server, else undefined", () => {
    const root = project({ "package.json": "{}" });
    const extension = project({ "server/bin.js": "" });
    expect(resolveServerEntry({ folders: [root], extensionPath: extension })).toEqual({
      path: join(extension, "server/bin.js"),
      source: "bundled",
    });
    expect(resolveServerEntry({ folders: [root], extensionPath: root })).toBeUndefined();
  });
});

describe("usesLumen", () => {
  test("a dependency, an installed package, or the lumen package itself", () => {
    expect(
      usesLumen(project({ "package.json": JSON.stringify({ devDependencies: { lumen: "^1" } }) })),
    ).toBe(true);
    expect(usesLumen(project({ "node_modules/lumen/package.json": "{}" }))).toBe(true);
    expect(usesLumen(project({ "package.json": JSON.stringify({ name: "lumen" }) }))).toBe(true);
    expect(
      usesLumen(project({ "package.json": JSON.stringify({ dependencies: { react: "^19" } }) })),
    ).toBe(false);
    expect(usesLumen(project({}))).toBe(false);
  });
});

describe("takeover", () => {
  test("is active when no TypeScript extension is enabled, unless turned off", () => {
    expect(
      takeoverActive({ setting: "prompt", typescriptExtensionActive: false, usesLumen: true }),
    ).toBe(true);
    expect(
      takeoverActive({ setting: "auto", typescriptExtensionActive: false, usesLumen: false }),
    ).toBe(true);
    expect(
      takeoverActive({ setting: "prompt", typescriptExtensionActive: true, usesLumen: true }),
    ).toBe(false);
    expect(
      takeoverActive({ setting: "off", typescriptExtensionActive: false, usesLumen: true }),
    ).toBe(false);
  });

  test("prompts only in Lumen workspaces with the TypeScript extension on and the setting at prompt", () => {
    expect(
      shouldPromptTakeover({ setting: "prompt", typescriptExtensionActive: true, usesLumen: true }),
    ).toBe(true);
    expect(
      shouldPromptTakeover({
        setting: "prompt",
        typescriptExtensionActive: true,
        usesLumen: false,
      }),
    ).toBe(false);
    expect(
      shouldPromptTakeover({
        setting: "prompt",
        typescriptExtensionActive: false,
        usesLumen: true,
      }),
    ).toBe(false);
    expect(
      shouldPromptTakeover({ setting: "auto", typescriptExtensionActive: true, usesLumen: true }),
    ).toBe(false);
    expect(
      shouldPromptTakeover({ setting: "off", typescriptExtensionActive: true, usesLumen: true }),
    ).toBe(false);
  });

  test("document languages", () => {
    expect(documentLanguages(false)).toEqual(["stsx"]);
    expect(documentLanguages(true)).toEqual([
      "stsx",
      "typescript",
      "typescriptreact",
      "javascript",
      "javascriptreact",
    ]);
  });
});
