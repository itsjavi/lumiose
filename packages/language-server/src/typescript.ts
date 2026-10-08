// Locating and launching the TypeScript 7 native language server (spec §9.2 takeover mode).
// The `typescript@7` package ships a native `tsc` binary (resolved by its `lib/getExePath.js`, the
// same function the TS 7 VS Code extension mirrors); `tsc --lsp --stdio` runs its LSP over stdio.

import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from "vscode-languageserver/node";

export interface TypeScriptExecutable {
  /** The native binary. */
  path: string;
  version: string;
}

export interface TypeScriptServer {
  connection: MessageConnection;
  process: ChildProcess;
  executable: TypeScriptExecutable;
}

/** Resolves TypeScript ≥ 7 from the project, falling back to the copy this package depends on. */
export async function resolveTypeScript(root: string): Promise<TypeScriptExecutable> {
  const rejected: string[] = [];
  for (const base of [join(root, "package.json"), import.meta.url]) {
    let manifestPath: string;
    try {
      manifestPath = createRequire(base).resolve("typescript/package.json");
    } catch {
      continue;
    }
    const { version } = JSON.parse(readFileSync(manifestPath, "utf8")) as { version: string };
    if (Number.parseInt(version, 10) < 7) {
      rejected.push(`${version} at ${dirname(manifestPath)}`);
      continue;
    }
    const { default: getExePath } = (await import(
      pathToFileURL(join(dirname(manifestPath), "lib/getExePath.js")).href
    )) as { default: () => string };
    return { path: getExePath(), version };
  }
  throw new Error(
    `TypeScript 7 was not found${rejected.length ? ` (found ${rejected.join(", ")})` : ""}. ` +
      "Install it in the project: `pnpm add -D typescript@^7`.",
  );
}

/** Spawns `tsc --lsp --stdio` in `root` and connects to it. The connection is not yet listening. */
export function spawnTypeScript(
  executable: TypeScriptExecutable,
  root: string,
  log: (message: string) => void,
): TypeScriptServer {
  const child = spawn(executable.path, ["--lsp", "--stdio"], {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    for (const line of chunk.split(/\r?\n/)) if (line.trim()) log(`[tsc] ${line}`);
  });
  const connection = createMessageConnection(
    new StreamMessageReader(child.stdout),
    new StreamMessageWriter(child.stdin),
  );
  return { connection, process: child, executable };
}
