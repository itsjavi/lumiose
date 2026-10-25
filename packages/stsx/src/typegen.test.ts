// `stsx typegen` and the plugin's shadows (TASK-581): masked TSX in the `rootDirs` shadow directory
// (default `.lumiose/stsx`), stale shadows removed, the tsconfig hint, fresh shadows from the dev
// server, and stock `tsc` checking React and Solid projects through them.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createLogger, createServer } from "vite";
import { main } from "./cli.ts";
import stsx from "./index.ts";

const binding = await import("@lumiose/compiler").catch(() => undefined);
const packageDir = fileURLToPath(new URL("..", import.meta.url));
const tsc = join(packageDir, "../../node_modules/.bin/tsc");
const dirs: string[] = [];

/** A copy of a fixture with the package's node_modules, and `tsconfig` as its tsconfig.json. */
function project(fixture: string, tsconfig?: object): string {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-stsx-types-")));
  dirs.push(root);
  cpSync(join(packageDir, "test/fixtures", fixture), root, {
    recursive: true,
    filter: (path) => !path.includes(".lumiose") && !path.endsWith("Broken.stsx"),
  });
  symlinkSync(join(packageDir, "node_modules"), join(root, "node_modules"), "junction");
  if (tsconfig) writeFileSync(join(root, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));
  return root;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const COMPILER_OPTIONS = {
  target: "esnext",
  module: "preserve",
  moduleResolution: "bundler",
  strict: true,
  noEmit: true,
  allowImportingTsExtensions: true,
  skipLibCheck: true,
  types: [],
  rootDirs: [".", ".lumiose/stsx"],
};

function typecheck(root: string): { status: number | null; output: string } {
  const result = spawnSync(tsc, ["-p", join(root, "tsconfig.json")], { encoding: "utf8" });
  return { status: result.status, output: result.stdout + result.stderr };
}

describe.skipIf(!binding)("stsx typegen", () => {
  it("writes masked shadows, removes stale ones and prints the tsconfig hint", () => {
    const root = project("react");
    mkdirSync(join(root, ".lumiose/stsx"), { recursive: true });
    writeFileSync(join(root, ".lumiose/stsx/Gone.stsx.tsx"), "");
    const lines: string[] = [];
    expect(main(["typegen", root], (line) => lines.push(line))).toBe(0);
    const shadow = readFileSync(join(root, ".lumiose/stsx/App.stsx.tsx"), "utf8");
    const source = readFileSync(join(root, "App.stsx"), "utf8");
    expect(shadow).toHaveLength(source.length);
    expect(shadow).not.toContain(".counter {");
    expect(shadow).toContain('import { useState } from "react";');
    expect(existsSync(join(root, ".lumiose/stsx/Gone.stsx.tsx"))).toBe(false);
    expect(lines.join("\n")).toContain("1 stale removed");
    expect(lines.join("\n")).toContain('"rootDirs": [".", ".lumiose/stsx"]');
  });

  it("writes to the rootDirs entry named stsx", () => {
    const root = project("react", {
      compilerOptions: { ...COMPILER_OPTIONS, rootDirs: [".", ".types/stsx"] },
    });
    const lines: string[] = [];
    main(["typegen", root], (line) => lines.push(line));
    expect(existsSync(join(root, ".types/stsx/App.stsx.tsx"))).toBe(true);
    expect(lines.join("\n")).not.toContain("rootDirs");
  });

  it("are written by the dev server and kept fresh on edits", async () => {
    const root = project("react");
    const server = await createServer({
      root,
      configFile: false,
      customLogger: createLogger("silent"),
      plugins: [stsx({ classAttribute: "className" })],
      appType: "custom",
      server: { middlewareMode: true, ws: false, watch: null },
    });
    try {
      await server.environments.client.pluginContainer.buildStart({});
      const shadow = join(root, ".lumiose/stsx/App.stsx.tsx");
      expect(existsSync(shadow)).toBe(true);
      const file = join(root, "App.stsx");
      writeFileSync(file, readFileSync(file, "utf8").replace("count: {count}", "clicks: {count}"));
      server.watcher.emit("change", file);
      await expect.poll(() => readFileSync(shadow, "utf8")).toContain("clicks: {count}");
    } finally {
      await server.close();
    }
  });

  it("writes and removes nothing for files outside the root (TASK-589)", async () => {
    const root = project("react");
    // A linked package's file, next to the project: its shadow would be outside the shadow
    // directory (`.lumiose/<linked dir>/Linked.stsx.tsx`).
    const linked = `${root}-linked`;
    dirs.push(linked);
    mkdirSync(linked);
    const file = join(linked, "Linked.stsx");
    writeFileSync(file, `export const Linked = () => <p className="x">linked</p>;\n`);
    const stray = join(root, ".lumiose", `${linked.split(/[\\/]/).pop()}/Linked.stsx.tsx`);
    const server = await createServer({
      root,
      configFile: false,
      customLogger: createLogger("silent"),
      plugins: [stsx({ classAttribute: "className" })],
      appType: "custom",
      server: { middlewareMode: true, ws: false, watch: null },
    });
    const updated = async (event: "change" | "unlink") => {
      server.watcher.emit(event, file);
      // The hot update hooks run on the next ticks.
      await new Promise((done) => setTimeout(done, 200));
    };
    try {
      await server.environments.client.pluginContainer.buildStart({});
      await updated("change");
      expect(existsSync(stray)).toBe(false);
      // A file that happens to be at that path survives the source's removal.
      mkdirSync(join(stray, ".."), { recursive: true });
      writeFileSync(stray, "// not a shadow\n");
      rmSync(file);
      await updated("unlink");
      expect(readFileSync(stray, "utf8")).toBe("// not a shadow\n");
    } finally {
      await server.close();
    }
  });

  it("lets tsc check a React project, at the .stsx line and column", () => {
    const root = project("react", {
      compilerOptions: { ...COMPILER_OPTIONS, jsx: "react-jsx", types: ["react"] },
      include: ["*.ts", "*.tsx", ".lumiose/stsx/**/*"],
    });
    main(["typegen", root], () => {});
    expect(typecheck(root)).toEqual({ status: 0, output: "" });
    const file = join(root, "App.stsx");
    const source = readFileSync(file, "utf8").replace("setCount(count + 1)", 'setCount("one")');
    writeFileSync(file, source);
    main(["typegen", root], () => {});
    const { status, output } = typecheck(root);
    expect(status).not.toBe(0);
    const line = source.split("\n").findIndex((l) => l.includes('setCount("one")')) + 1;
    const column = source.split("\n")[line - 1]!.indexOf('"one"') + 1;
    expect(output).toContain(`App.stsx.tsx(${line},${column}): error TS2345`);
  });

  it("lets tsc check a Solid project", () => {
    const root = project("solid", {
      compilerOptions: { ...COMPILER_OPTIONS, jsx: "preserve", jsxImportSource: "solid-js" },
      include: ["*.ts", "*.tsx", ".lumiose/stsx/**/*"],
    });
    main(["typegen", root], () => {});
    expect(typecheck(root)).toEqual({ status: 0, output: "" });
  });
});
