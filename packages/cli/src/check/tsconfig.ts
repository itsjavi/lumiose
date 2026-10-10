// The Lumiose tsconfig (spec §4.7) and the check that a project's resolved tsconfig has what
// shadow type checking needs.

import { dirname, relative, resolve, sep } from "node:path";
import {
  LUMIOSE_COMPILER_OPTIONS,
  LUMIOSE_TSCONFIG,
  SHADOW_DIR,
  shadowPair,
  SOURCE_DIR,
  type ShadowLayout,
} from "@lumiose/vite/internal/layout.ts";
import { runTsc } from "./tsc.ts";

/** tsconfig problems found by `lumiose check` (registered in the compiler's registry, 6xxx). */
export const LUM_TSCONFIG = "LUM6001";

/**
 * The `tsconfig.json` a Lumiose project starts from (decision-25): it extends the generated
 * {@link LUMIOSE_TSCONFIG}, which holds the options of spec §4.7. Projects add their own on top.
 */
export function tsconfigTemplate(): { extends: string } {
  return { extends: `./${LUMIOSE_TSCONFIG}` };
}

/** {@link tsconfigTemplate} as `tsconfig.json` file content, with a comment for humans. */
export function formatTsconfig(): string {
  return `{
  // Lumiose's compiler options, shadow TSX and route types. lumiose dev, build, check and typegen
  // write the generated file; add your own options below.
  "extends": "./${LUMIOSE_TSCONFIG}"
}
`;
}

/**
 * The spec §4.7 options written out, for a tsconfig that does not extend the generated one: its
 * `rootDirs` pair only `src` with its shadows.
 */
export function standaloneTsconfig() {
  return {
    compilerOptions: {
      ...LUMIOSE_COMPILER_OPTIONS,
      types: [...LUMIOSE_COMPILER_OPTIONS.types],
      rootDirs: [SOURCE_DIR, `${SHADOW_DIR}/${SOURCE_DIR}`],
    },
    include: [SOURCE_DIR, SHADOW_DIR, ".lumiose/types"],
  };
}

/** The fully resolved config printed by `tsc --showConfig` (extends applied, paths relative to it). */
export interface ResolvedTsconfig {
  compilerOptions?: Record<string, unknown>;
  /** The program's root files. */
  files?: string[];
}

/** Resolves `project` with `tsc --showConfig`; `undefined` when tsc rejects the config (tsc reports why). */
export async function showConfig(
  tsc: string,
  project: string,
  cwd: string,
): Promise<ResolvedTsconfig | undefined> {
  const { exitCode, output } = await runTsc(tsc, ["--showConfig", "-p", project], cwd);
  if (exitCode !== 0) return undefined;
  try {
    return JSON.parse(output) as ResolvedTsconfig;
  } catch {
    return undefined;
  }
}

export interface TsconfigProblem {
  /** The compiler option or top-level key to fix. */
  option: string;
  message: string;
  help: string;
}

export interface TsconfigExpectations {
  root: string;
  /** Absolute path of the tsconfig (its directory anchors relative paths). */
  project: string;
  /** Absolute shadow paths that must be root files of the program. */
  shadows: readonly string[];
  /** Absolute path of the generated route types, which must be a root file. */
  routeTypes: string;
  /** The shadow layout (from the same tsconfig). */
  layout?: ShadowLayout;
  /** Directories of used Lumiose packages outside the layout's mirror that have `.stsx` files. */
  unshadowedPackages?: readonly string[];
}

/** Options shadow type checking depends on, in a stable order. */
export function tsconfigProblems(
  config: ResolvedTsconfig,
  expected: TsconfigExpectations,
): TsconfigProblem[] {
  const problems: TsconfigProblem[] = [];
  const options = config.compilerOptions ?? {};
  const base = dirname(expected.project);
  const standalone = standaloneTsconfig();

  if (options["jsx"] === undefined) {
    problems.push({
      option: "jsx",
      message: "tsconfig does not set `jsx`.",
      help: 'Set "jsx": "preserve".',
    });
  }
  if (options["jsxImportSource"] !== "lumiose") {
    problems.push({
      option: "jsxImportSource",
      message:
        'tsconfig does not set `jsxImportSource` to "lumiose", so JSX is not typed as Lumiose JSX.',
      help: 'Set "jsxImportSource": "lumiose".',
    });
  }
  const rootDirs = asStrings(options["rootDirs"]).map((dir) => resolve(base, dir));
  const extendGenerated = `extend the generated "${LUMIOSE_TSCONFIG}" ("extends": "./${LUMIOSE_TSCONFIG}")`;
  if (shadowPair(expected.root, rootDirs) === undefined) {
    const missing = standalone.compilerOptions.rootDirs.filter(
      (dir) => !rootDirs.includes(resolve(expected.root, dir)),
    );
    problems.push({
      option: "rootDirs",
      message: `tsconfig \`rootDirs\` lacks ${list(missing)}, so imports of \`.stsx\` files do not resolve to their shadow TSX.`,
      help: `${capitalize(extendGenerated)}, or set "rootDirs": ${JSON.stringify(standalone.compilerOptions.rootDirs)}.`,
    });
  } else if ((expected.unshadowedPackages ?? []).length > 0) {
    const packages = expected.unshadowedPackages!.map((dir) =>
      relative(expected.root, dir).split(sep).join("/"),
    );
    problems.push({
      option: "rootDirs",
      message: `tsconfig \`rootDirs\` pairs only "${relative(
        expected.root,
        expected.layout?.mirrored ?? expected.root,
      )
        .split(sep)
        .join(
          "/",
        )}" with its shadows, so the \`.stsx\` modules of the Lumiose packages in ${list(packages)} are not type-checked.`,
      help: `Instead of setting "rootDirs", ${extendGenerated}: it pairs a directory that contains those packages with "${SHADOW_DIR}".`,
    });
  }
  const roots = new Set((config.files ?? []).map((file) => resolve(base, file)));
  if (expected.shadows.some((shadow) => !roots.has(shadow))) {
    problems.push({
      option: "include",
      message: `tsconfig \`include\` does not cover "${SHADOW_DIR}", so .stsx files that nothing imports (such as routes) are not type-checked.`,
      help: `Add "${SHADOW_DIR}" to "include".`,
    });
  }
  if (!roots.has(expected.routeTypes)) {
    problems.push({
      option: "include",
      message: 'tsconfig `include` does not cover ".lumiose/types", so route types are missing.',
      help: 'Add ".lumiose/types" to "include".',
    });
  }
  if (!asStrings(options["types"]).includes("lumiose/env")) {
    problems.push({
      option: "types",
      message:
        'tsconfig `types` does not include "lumiose/env", so Lumiose globals are not declared.',
      help: 'Add "lumiose/env" to "types".',
    });
  }
  return problems;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function list(items: string[]): string {
  return items.map((item) => `"${item}"`).join(" and ");
}
