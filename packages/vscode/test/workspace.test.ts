import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  BUNDLED_SERVER,
  documentLanguages,
  resolveServerEntry,
  serverRuntime,
  shouldPromptTakeover,
  takeoverActive,
  usesLumiose,
  type ServerSource,
} from "../src/workspace.ts";

const temps: string[] = [];
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function project(files: Record<string, string>): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "lumiose-vscode-test-")));
  temps.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const SERVER_MANIFEST = JSON.stringify({
  name: "@lumiose/language-server",
  bin: { "lumiose-language-server": "./src/bin.ts" },
  exports: { ".": "./src/index.ts", "./package.json": "./package.json" },
});

describe("resolveServerEntry", () => {
  test("prefers the lumiose.server.path setting, relative to the first folder", () => {
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

  test("resolves @lumiose/language-server's bin from a workspace folder", () => {
    const root = project({
      "package.json": "{}",
      "node_modules/@lumiose/language-server/package.json": SERVER_MANIFEST,
      "node_modules/@lumiose/language-server/src/bin.ts": "",
    });
    expect(resolveServerEntry({ folders: [root], extensionPath: "/x" })).toEqual({
      path: join(root, "node_modules/@lumiose/language-server/src/bin.ts"),
      source: "workspace",
    });
  });

  test("resolves the server through the folder's lumiose dependency", () => {
    const root = project({
      "package.json": "{}",
      "node_modules/lumiose/package.json": JSON.stringify({ name: "lumiose" }),
      "node_modules/lumiose/node_modules/@lumiose/language-server/package.json": SERVER_MANIFEST,
      "node_modules/lumiose/node_modules/@lumiose/language-server/src/bin.ts": "",
    });
    expect(resolveServerEntry({ folders: [root], extensionPath: "/x" })?.path).toBe(
      join(root, "node_modules/lumiose/node_modules/@lumiose/language-server/src/bin.ts"),
    );
  });

  test("falls back to a bundled server, else undefined", () => {
    const root = project({ "package.json": "{}" });
    const extension = project({ [BUNDLED_SERVER]: "" });
    expect(resolveServerEntry({ folders: [root], extensionPath: extension })).toEqual({
      path: join(extension, "server/bin.mjs"),
      source: "bundled",
    });
    expect(resolveServerEntry({ folders: [root], extensionPath: root })).toBeUndefined();
  });
});

function entry(source: ServerSource) {
  return { path: "/x/bin", source };
}

describe("serverRuntime", () => {
  test("runs the bundled server on VS Code's Node.js, others on node", () => {
    expect(serverRuntime(entry("bundled"), undefined)).toEqual({ kind: "vscode" });
    expect(serverRuntime(entry("bundled"), " ")).toEqual({ kind: "vscode" });
    expect(serverRuntime(entry("workspace"), "")).toEqual({ kind: "executable", command: "node" });
    expect(serverRuntime(entry("setting"), undefined)).toEqual({
      kind: "executable",
      command: "node",
    });
  });

  test("lumiose.server.runtime wins for every server", () => {
    expect(serverRuntime(entry("bundled"), "/opt/node24/bin/node")).toEqual({
      kind: "executable",
      command: "/opt/node24/bin/node",
    });
    expect(serverRuntime(entry("workspace"), "bun")).toEqual({
      kind: "executable",
      command: "bun",
    });
  });
});

describe("usesLumiose", () => {
  test("a dependency, an installed package, or the lumiose package itself", () => {
    expect(
      usesLumiose(
        project({ "package.json": JSON.stringify({ devDependencies: { lumiose: "^1" } }) }),
      ),
    ).toBe(true);
    expect(usesLumiose(project({ "node_modules/lumiose/package.json": "{}" }))).toBe(true);
    expect(usesLumiose(project({ "package.json": JSON.stringify({ name: "lumiose" }) }))).toBe(
      true,
    );
    expect(
      usesLumiose(project({ "package.json": JSON.stringify({ dependencies: { react: "^19" } }) })),
    ).toBe(false);
    expect(usesLumiose(project({}))).toBe(false);
  });
});

describe("takeover", () => {
  test("is active when no TypeScript extension is enabled, unless turned off", () => {
    expect(
      takeoverActive({ setting: "prompt", typescriptExtensionActive: false, usesLumiose: true }),
    ).toBe(true);
    expect(
      takeoverActive({ setting: "auto", typescriptExtensionActive: false, usesLumiose: false }),
    ).toBe(true);
    expect(
      takeoverActive({ setting: "prompt", typescriptExtensionActive: true, usesLumiose: true }),
    ).toBe(false);
    expect(
      takeoverActive({ setting: "off", typescriptExtensionActive: false, usesLumiose: true }),
    ).toBe(false);
  });

  test("prompts only in Lumiose workspaces with the TypeScript extension on and the setting at prompt", () => {
    expect(
      shouldPromptTakeover({
        setting: "prompt",
        typescriptExtensionActive: true,
        usesLumiose: true,
      }),
    ).toBe(true);
    expect(
      shouldPromptTakeover({
        setting: "prompt",
        typescriptExtensionActive: true,
        usesLumiose: false,
      }),
    ).toBe(false);
    expect(
      shouldPromptTakeover({
        setting: "prompt",
        typescriptExtensionActive: false,
        usesLumiose: true,
      }),
    ).toBe(false);
    expect(
      shouldPromptTakeover({ setting: "auto", typescriptExtensionActive: true, usesLumiose: true }),
    ).toBe(false);
    expect(
      shouldPromptTakeover({ setting: "off", typescriptExtensionActive: true, usesLumiose: true }),
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
