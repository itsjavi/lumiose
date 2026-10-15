// Which runtime modules stay with the one island that imports them (./runtime-chunks.ts, TASK-228).
// The build end to end: ./client-runtime.test.ts.
import { describe, expect, it } from "vitest";
import {
  barrel,
  clientEntryHelpers,
  importedNames,
  singleEntryModules,
  type Barrel,
} from "./runtime-chunks.ts";

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

// The client entry `/app/client.ts`, which imports `entry`, beside a loader that imports the
// runtime and the preload helper (`\0helper`) when `loader` is set.
function helpers(entry: string[], loader: boolean) {
  const modules: Record<string, { importedIds: string[]; dynamic?: string[]; entry?: boolean }> = {
    "/app/client.ts": { importedIds: entry, dynamic: ["/app/lazy.ts"], entry: true },
    "/app/lazy.ts": { importedIds: ["\0helper"] },
    "/app/lib.ts": { importedIds: [] },
    "\0helper": { importedIds: [] },
    "/rt/core.ts": { importedIds: [] },
    ...(loader
      ? { "/rt/loader.ts": { importedIds: ["/rt/core.ts", "\0helper"], entry: true } }
      : {}),
  };
  const result = clientEntryHelpers(
    {
      ids: Object.keys(modules),
      info: (id) => {
        const module = modules[id];
        if (module === undefined) return null;
        return {
          isEntry: module.entry ?? false,
          importedIds: module.importedIds,
          dynamicallyImportedIds: module.dynamic ?? [],
          exports: [],
          code: "",
        };
      },
    },
    "/app/client.ts",
    (id) => id.startsWith("\0"),
    (id) => id.startsWith("/rt/") || id.startsWith("\0"),
  );
  return { shared: [...result.shared], own: [...result.own] };
}

describe("clientEntryHelpers()", () => {
  it("shares the helpers that the runtime imports too", () => {
    expect(helpers(["/app/lib.ts", "\0helper"], true)).toEqual({ shared: ["\0helper"], own: [] });
  });

  it("keeps the helpers that only the client entry imports in its chunk", () => {
    expect(helpers(["\0helper"], false)).toEqual({ shared: [], own: ["\0helper"] });
  });

  it("leaves the helpers in the runtime when the client entry imports the runtime", () => {
    expect(helpers(["/rt/core.ts", "\0helper"], true)).toEqual({ shared: [], own: [] });
  });
});
