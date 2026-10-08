// Locating the project's dev tools (oxlint, oxfmt, stylelint) and reading their JSON(C) configs.

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { CheckFailure } from "./check/diagnostics.ts";

export interface InstalledPackage {
  /** The package directory. */
  dir: string;
  manifest: { version?: string; bin?: string | Record<string, string> };
}

/**
 * Resolves `name` from the project, then from Lumen's own location (a tool installed next to
 * Lumen, e.g. in a monorepo root). `undefined` when it is not installed.
 */
export function findPackage(root: string, name: string): InstalledPackage | undefined {
  for (const base of [join(root, "package.json"), import.meta.url]) {
    let manifestPath: string;
    try {
      manifestPath = createRequire(base).resolve(`${name}/package.json`);
    } catch {
      continue;
    }
    return {
      dir: dirname(manifestPath),
      manifest: JSON.parse(readFileSync(manifestPath, "utf8")) as InstalledPackage["manifest"],
    };
  }
  return undefined;
}

/** {@link findPackage}, or a tool failure telling how to install it. */
export function requirePackage(root: string, name: string, purpose: string): InstalledPackage {
  const found = findPackage(root, name);
  if (found === undefined) {
    throw new CheckFailure(`${name} is not installed in this project (${purpose}).`, {
      help: `Install it: \`pnpm add -D ${name}\`.`,
    });
  }
  return found;
}

/** The absolute path of a package's bin script. */
export function binPath(installed: InstalledPackage, bin: string): string {
  const { bin: bins } = installed.manifest;
  const relative = typeof bins === "string" ? bins : bins?.[bin];
  if (relative === undefined) throw new CheckFailure(`${installed.dir} has no "${bin}" bin.`);
  return join(installed.dir, relative);
}

export interface ProcessOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Runs a Node script (a tool's bin) in `cwd`. */
export function runNode(
  script: string,
  args: readonly string[],
  cwd: string,
): Promise<ProcessOutput> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (cause) => reject(new CheckFailure(`Could not run ${script}.`, { cause })));
    child.on("close", (code, signal) => {
      const output = {
        exitCode: code ?? -1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };
      if (code === null) {
        reject(new CheckFailure(`${script} was terminated by ${signal}.`, { help: output.stderr }));
      } else {
        resolvePromise(output);
      }
    });
  });
}

/** The nearest of `names` in `dir` or its ancestors. */
export function findConfig(dir: string, names: readonly string[]): string | undefined {
  for (let current = dir; ; current = dirname(current)) {
    for (const name of names) {
      const path = join(current, name);
      if (existsSync(path)) return path;
    }
    if (dirname(current) === current) return undefined;
  }
}

/** Parses JSON with comments and trailing commas (`.oxlintrc.json`, `.oxfmtrc.jsonc`, …). */
export function parseJsonc(text: string, file: string): Record<string, unknown> {
  let out = "";
  /** Index in `out` of a comma that is trailing if only whitespace follows before `}` / `]`. */
  let comma = -1;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === '"') {
      const start = i;
      for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === "\\") i++;
      out += text.slice(start, i + 1);
      comma = -1;
    } else if (char === "/" && text[i + 1] === "/") {
      while (i + 1 < text.length && text[i + 1] !== "\n") i++;
    } else if (char === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 1;
    } else if ((char === "}" || char === "]") && comma !== -1) {
      out = out.slice(0, comma) + out.slice(comma + 1) + char;
      comma = -1;
    } else {
      if (char === ",") comma = out.length;
      else if (!/\s/.test(char)) comma = -1;
      out += char;
    }
  }
  try {
    const value: unknown = JSON.parse(out);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch (cause) {
    throw new CheckFailure(`${file} is not valid JSON.`, { cause });
  }
  throw new CheckFailure(`${file} must contain a JSON object.`);
}
