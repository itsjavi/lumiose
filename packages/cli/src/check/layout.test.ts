// Shadow layouts (TASK-73): `.stsx` imports that leave `src/`, and `.stsx` modules of linked
// workspace packages, type-check through the generated `.lumiose/tsconfig.generated.json`. Temp
// workspaces get `lumiose` and `typescript` linked into `node_modules`, and are checked with the real
// scanner and TypeScript 7.
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { main } from "../main.ts";
import { LUM_TSCONFIG, type CheckReport } from "./index.ts";
import {
  LUMIOSE_TSCONFIG,
  lumiosePackages,
  shadowLayout,
  shadowPair,
} from "@lumiose/vite/internal/layout.ts";
import { shadowPathFor, sourcePathForShadow, syncShadows } from "./shadow.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = join(here, "../../../lumiose");
const typescriptDir = dirname(createRequire(import.meta.url).resolve("typescript/package.json"));
const binding = await import("@lumiose/compiler").catch(() => undefined);

const temps: string[] = [];
afterAll(async () => {
  await Promise.all(temps.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** Writes `files` (path → content; objects as JSON) into a fresh temp directory. */
async function workspace(files: Record<string, string | object>): Promise<string> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "lumiose-layout-")));
  temps.push(dir);
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(
      join(dir, path),
      typeof content === "string" ? content : JSON.stringify(content, null, 2),
    );
  }
  return dir;
}

/** Links `lumiose`, `typescript` and the given workspace packages into `<dir>/node_modules`. */
async function link(dir: string, packages: Record<string, string> = {}): Promise<void> {
  const links = { lumiose: packageDir, typescript: typescriptDir, ...packages };
  for (const [name, target] of Object.entries(links)) {
    await mkdir(dirname(join(dir, "node_modules", name)), { recursive: true });
    await symlink(target, join(dir, "node_modules", name), "junction");
  }
}

async function checkJson(root: string) {
  let stdout = "";
  const exitCode = await main(["check", "--root", root, "--format", "json"], {
    cwd: root,
    color: false,
    write: (text) => void (stdout += text),
    writeError: () => undefined,
  });
  return { exitCode, report: JSON.parse(stdout) as CheckReport };
}

const COMPILER_OPTIONS = {
  module: "preserve",
  moduleResolution: "bundler",
  allowImportingTsExtensions: true,
  noEmit: true,
  strict: true,
};
const EXTENDS_GENERATED = { extends: `./${LUMIOSE_TSCONFIG}`, compilerOptions: COMPILER_OPTIONS };

/** The `@acme/ui` library: a `.ts` entry re-exporting `.stsx` components. */
const UI = {
  "packages/ui/package.json": {
    name: "@acme/ui",
    type: "module",
    exports: { ".": "./src/index.ts" },
    dependencies: { lumiose: "workspace:*" },
  },
  "packages/ui/src/index.ts": 'export { Badge } from "./Badge.stsx";\n',
  "packages/ui/src/tone.ts": 'export type Tone = "info" | "warn";\n',
  "packages/ui/src/Badge.stsx": [
    'import type { Tone } from "./tone.ts";',
    "",
    "export function Badge(props: { tone: Tone; label: string }) {",
    "  return <span class={props.tone}>{props.label}</span>;",
    "}",
    "",
    "<style>",
    "  span { padding: 2px; }",
    "</style>",
    "",
  ].join("\n"),
};

describe("shadowPair", () => {
  /** A native absolute path (`D:\w\…` on Windows). */
  const p = (path: string) => resolve(path);

  it("pairs .lumiose/shadow/p with B/p around the root's src", () => {
    const root = p("/w/apps/web");
    expect(shadowPair(root, [p("/w/apps/web/src"), p("/w/apps/web/.lumiose/shadow/src")])).toEqual({
      base: root,
      mirrored: p("/w/apps/web/src"),
    });
    expect(shadowPair(root, [p("/w"), p("/w/apps/web/.lumiose/shadow")])).toEqual({
      base: p("/w"),
      mirrored: p("/w"),
    });
    // A pair that does not contain the root's src, or no shadow entry at all.
    expect(shadowPair(root, [p("/w/lib"), p("/w/apps/web/.lumiose/shadow/lib")])).toBeUndefined();
    expect(shadowPair(root, [p("/w/apps/web/src")])).toBeUndefined();
  });

  it("maps sources to shadows below the mirror base and back", () => {
    const layout = { base: p("/w") };
    const shadow = shadowPathFor(p("/w/apps/web"), p("/w/packages/ui/src/Badge.stsx"), layout);
    expect(shadow).toBe(p("/w/apps/web/.lumiose/shadow/packages/ui/src/Badge.stsx.tsx"));
    expect(sourcePathForShadow(p("/w/apps/web"), shadow, layout)).toBe(
      p("/w/packages/ui/src/Badge.stsx"),
    );
  });
});

describe.skipIf(!binding)("lumiose check with the generated tsconfig", () => {
  it("type-checks .stsx modules of linked workspace packages", async () => {
    const dir = await workspace({
      ...UI,
      "apps/web/package.json": {
        name: "web",
        dependencies: { lumiose: "workspace:*", "@acme/ui": "workspace:*" },
      },
      "apps/web/tsconfig.json": EXTENDS_GENERATED,
      "apps/web/src/App.stsx": [
        'import { Badge } from "@acme/ui";',
        "",
        'export const ok = <Badge tone="info" label="Hi" />;',
        'export const bad = <Badge tone="loud" label="Hi" />;',
        "",
      ].join("\n"),
    });
    const root = join(dir, "apps/web");
    await link(root, { "@acme/ui": join(dir, "packages/ui") });

    expect(lumiosePackages(root)).toEqual([join(dir, "packages/ui")]);
    const { exitCode, report } = await checkJson(root);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({ source: "ts", code: "TS2322", file: "src/App.stsx", line: 4 }),
    ]);
    expect(exitCode).toBe(1);

    // The workspace root is the mirror base; the package's shadows sit below it.
    const generated = await readFile(join(root, LUMIOSE_TSCONFIG), "utf8");
    expect(generated).toContain('"rootDirs": [\n      "../../..",\n      "./shadow"\n    ]');
    expect(existsSync(join(root, ".lumiose/shadow/apps/web/src/App.stsx.tsx"))).toBe(true);
    expect(existsSync(join(root, ".lumiose/shadow/packages/ui/src/Badge.stsx.tsx"))).toBe(true);
    expect(existsSync(join(root, ".lumiose/shadow/src"))).toBe(false);
  });

  it("type-checks .stsx modules of installed packages (TASK-398)", async () => {
    // `@acme/ui` installed from npm, in pnpm's layout: its sources, `.stsx` included, in node_modules.
    const store = "node_modules/.pnpm/@acme+ui@1.0.0/node_modules/@acme/ui";
    const installed = Object.fromEntries(
      Object.entries(UI).map(([path, content]) => [
        path.replace("packages/ui", `app/${store}`),
        path.endsWith("package.json")
          ? {
              ...(content as object),
              version: "1.0.0",
              dependencies: undefined,
              peerDependencies: { lumiose: "*" },
            }
          : content,
      ]),
    );
    const dir = await workspace({
      ...installed,
      "app/package.json": { name: "app", dependencies: { lumiose: "*", "@acme/ui": "1.0.0" } },
      "app/tsconfig.json": EXTENDS_GENERATED,
      "app/src/App.stsx": [
        'import { Badge } from "@acme/ui";',
        "",
        'export const ok = <Badge tone="info" label="Hi" />;',
        'export const bad = <Badge tone="loud" label="Hi" />;',
        "",
      ].join("\n"),
    });
    const root = join(dir, "app");
    await link(root, { "@acme/ui": join(root, store) });

    const { exitCode, report } = await checkJson(root);
    // The generated tsconfig (written by the check) mirrors the root, node_modules included.
    expect(shadowLayout(root).packages).toEqual([join(root, store)]);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({ source: "ts", code: "TS2322", file: "src/App.stsx", line: 4 }),
    ]);
    expect(exitCode).toBe(1);
    expect(existsSync(join(root, `.lumiose/shadow/${store}/src/Badge.stsx.tsx`))).toBe(true);
  });

  it("reports errors in a package's .stsx at the package source", async () => {
    const dir = await workspace({
      ...UI,
      "packages/ui/src/Badge.stsx": "export function Badge(): number {\n  return 'no';\n}\n",
      "apps/web/package.json": { dependencies: { lumiose: "*", "@acme/ui": "*" } },
      "apps/web/tsconfig.json": EXTENDS_GENERATED,
      "apps/web/src/main.ts":
        'import { Badge } from "@acme/ui";\nexport const n: number = Badge();\n',
    });
    const root = join(dir, "apps/web");
    await link(root, { "@acme/ui": join(dir, "packages/ui") });
    const { report } = await checkJson(root);
    expect(report.diagnostics).toEqual([
      expect.objectContaining({
        code: "TS2322",
        file: "../../packages/ui/src/Badge.stsx",
        line: 2,
        column: 3,
      }),
    ]);
  });

  it("resolves .stsx imports that leave src/ (a showcase inside its library)", async () => {
    const dir = await workspace({
      ...UI,
      "packages/ui/showcase/tsconfig.json": EXTENDS_GENERATED,
      "packages/ui/showcase/src/Showcase.stsx": [
        'import { Badge } from "../../src/index.ts";',
        'import type { Tone } from "../../src/tone.ts";',
        "",
        'const tone: Tone = "warn";',
        "export const Showcase = () => <Badge tone={tone} label={1} />;",
        "",
      ].join("\n"),
    });
    const root = join(dir, "packages/ui/showcase");
    await link(root);

    const { report } = await checkJson(root);
    // Only the deliberate error: every import resolved.
    expect(report.diagnostics).toEqual([
      expect.objectContaining({ code: "TS2322", file: "src/Showcase.stsx", line: 5 }),
    ]);
    // The enclosing package is the mirror base.
    expect(await readFile(join(root, LUMIOSE_TSCONFIG), "utf8")).toContain('"../..",');
    expect(shadowLayout(root)).toMatchObject({
      base: join(dir, "packages/ui"),
      packages: [join(dir, "packages/ui")],
    });
    expect(existsSync(join(root, ".lumiose/shadow/showcase/src/Showcase.stsx.tsx"))).toBe(true);
    expect(existsSync(join(root, ".lumiose/shadow/src/Badge.stsx.tsx"))).toBe(true);
  });

  it("warns when the tsconfig's rootDirs leave a used package's .stsx unshadowed", async () => {
    const dir = await workspace({
      ...UI,
      "apps/web/package.json": { dependencies: { lumiose: "*", "@acme/ui": "*" } },
      "apps/web/tsconfig.json": {
        compilerOptions: {
          ...COMPILER_OPTIONS,
          jsx: "preserve",
          jsxImportSource: "lumiose",
          rootDirs: ["src", ".lumiose/shadow/src"],
          types: ["lumiose/env"],
        },
        include: ["src", ".lumiose/shadow", ".lumiose/types"],
      },
      "apps/web/src/main.ts": 'export { Badge } from "@acme/ui";\n',
    });
    const root = join(dir, "apps/web");
    await link(root, { "@acme/ui": join(dir, "packages/ui") });
    const { report } = await checkJson(root);
    expect(report.diagnostics).toContainEqual(
      expect.objectContaining({
        code: LUM_TSCONFIG,
        severity: "warning",
        message: expect.stringContaining('Lumiose packages in "../../packages/ui"'),
        help: expect.stringContaining(LUMIOSE_TSCONFIG),
      }),
    );
    // The default layout: own shadows only, at the usual paths.
    const { files, layout } = await syncShadows(root);
    expect(layout.base).toBe(root);
    expect(files).toEqual([]);
  });
});
