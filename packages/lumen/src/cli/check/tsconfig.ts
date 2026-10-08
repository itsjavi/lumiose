// The Lumen tsconfig (spec §4.7) and the check that a project's resolved tsconfig has what
// shadow type checking needs.

import { dirname, resolve } from "node:path";
import { SHADOW_DIR, SOURCE_DIR } from "./shadow.ts";
import { runTsc } from "./tsc.ts";

/**
 * Provisional code for tsconfig problems found by `lumen check`.
 * TODO(Lux/Photon): register a tooling range in `crates/lumen_compiler/src/diagnostics/registry.rs`.
 */
export const LUM_TSCONFIG = "LUM6001";

/** The tsconfig a Lumen project starts from (spec §4.7). */
export function tsconfigTemplate() {
  return {
    compilerOptions: {
      jsx: "preserve",
      jsxImportSource: "lumen",
      module: "preserve",
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      noEmit: true,
      strict: true,
      rootDirs: [SOURCE_DIR, `${SHADOW_DIR}/${SOURCE_DIR}`],
      types: ["lumen/env"],
    },
    include: [SOURCE_DIR, SHADOW_DIR, ".lumen/types"],
  };
}

/** {@link tsconfigTemplate} as `tsconfig.json` file content. */
export function formatTsconfig(): string {
  return `${JSON.stringify(tsconfigTemplate(), null, 2)}\n`;
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
}

/** Options shadow type checking depends on, in a stable order. */
export function tsconfigProblems(
  config: ResolvedTsconfig,
  expected: TsconfigExpectations,
): TsconfigProblem[] {
  const problems: TsconfigProblem[] = [];
  const options = config.compilerOptions ?? {};
  const base = dirname(expected.project);
  const template = tsconfigTemplate();

  if (options["jsx"] === undefined) {
    problems.push({
      option: "jsx",
      message: "tsconfig does not set `jsx`.",
      help: 'Set "jsx": "preserve".',
    });
  }
  if (options["jsxImportSource"] !== "lumen") {
    problems.push({
      option: "jsxImportSource",
      message:
        'tsconfig does not set `jsxImportSource` to "lumen", so JSX is not typed as Lumen JSX.',
      help: 'Set "jsxImportSource": "lumen".',
    });
  }
  const rootDirs = new Set(asStrings(options["rootDirs"]).map((dir) => resolve(base, dir)));
  const missingRootDirs = template.compilerOptions.rootDirs.filter(
    (dir) => !rootDirs.has(resolve(expected.root, dir)),
  );
  if (missingRootDirs.length > 0) {
    problems.push({
      option: "rootDirs",
      message: `tsconfig \`rootDirs\` lacks ${list(missingRootDirs)}, so imports of \`.stsx\` files do not resolve to their shadow TSX.`,
      help: `Set "rootDirs": ${JSON.stringify(template.compilerOptions.rootDirs)}.`,
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
      message: 'tsconfig `include` does not cover ".lumen/types", so route types are missing.',
      help: 'Add ".lumen/types" to "include".',
    });
  }
  if (!asStrings(options["types"]).includes("lumen/env")) {
    problems.push({
      option: "types",
      message: 'tsconfig `types` does not include "lumen/env", so Lumen globals are not declared.',
      help: 'Add "lumen/env" to "types".',
    });
  }
  return problems;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function list(items: string[]): string {
  return items.map((item) => `"${item}"`).join(" and ");
}
