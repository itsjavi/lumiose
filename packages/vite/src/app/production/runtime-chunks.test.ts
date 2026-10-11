// Which runtime modules stay with the one island that imports them (./runtime-chunks.ts, TASK-228).
// The build end to end: ./client-runtime.test.ts.
import { describe, expect, it } from "vitest";
import { barrel, importedNames, singleEntryModules, type Barrel } from "./runtime-chunks.ts";

describe("barrel()", () => {
  it("reads the re-exports of a module that only re-exports", () => {
    const result = barrel(`// A barrel.
export { a, b as c } from "./a.ts";
export * from "./d.ts";
export * as ns from "./e.ts";
export type { T } from "./t.ts";
import type { U } from "./u.ts";
export type V = U;
`);
    expect(result?.named).toEqual(
      new Map([
        ["a", { source: "./a.ts", imported: "a" }],
        ["c", { source: "./a.ts", imported: "b" }],
        ["ns", { source: "./e.ts", imported: "*" }],
      ]),
    );
    expect(result?.stars).toEqual(["./d.ts"]);
  });

  it("rejects modules that declare or import values", () => {
    expect(barrel(`export * from "./a.ts";\nexport const isServer = false;\n`)).toBeUndefined();
    expect(barrel(`import { a } from "./a.ts";\nexport { a };\n`)).toBeUndefined();
    expect(barrel(`export * from "./a.ts";\nconsole.log(1);\n`)).toBeUndefined();
    expect(barrel("")).toBeUndefined();
  });
});

describe("importedNames()", () => {
  it("lists the names each static import and re-export takes", () => {
    const names = importedNames(`import { a, b as c } from "x";
import d from "y";
import * as e from "z";
import "w";
export { f } from "x";
export * from "v";
const g = () => import("u");
`);
    expect(names).toEqual(
      new Map([
        ["x", new Set(["a", "b", "f"])],
        ["y", new Set(["default"])],
        ["z", new Set(["*"])],
        ["w", new Set(["*"])],
        ["v", new Set(["*"])],
      ]),
    );
  });
});

// A runtime with a barrel (`lumiose`), the modules it re-exports, and a loader entry that imports
// `insert`; islands are the loader's dynamic imports.
function graph(islands: Record<string, string>) {
  const modules: Record<
    string,
    { code: string; importedIds: string[]; exports: string[]; dynamic?: string[]; entry?: boolean }
  > = {
    "/rt/loader.ts": {
      code: 'import { insert } from "/rt/insert.ts";',
      importedIds: ["/rt/insert.ts"],
      exports: [],
      dynamic: Object.keys(islands),
      entry: true,
    },
    "/rt/index.ts": {
      code: "",
      importedIds: ["/rt/insert.ts", "/rt/list.ts", "/rt/core.ts"],
      exports: ["insert", "For", "signal"],
    },
    "/rt/insert.ts": { code: "", importedIds: [], exports: ["insert"] },
    "/rt/list.ts": { code: "", importedIds: ["/rt/insert.ts"], exports: ["For"] },
    "/rt/core.ts": { code: "", importedIds: [], exports: ["signal"] },
  };
  for (const [id, code] of Object.entries(islands)) {
    modules[id] = {
      code,
      importedIds: code.includes("/rt/index.ts") ? ["/rt/index.ts"] : [],
      exports: [],
    };
  }
  const barrels = new Map<string, Barrel>([
    [
      "/rt/index.ts",
      {
        named: new Map([
          ["insert", { source: "./insert.ts", imported: "insert" }],
          ["For", { source: "./list.ts", imported: "For" }],
        ]),
        stars: ["./core.ts"],
      },
    ],
  ]);
  return singleEntryModules(
    {
      ids: Object.keys(modules),
      info: (id) => {
        const module = modules[id];
        if (module === undefined) return null;
        return {
          isEntry: module.entry ?? false,
          importedIds: module.importedIds,
          dynamicallyImportedIds: module.dynamic ?? [],
          exports: module.exports,
          code: module.code,
        };
      },
      resolve: async (source, importer) =>
        source.startsWith("/") ? source : new URL(source, `file://${importer}`).pathname,
    },
    barrels,
    (id) => id.startsWith("/rt/"),
  );
}

describe("singleEntryModules()", () => {
  it("follows imports through a barrel to the modules that declare them", async () => {
    const single = await graph({
      "/app/A.ts": 'import { For, signal } from "/rt/index.ts";',
      "/app/B.ts": 'import { insert } from "/rt/index.ts";',
    });
    // list.ts and core.ts: only A; insert.ts: the loader. The imports skip the barrel itself.
    expect([...single].toSorted()).toEqual(["/rt/core.ts", "/rt/list.ts"]);
  });

  it("counts a module that two islands import as shared", async () => {
    const single = await graph({
      "/app/A.ts": 'import { For } from "/rt/index.ts";',
      "/app/B.ts": 'import { For, signal } from "/rt/index.ts";',
    });
    expect([...single]).toEqual(["/rt/core.ts"]);
  });

  it("takes the whole barrel for a namespace import", async () => {
    const single = await graph({
      "/app/A.ts": 'import { signal } from "/rt/index.ts";',
      "/app/B.ts": 'import * as rt from "/rt/index.ts";',
    });
    // B reaches all the barrel re-exports, so core.ts is shared with A.
    expect([...single].toSorted()).toEqual(["/rt/index.ts", "/rt/list.ts"]);
  });
});
