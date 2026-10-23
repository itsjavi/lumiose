import { describe, expect, it } from "vitest";
import { moduleLinks, reachedPackageModules } from "./reachable.ts";
import type { ScannedModule } from "./scan.ts";

describe("moduleLinks", () => {
  it("lists imports by name, re-exports, own exports and import() calls, without types", () => {
    const links = moduleLinks(
      `import type { T } from "./types.ts";
import { type A, B as C } from "./b.ts";
import D, * as NS from "./d.ts";
import "./side.ts";
import define from "./x.element.ts?client";
export { E, F as G } from "./e.ts";
export type { H } from "./h.ts";
export * from "./star.ts";
export * as I from "./i.ts";
export const own = 1;
export default function main() {}
export { own as alias };
const later = () => import("./later.ts");
`,
      "/m.ts",
      "ts",
    );
    expect(links).toEqual({
      imports: [
        { specifier: "./b.ts", names: ["B"] },
        { specifier: "./d.ts", names: ["default", "*"] },
        { specifier: "./side.ts", names: [] },
      ],
      reexports: [
        { specifier: "./e.ts", exported: "E", imported: "E" },
        { specifier: "./e.ts", exported: "G", imported: "F" },
        { specifier: "./star.ts", exported: "*", imported: "*" },
        { specifier: "./i.ts", exported: "I", imported: "*" },
      ],
      exports: ["own", "default", "alias"],
      dynamic: ["./later.ts"],
      unknownImports: false,
    });
  });

  it("flags computed import() specifiers and import.meta.glob", () => {
    expect(
      moduleLinks("const m = (n) => import(`./m/${n}.ts`);", "/m.js", "js")!.unknownImports,
    ).toBe(true);
    expect(
      moduleLinks('const all = import.meta.glob("./m/*.ts");', "/m.js", "js")!.unknownImports,
    ).toBe(true);
    expect(moduleLinks("const m = import(`./m.ts`);", "/m.js", "js")).toMatchObject({
      dynamic: ["./m.ts"],
      unknownImports: false,
    });
  });

  it("is null for a module that does not parse", () => {
    expect(moduleLinks("export const = ;", "/m.js", "js")).toBeNull();
  });
});

/** Scanned modules from `/path: code`; `/pkg/…` modules are the package `pkg`'s. */
function scanned(files: Record<string, string>): ScannedModule[] {
  return Object.entries(files).map(([file, code]) => ({
    file,
    islands: [],
    hasStyles: false,
    stylesheets: [],
    ...(file.startsWith("/pkg/") ? { package: "pkg" } : {}),
    links: moduleLinks(code, file, "ts"),
  }));
}

/** Resolves `pkg` to `/pkg/index.ts`, `pkg/x` to `/pkg/x.ts`, and relative specifiers. */
const options = (extra: (id: string) => boolean = () => false) => ({
  async resolve(specifier: string, importer: string) {
    if (specifier === "pkg") return "/pkg/index.ts";
    if (specifier.startsWith("pkg/")) return `/${specifier}.ts`;
    if (specifier.startsWith("./")) return importer.replace(/[^/]+$/, specifier.slice(2));
    return null;
  },
  isPackageSource: (id: string) => extra(id),
});

const PACKAGE = {
  "/pkg/index.ts": `export { Menu } from "./menu.ts";
export { Dialog as Modal } from "./dialog.ts";
export * from "./more.ts";
export * as icons from "./icons.ts";
`,
  "/pkg/more.ts": `export * from "./tabs.ts";
export * from "./toast.ts";
`,
  "/pkg/menu.ts": `import { place } from "./place.ts";
export const Menu = () => place();
`,
  "/pkg/dialog.ts": `export const Dialog = () => null;\n`,
  "/pkg/tabs.ts": `export const Tabs = () => null;\n`,
  "/pkg/toast.ts": `export const Toast = () => null;\n`,
  "/pkg/icons.ts": `export const Star = () => null;\n`,
  "/pkg/place.ts": `export const place = () => null;\nexport const unused = 1;\n`,
};

const reached = async (app: string, extra?: Record<string, string>) => {
  const result = await reachedPackageModules(
    scanned({ ...PACKAGE, ...extra, "/app/page.ts": app }),
    options(),
  );
  return result === null ? null : [...result].toSorted();
};

describe("reachedPackageModules", () => {
  it("follows named imports through re-exports to the modules that define them", async () => {
    expect(await reached(`import { Menu } from "pkg";\nexport const page = Menu;\n`)).toEqual([
      "/pkg/menu.ts",
      "/pkg/place.ts",
    ]);
    expect(await reached(`import { Modal } from "pkg";\n`)).toEqual(["/pkg/dialog.ts"]);
  });

  it("follows names through export * to the module that has them only", async () => {
    expect(await reached(`import { Toast } from "pkg";\n`)).toEqual(["/pkg/toast.ts"]);
  });

  it("runs everything a namespace import, export * as or a project re-export reaches", async () => {
    expect(await reached(`import * as ui from "pkg";\n`)).toEqual([
      "/pkg/dialog.ts",
      "/pkg/icons.ts",
      "/pkg/index.ts",
      "/pkg/menu.ts",
      "/pkg/more.ts",
      "/pkg/place.ts",
      "/pkg/tabs.ts",
      "/pkg/toast.ts",
    ]);
    expect(await reached(`import { icons } from "pkg";\n`)).toEqual(["/pkg/icons.ts"]);
    // The project's own modules run, and so does every export they re-export.
    expect(await reached(`export { Tabs } from "pkg";\n`)).toEqual(["/pkg/tabs.ts"]);
  });

  it("follows deep imports, side-effect imports and import() calls", async () => {
    expect(await reached(`import { Dialog } from "pkg/dialog";\n`)).toEqual(["/pkg/dialog.ts"]);
    expect(await reached(`import "pkg/tabs";\n`)).toEqual(["/pkg/tabs.ts"]);
    expect(await reached(`const load = () => import("pkg/toast");\n`)).toEqual(["/pkg/toast.ts"]);
  });

  it("reaches nothing from type-only imports", async () => {
    expect(await reached(`import type { Menu } from "pkg";\n`)).toEqual([]);
  });

  it("gives up on a computed import() in a package module that runs", async () => {
    const lazy = { "/pkg/menu.ts": `export const Menu = (n) => import(\`./\${n}.ts\`);\n` };
    expect(await reached(`import { Menu } from "pkg";\n`, lazy)).toBeNull();
    // Unless nothing runs it.
    expect(await reached(`import { Tabs } from "pkg";\n`, lazy)).toEqual(["/pkg/tabs.ts"]);
    // The project's own computed imports load project modules, which run anyway.
    expect(await reached(`const page = (n) => import(\`./\${n}.ts\`);\n`)).toEqual([]);
  });

  it("gives up on an import of a package source module the scan did not read", async () => {
    const result = await reachedPackageModules(
      scanned({ ...PACKAGE, "/app/page.ts": `import { Gone } from "pkg/gone";\n` }),
      options((id) => id === "/pkg/gone.ts"),
    );
    expect(result).toBeNull();
  });
});
