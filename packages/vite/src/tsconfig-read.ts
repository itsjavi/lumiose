// Reading tsconfig options through `extends` chains, and JSON with comments (TASK-39: shared by
// @lumiose/vite's generated tsconfig and @lumiose/cli's checks).

import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";

function isPathSpecifier(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    isAbsolute(specifier)
  );
}

function isFile(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A `compilerOptions` value of a tsconfig, following `extends` like TypeScript: the nearest
 * declaration wins, later entries of an `extends` array override earlier ones, and `base` is the
 * directory of the declaring file (paths in the value are relative to it). `files` collects the
 * configs read.
 */
export function readTsconfigOption(
  file: string,
  option: string,
  files: Set<string> = new Set(),
): { base: string; value: unknown } | undefined {
  if (files.has(file)) return undefined;
  files.add(file);
  let config: unknown;
  try {
    config = parseJsonc(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
  if (!isObject(config)) return undefined;
  const options = config["compilerOptions"];
  if (isObject(options) && options[option] !== undefined) {
    return { base: dirname(file), value: options[option] };
  }
  const parents = config["extends"];
  let inherited: { base: string; value: unknown } | undefined;
  for (const parent of typeof parents === "string"
    ? [parents]
    : Array.isArray(parents)
      ? parents
      : []) {
    if (typeof parent !== "string") continue;
    const path = resolveExtends(parent, dirname(file));
    inherited =
      (path === undefined ? undefined : readTsconfigOption(path, option, files)) ?? inherited;
  }
  return inherited;
}

function resolveExtends(specifier: string, dir: string): string | undefined {
  if (isPathSpecifier(specifier)) {
    const path = resolve(dir, specifier);
    return isFile(path) ? path : isFile(`${path}.json`) ? `${path}.json` : undefined;
  }
  const require = createRequire(join(dir, "tsconfig.json"));
  for (const candidate of [specifier, `${specifier}.json`, `${specifier}/tsconfig.json`]) {
    try {
      return require.resolve(candidate);
    } catch {
      // Next candidate.
    }
  }
  return undefined;
}

/** JSON with comments and trailing commas (tsconfig). */
export function parseJsonc(text: string): unknown {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === '"') {
      const end = stringEnd(text, i);
      out += text.slice(i, end);
      i = end - 1;
    } else if (char === "/" && text[i + 1] === "/") {
      while (i + 1 < text.length && text[i + 1] !== "\n") i++;
    } else if (char === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 1;
    } else if (char === "," && /^\s*[}\]]/.test(text.slice(i + 1).replace(COMMENTS, ""))) {
      // A trailing comma.
    } else {
      out += char;
    }
  }
  return JSON.parse(out);
}

/** Leading comments and whitespace (to look past them after a comma). */
const COMMENTS = /^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)+/;

/** The index after the closing quote of the string starting at `start`. */
function stringEnd(text: string, start: number): number {
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === '"') return i + 1;
  }
  return text.length;
}
