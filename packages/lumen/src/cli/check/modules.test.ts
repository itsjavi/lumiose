// ModuleHost (TASK-66): TypeScript-compatible resolution of the modules `$` constants are imported
// from, cached sources and dependents, on a temp directory.
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ModuleHost, parseJsonc } from "./modules.ts";

let root: string;

async function write(files: Record<string, string>): Promise<void> {
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }
}

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "lumen-modules-")));
  await write({
    "tsconfig.base.json": `{
      // Comments, trailing commas and URLs in strings are fine.
      "$schema": "https://json.schemastore.org/tsconfig",
      "compilerOptions": { "paths": { "~/*": ["./src/*"], "@tokens": ["./src/styles/tokens.ts"], }, },
    }`,
    "tsconfig.json": `{ "extends": "./tsconfig.base.json", "compilerOptions": { "strict": true } }`,
    "package.json": JSON.stringify({ name: "app", imports: { "#styles/*": "./src/styles/*" } }),
    "src/styles/tokens.ts": "export const space = 4;\n",
    "src/styles/colors.tsx": "export const accent = 'red';\n",
    "src/styles/index.ts": "export * from './tokens.ts';\n",
    "src/styles/data.json": '{ "size": 2 }\n',
    "src/Button.stsx": "export const radius = 2;\n",
    "src/components/Card.stsx": "",
    "node_modules/design/package.json": JSON.stringify({
      name: "design",
      exports: {
        ".": { types: "./index.d.ts", import: "./src/index.ts" },
        "./tokens/*": { types: "./types/*.d.ts", default: "./src/tokens/*.ts" },
        "./internal/*": null,
      },
    }),
    "node_modules/design/index.d.ts": "export declare const brand: string;\n",
    "node_modules/design/src/index.ts": "export const brand = 'blue';\n",
    "node_modules/design/src/tokens/space.ts": "export const unit = 4;\n",
    "node_modules/@scope/legacy/package.json": JSON.stringify({
      name: "@scope/legacy",
      main: "lib/main.js",
    }),
    "node_modules/@scope/legacy/lib/main.js": "export const legacy = 1;\n",
  });
});

afterAll(() => rm(root, { recursive: true, force: true }));

const importer = () => join(root, "src/components/Card.stsx");
const at = (path: string) => join(root, path);

describe("ModuleHost", () => {
  it("resolves relative paths like TypeScript: source for .js, extensions, index, .stsx, .json", () => {
    const host = new ModuleHost({ root });
    const resolve = (specifier: string) => host.resolve(specifier, importer());
    expect(resolve("../styles/tokens.ts")).toBe(at("src/styles/tokens.ts"));
    expect(resolve("../styles/tokens.js")).toBe(at("src/styles/tokens.ts"));
    expect(resolve("../styles/colors.jsx")).toBe(at("src/styles/colors.tsx"));
    expect(resolve("../styles/tokens")).toBe(at("src/styles/tokens.ts"));
    expect(resolve("../styles")).toBe(at("src/styles/index.ts"));
    expect(resolve("../Button.stsx")).toBe(at("src/Button.stsx"));
    expect(resolve("../styles/data.json")).toBe(at("src/styles/data.json"));
    expect(resolve("../styles/missing.ts")).toBeNull();
    expect(resolve("../styles/data")).toBeNull();
  });

  it("resolves tsconfig paths through extends, package imports and package exports", () => {
    const host = new ModuleHost({ root });
    const resolve = (specifier: string) => host.resolve(specifier, importer());
    expect(resolve("~/styles/tokens.ts")).toBe(at("src/styles/tokens.ts"));
    expect(resolve("@tokens")).toBe(at("src/styles/tokens.ts"));
    expect(resolve("#styles/colors.tsx")).toBe(at("src/styles/colors.tsx"));
    // `types` is skipped: declarations have no values.
    expect(resolve("design")).toBe(at("node_modules/design/src/index.ts"));
    expect(resolve("design/tokens/space")).toBe(at("node_modules/design/src/tokens/space.ts"));
    expect(resolve("design/internal/x")).toBeNull();
    expect(resolve("design/src/index.ts")).toBeNull();
    expect(resolve("@scope/legacy")).toBe(at("node_modules/@scope/legacy/lib/main.js"));
    expect(resolve("node:fs")).toBeNull();
    expect(resolve("not-installed")).toBeNull();
  });

  it("reads through the overlay first and caches the disk until invalidated", async () => {
    const tokens = at("src/styles/tokens.ts");
    let buffer: string | undefined;
    const host = new ModuleHost({ root, read: (path) => (path === tokens ? buffer : undefined) });
    expect(await host.load(tokens)).toBe("export const space = 4;\n");
    await writeFile(tokens, "export const space = 8;\n");
    expect(await host.load(tokens)).toBe("export const space = 4;\n");
    buffer = "export const space = 16;\n";
    expect(await host.load(tokens)).toBe(buffer);
    buffer = undefined;
    host.invalidate(tokens);
    expect(await host.load(tokens)).toBe("export const space = 8;\n");
    expect(await host.load(at("src/nope.ts"))).toBeUndefined();
  });

  it("reports the dependents of a changed module, and every file when resolution may change", async () => {
    const host = new ModuleHost({ root });
    const tokens = at("src/styles/tokens.ts");
    const a = at("src/A.stsx");
    const b = at("src/B.stsx");
    host.record(a, [at("src/styles/index.ts"), tokens]);
    host.record(b, [at("src/styles/colors.tsx")]);
    expect(host.invalidate(tokens)).toEqual([a]);
    expect(host.invalidate(at("src/unrelated.ts"))).toEqual([]);

    expect(host.resolve("./styles/new.ts", a)).toBeNull();
    await write({ "src/styles/new.ts": "export const fresh = 1;\n" });
    expect(host.resolve("./styles/new.ts", a)).toBeNull();
    expect(host.invalidate(at("src/styles/new.ts"), "created")).toEqual([a, b]);
    expect(host.resolve("./styles/new.ts", a)).toBe(at("src/styles/new.ts"));

    // A tsconfig edit reloads `paths`.
    await write({
      "tsconfig.json": `{ "compilerOptions": { "paths": { "$/*": ["./src/styles/*"] } } }`,
    });
    expect(host.invalidate(at("tsconfig.json"))).toEqual([a, b]);
    expect(host.resolve("$/tokens.ts", a)).toBe(tokens);
    expect(host.resolve("~/styles/tokens.ts", a)).toBeNull();
    host.record(a, []);
    expect(host.invalidate(tokens)).toEqual([]);
  });

  it("uses the given project's tsconfig", async () => {
    await write({
      "tsconfig.check.json": `{ "compilerOptions": { "paths": { "#t": ["./src/styles/tokens.ts"] } } }`,
    });
    const host = new ModuleHost({ root, project: "tsconfig.check.json" });
    expect(host.resolve("#t", importer())).toBe(at("src/styles/tokens.ts"));
  });
});

describe("parseJsonc", () => {
  it("drops comments and trailing commas outside strings", () => {
    expect(
      parseJsonc(`{
        "a": "// not a comment, }", /* block */ "b": [1, 2,], // line
        "c": { "d": "\\"quoted,]\\"", },
      }`),
    ).toEqual({ a: "// not a comment, }", b: [1, 2], c: { d: '"quoted,]"' } });
  });
});
