// The Lumiose packages of a project (./packages.ts, TASK-390): linked and installed ones, which
// installed modules @lumiose/vite compiles, and Lumiose's own tooling left out.
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { normalizePath } from "vite";
import { Packages } from "./packages.ts";

let base: string;
let root: string;
const UI = "node_modules/.pnpm/@acme+ui@1.0.0/node_modules/@acme/ui";

function write(file: string, json: object): void {
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, JSON.stringify(json));
}

beforeAll(() => {
  base = normalizePath(realpathSync.native(mkdtempSync(join(tmpdir(), "lumiose-packages-"))));
  root = `${base}/app`;
  const lumiose = { lumiose: "^0.1.0" };
  write(`${root}/package.json`, {
    name: "app",
    dependencies: {
      "@acme/kit": "workspace:*",
      "@acme/ui": "1.0.0",
      "@lumiose/adapter-node": "0.1.0",
      plain: "1.0.0",
    },
  });
  write(`${base}/kit/package.json`, { name: "@acme/kit", dependencies: lumiose });
  write(`${root}/${UI}/package.json`, { name: "@acme/ui", peerDependencies: lumiose });
  write(`${root}/node_modules/@lumiose/adapter-node/package.json`, {
    name: "@lumiose/adapter-node",
    dependencies: lumiose,
  });
  write(`${root}/node_modules/plain/package.json`, { name: "plain" });
  mkdirSync(`${root}/node_modules/@acme`);
  symlinkSync(`${base}/kit`, `${root}/node_modules/@acme/kit`, "junction");
  symlinkSync(`${root}/${UI}`, `${root}/node_modules/@acme/ui`, "junction");
});

afterAll(() => {
  if (base) rmSync(base, { recursive: true, force: true });
});

describe("Packages", () => {
  it("lists linked and installed Lumiose packages, not Lumiose's tooling or other packages", () => {
    const packages = new Packages(root);
    expect(packages.lumiose()).toEqual([
      { name: "@acme/kit", dir: `${base}/kit` },
      { name: "@acme/ui", dir: `${root}/${UI}` },
    ]);
    expect(packages.installed()).toEqual([{ name: "@acme/ui", dir: `${root}/${UI}` }]);
  });

  it("knows the modules of installed Lumiose packages, not of packages nested in them", () => {
    const packages = new Packages(root);
    expect(packages.installs(`${root}/${UI}/dist/Dialog.tsx`)).toBe(true);
    expect(packages.installs(`${root}/${UI}/node_modules/dep/index.tsx`)).toBe(false);
    expect(packages.installs(`${root}/node_modules/plain/index.tsx`)).toBe(false);
    expect(packages.installs(`${base}/kit/src/Nav.tsx`)).toBe(false);
  });

  it("leaves out the packages an explicit exclude matches", () => {
    const packages = new Packages(root, /[\\/]node_modules[\\/]/);
    expect(packages.lumiose().map((p) => p.name)).toEqual(["@acme/kit"]);
  });
});
