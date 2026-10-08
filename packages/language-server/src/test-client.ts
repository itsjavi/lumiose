// A JSON-RPC LSP client for protocol tests: copies a fixture workspace to a temp dir (with
// `node_modules/lumen` and `node_modules/typescript` linked), spawns `src/bin.ts --stdio` and
// drives it like an editor would.

import { spawn, type ChildProcess } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type ClientCapabilities,
  type InitializeResult,
  type MessageConnection,
  type Position,
} from "vscode-languageserver/node";

const here = dirname(fileURLToPath(import.meta.url));
const lumenPackage = join(here, "../../lumen");
const typescriptPackage = dirname(
  createRequire(import.meta.url).resolve("typescript/package.json"),
);

export const CLIENT_CAPABILITIES: ClientCapabilities = {
  general: { positionEncodings: ["utf-16"] },
  textDocument: {
    synchronization: { didSave: true },
    diagnostic: { dynamicRegistration: false },
    publishDiagnostics: { relatedInformation: true },
    hover: { contentFormat: ["markdown", "plaintext"] },
    completion: { completionItem: { snippetSupport: true, labelDetailsSupport: true } },
    definition: { linkSupport: false },
    rename: { prepareSupport: true },
    documentSymbol: { hierarchicalDocumentSymbolSupport: true },
    colorProvider: {},
    foldingRange: {},
  },
  workspace: { workspaceEdit: { documentChanges: false }, configuration: true },
};

export interface TestServer {
  root: string;
  connection: MessageConnection;
  initialize: InitializeResult;
  notifications: Array<{ method: string; params: unknown }>;
  stderr: () => string;
  uri(path: string): string;
  /** Opens a workspace file (or `text` instead of its content); returns its text. */
  open(path: string, text?: string): Promise<string>;
  change(path: string, text: string): void;
  request<R>(method: string, params: object): Promise<R>;
  close(): Promise<void>;
}

export async function startTestServer(
  fixture: string,
  capabilities: ClientCapabilities = CLIENT_CAPABILITIES,
): Promise<TestServer> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "lumen-ls-")));
  await cp(join(here, "__fixtures__", fixture), root, { recursive: true });
  await mkdir(join(root, "node_modules"));
  await symlink(lumenPackage, join(root, "node_modules/lumen"), "junction");
  await symlink(typescriptPackage, join(root, "node_modules/typescript"), "junction");

  const child: ChildProcess = spawn(process.execPath, [join(here, "bin.ts"), "--stdio"], {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr!.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk;
  });
  const connection = createMessageConnection(
    new StreamMessageReader(child.stdout!),
    new StreamMessageWriter(child.stdin!),
  );
  const notifications: TestServer["notifications"] = [];
  connection.onRequest((method, params) => {
    if (method === "workspace/configuration") {
      return (params as { items: unknown[] }).items.map(() => null);
    }
    return null;
  });
  connection.onNotification((method, params) => {
    notifications.push({ method, params });
  });
  connection.listen();

  const rootUri = pathToFileURL(root).href;
  const initialize = await connection.sendRequest<InitializeResult>("initialize", {
    processId: process.pid,
    rootUri,
    workspaceFolders: [{ uri: rootUri, name: "fixture" }],
    capabilities,
  });
  await connection.sendNotification("initialized", {});

  const versions = new Map<string, number>();
  const uri = (path: string) => pathToFileURL(join(root, path)).href;

  return {
    root,
    connection,
    initialize,
    notifications,
    stderr: () => stderr,
    uri,
    async open(path, text) {
      const content = text ?? (await readFile(join(root, path), "utf8"));
      versions.set(path, 1);
      await connection.sendNotification("textDocument/didOpen", {
        textDocument: { uri: uri(path), languageId: languageId(path), version: 1, text: content },
      });
      return content;
    },
    change(path, text) {
      const version = (versions.get(path) ?? 1) + 1;
      versions.set(path, version);
      void connection.sendNotification("textDocument/didChange", {
        textDocument: { uri: uri(path), version },
        contentChanges: [{ text }],
      });
    },
    request: (method, params) => connection.sendRequest(method, params),
    async close() {
      await connection.sendRequest("shutdown").catch(() => undefined);
      await connection.sendNotification("exit").catch(() => undefined);
      await new Promise<void>((resolve) => {
        if (child.exitCode !== null) resolve();
        else child.once("exit", () => resolve());
        setTimeout(() => {
          child.kill();
          resolve();
        }, 2000).unref();
      });
      connection.dispose();
      await rm(root, { recursive: true, force: true });
    },
  };
}

function languageId(path: string): string {
  return path.endsWith(".stsx") ? "stsx" : path.endsWith(".tsx") ? "typescriptreact" : "typescript";
}

/** The UTF-16 position of `needle`'s `nth` occurrence in `text`, plus `shift` code units. */
export function positionOf(text: string, needle: string, shift = 0, nth = 1): Position {
  let index = -1;
  for (let i = 0; i < nth; i++) {
    index = text.indexOf(needle, index + 1);
    if (index === -1) throw new Error(`${needle} (#${nth}) not found`);
  }
  const offset = index + shift;
  const before = text.slice(0, offset);
  const line = before.split("\n").length - 1;
  return { line, character: offset - (before.lastIndexOf("\n") + 1) };
}
