// Runs the project's TypeScript (`tsc`, TS 7) and parses its `--pretty false` output.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { CheckFailure } from "./diagnostics.ts";

export interface TypeScriptInstall {
  /** Absolute path of the `tsc` bin script (run with Node). */
  tsc: string;
  version: string;
}

/** Resolves `typescript` from the project, falling back to the copy Lumiose itself resolves. */
export function resolveTypeScript(root: string): TypeScriptInstall {
  for (const base of [join(root, "package.json"), import.meta.url]) {
    let manifestPath: string;
    try {
      manifestPath = createRequire(base).resolve("typescript/package.json");
    } catch {
      continue;
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      version: string;
      bin?: string | Record<string, string>;
    };
    const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.tsc;
    if (bin !== undefined)
      return { tsc: join(dirname(manifestPath), bin), version: manifest.version };
  }
  throw new CheckFailure("TypeScript is not installed in this project.", {
    help: "Install TypeScript 7: `pnpm add -D typescript@^7`.",
  });
}

export interface ProcessResult {
  exitCode: number;
  output: string;
}

/** Runs `tsc` with `args` in `cwd`; stdout and stderr are combined. */
export function runTsc(tsc: string, args: string[], cwd: string): Promise<ProcessResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [tsc, ...args], {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", (cause) =>
      reject(new CheckFailure(`Could not run TypeScript (${tsc}).`, { cause })),
    );
    child.on("close", (code, signal) => {
      const output = Buffer.concat(chunks).toString("utf8");
      if (code === null) {
        reject(new CheckFailure(`TypeScript was terminated by ${signal}.`, { help: output }));
      } else {
        resolvePromise({ exitCode: code, output });
      }
    });
  });
}

export type TscCategory = "error" | "warning" | "message";

export interface TscDiagnostic {
  /** The path as printed (relative to the working directory, or absolute); absent for global diagnostics. */
  file?: string;
  /** 1-based. */
  line?: number;
  /** 1-based, in UTF-16 code units. */
  column?: number;
  category: TscCategory;
  /** `TS2322`. */
  code: string;
  /** The message; chained details follow on indented lines. */
  message: string;
}

const LOCATED = /^(.+?)\((\d+),(\d+)\): (error|warning|message) (TS\d+): (.*)$/;
const GLOBAL = /^(error|warning|message) (TS\d+): (.*)$/;

/**
 * Parses `tsc --pretty false` output: one `file(line,col): category TSxxxx: message` (or
 * `category TSxxxx: message`) line per diagnostic, with chained messages on indented lines.
 */
export function parseTscOutput(output: string): TscDiagnostic[] {
  const diagnostics: TscDiagnostic[] = [];
  let current: TscDiagnostic | undefined;
  for (const line of output.split(/\r?\n/)) {
    const located = LOCATED.exec(line);
    const global = located ? null : GLOBAL.exec(line);
    if (located) {
      current = {
        file: located[1]!,
        line: Number(located[2]),
        column: Number(located[3]),
        category: located[4] as TscCategory,
        code: located[5]!,
        message: located[6]!,
      };
      diagnostics.push(current);
    } else if (global) {
      current = { category: global[1] as TscCategory, code: global[2]!, message: global[3]! };
      diagnostics.push(current);
    } else if (current && /^\s+\S/.test(line)) {
      current.message += `\n${line.replace(/^ {2}/, "")}`;
    } else {
      current = undefined;
    }
  }
  return diagnostics;
}
