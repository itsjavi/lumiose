// The Lumen language server (spec §9.2, decisions 6 and 11).
//
// Takeover proxy: one TypeScript 7 native LSP (`tsc --lsp --stdio`) serves `.ts`, `.tsx` and
// `.stsx`. An `.stsx` document reaches TypeScript as its shadow (`.lumen/shadow/<path>.stsx.tsx`)
// holding the masked TSX, which is offset-identical to the source in UTF-16, so positions pass
// through unchanged and only URIs are rewritten (source → shadow on the way in, shadow → source
// in every response, server request, notification and workspace edit). Unopened `.stsx` files
// reach TypeScript through their on-disk shadows, kept in sync with `syncShadows`.
//
// On top, for `.stsx`: CSS features in style blocks (vscode-css-languageservice on per-block
// virtual CSS), class-name completion / definition / references / rename between JSX `class`
// attributes and selectors (plus `<style global>` classes of other files), `$ref` hovers with the
// folded value, CSS document symbols, and Lumen diagnostics (scanner and diagnostic providers,
// e.g. the compiler's, also for `.tsx`).
//
// A crashed TypeScript server is restarted with backoff, and the open documents are re-sent.

import type { Diagnostic as CompilerDiagnostic, ScanResult, StyleRef } from "@lumen/compiler";
import { scan } from "@lumen/compiler";
import { SUPERSEDED_BY_TYPESCRIPT } from "lumen/tooling";
import { existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  CompletionItemKind,
  DiagnosticSeverity,
  DidChangeWatchedFilesNotification,
  DocumentHighlightKind,
  FileChangeType,
  MarkupKind,
  ResponseError,
  ErrorCodes,
  TextDocumentSyncKind,
  type CancellationToken,
  type ClientCapabilities,
  type CodeAction,
  type Command,
  type CompletionItem,
  type CompletionList,
  type Connection,
  type Definition,
  type Diagnostic,
  type DocumentDiagnosticReport,
  type DocumentHighlight,
  type DocumentSymbol,
  type FoldingRange,
  type Hover,
  type InitializeParams,
  type InitializeResult,
  type Location,
  type LocationLink,
  type MarkedString,
  type MarkupContent,
  type Position,
  type Range,
  type ServerCapabilities,
  type SymbolInformation,
  type TextEdit,
  type WorkspaceEdit,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { isIdentifier, type ClassOccurrence } from "./classes.ts";
import {
  cssColorPresentations,
  cssColors,
  cssCompletion,
  cssDiagnostics,
  cssDocumentSymbols,
  cssFoldingRanges,
  cssHighlights,
  cssHover,
  cssSymbolInformation,
  mergeDocumentSymbols,
} from "./css.ts";
import {
  filterBlockDiagnostics,
  lumenQuickFixes,
  toLspDiagnostic,
  touchesBlock,
} from "./diagnostics.ts";
import { GlobalClassIndex, type GlobalClass } from "./globals.ts";
import { rewriteUris } from "./rewrite.ts";
import { syncShadows } from "./shadows.ts";
import {
  componentAt,
  StsxSnapshot,
  visibleBlocks,
  type CssBlock,
  type OffsetRange,
} from "./stsx.ts";
import {
  RESTART_DELAYS,
  RESTART_RESET_AFTER,
  resolveTypeScript,
  spawnTypeScript,
  type TypeScriptExecutable,
  type TypeScriptServer,
} from "./typescript.ts";
import {
  fileKey,
  isStsx,
  pathToUri,
  Projects,
  rewriteShadowText,
  shadowToSource,
  uriToPath,
} from "./workspace.ts";

export interface LumenFile {
  uri: string;
  path: string;
  /** The file's project root. */
  root: string;
  text: string;
  scan: ScanResult;
}

/**
 * Extra Lumen diagnostics (e.g. the compiler's) for an open `.stsx` or `.tsx` document, as UTF-16
 * spans. Called at most once per document version.
 */
export type LumenDiagnosticProvider = (
  file: LumenFile,
) => readonly CompilerDiagnostic[] | Promise<readonly CompilerDiagnostic[]>;

export interface ServerOptions {
  diagnosticProviders?: readonly LumenDiagnosticProvider[];
  /**
   * Path of the TypeScript 7 native binary. Default: `initializationOptions.lumen.typescript`, else
   * resolved from the project's `typescript` package, else from this package's.
   */
  typescript?: string;
}

interface OpenFile {
  uri: string;
  languageId: string;
  document: TextDocument;
  /** `.stsx` only: the URI TypeScript knows the file by. */
  shadowUri?: string;
  /** Whether TypeScript was told about the document. */
  typescript: boolean;
  snapshot?: StsxSnapshot;
  /** The diagnostic providers' results for one document version. */
  provided?: { version: number; diagnostics: Promise<CompilerDiagnostic[]> };
}

/** A TypeScript process under supervision. */
interface TypeScriptInstance extends TypeScriptServer {
  startedAt: number;
  /** Set once the process exited or failed. */
  ended: boolean;
}

interface StsxAt {
  file: OpenFile;
  snapshot: StsxSnapshot;
  offset: number;
  /** Set inside a block's CSS content. */
  css?: CssBlock;
  /** Set on a `$` reference. */
  ref?: StyleRef;
}

interface ClassTarget extends ClassOccurrence {
  /** Set when the target is a selector: its block index. */
  block?: number;
}

interface ClassOccurrenceRef extends ClassOccurrence {
  selector: boolean;
  key?: boolean;
}

const TS_LANGUAGES = new Set(["typescript", "typescriptreact", "javascript", "javascriptreact"]);
const TS_EXTENSION = /\.(?:[cm]?[jt]s|[jt]sx)$/i;
const CSS_TRIGGERS = [":", "-", "$"];
const DIAGNOSTICS_DELAY = 200;

/** Wires the Lumen language server onto `connection` and starts listening. */
export function startServer(connection: Connection, options: ServerOptions = {}): void {
  const files = new Map<string, OpenFile>();
  /** Shadow URI key → source URI of open `.stsx` documents (also covers non-file schemes). */
  const openShadows = new Map<string, string>();
  const syncedRoots = new Set<string>();
  const globals = new GlobalClassIndex();
  let projects = new Projects([]);
  /** The initialized TypeScript server; unset while (re)starting or after it ended. */
  let ts: TypeScriptInstance | undefined;
  let tsExecutable: TypeScriptExecutable | undefined;
  let tsRoot = process.cwd();
  let tsInitialize: InitializeParams | undefined;
  let tsCapabilities: ServerCapabilities = {};
  let tsFailure: string | undefined;
  let restartAttempts = 0;
  let restartTimer: NodeJS.Timeout | undefined;
  let client: ClientCapabilities = {};
  let pullDiagnostics = false;
  let shuttingDown = false;
  let pushTimer: NodeJS.Timeout | undefined;

  const log = (message: string) => connection.console.log(message);

  // --- URI mapping -------------------------------------------------------------------------

  function toSource(uri: string): string | undefined {
    const open = openShadows.get(fileKey(uri));
    if (open !== undefined) return open;
    const source = shadowToSource(uri);
    return source === undefined ? undefined : (files.get(fileKey(source))?.uri ?? source);
  }

  function toShadow(uri: string): string | undefined {
    if (!isStsx(uri)) return undefined;
    return files.get(fileKey(uri))?.shadowUri ?? projects.shadowUri(uri);
  }

  const toTs = <T>(value: T): T => rewriteUris(value, toShadow);
  const fromTs = <T>(value: T): T => rewriteUris(value, toSource, rewriteShadowText);

  /** Sends a request to TypeScript; the result's URIs are mapped back unless `raw`. */
  async function forward<R>(
    method: string,
    params: unknown,
    token?: CancellationToken,
    raw = false,
  ): Promise<R | null> {
    const server = ts;
    if (!server) return null;
    // vscode-jsonrpc sends every argument before a token as a parameter, so an `undefined` token
    // must not be passed (it would turn the params into a positional array).
    const args: unknown[] = params === undefined ? [] : [toTs(params)];
    if (token) args.push(token);
    let result: R;
    try {
      result = await server.connection.sendRequest<R>(method, ...args);
    } catch (error) {
      // A crash fails the requests in flight; the restarted server answers the next ones.
      if (server.ended || ts !== server) return null;
      throw error;
    }
    return raw ? result : fromTs(result);
  }

  function notifyTs(method: string, params: unknown): void {
    if (!ts) return;
    try {
      // A connection that just closed (a crash not yet seen as an exit) throws.
      ts.connection.sendNotification(method, params).catch(() => undefined);
    } catch {
      // The restart re-sends the open documents.
    }
  }

  // --- TypeScript process ------------------------------------------------------------------

  /** Spawns and initializes TypeScript; it becomes {@link ts} once initialized. */
  async function startTypeScript(executable: TypeScriptExecutable): Promise<InitializeResult> {
    const server: TypeScriptInstance = {
      ...spawnTypeScript(executable, tsRoot, log),
      startedAt: Date.now(),
      ended: false,
    };
    const failed = new Promise<never>((_, reject) => {
      server.process.once("error", reject);
      server.process.once("exit", (code, signal) =>
        reject(new Error(`The TypeScript language server exited (${signal ?? `code ${code}`}).`)),
      );
    });
    wireTypeScript(server);
    try {
      const result = await Promise.race([
        server.connection.sendRequest<InitializeResult>("initialize", tsInitialize),
        failed,
      ]);
      ts = server;
      return result;
    } catch (error) {
      server.process.kill();
      throw error;
    }
  }

  /** After an unexpected exit: restart with exponential backoff, giving up after a few tries. */
  function scheduleRestart(): void {
    const delay = RESTART_DELAYS[restartAttempts];
    if (delay === undefined || !tsExecutable) {
      const message = `TypeScript features are unavailable: the TypeScript language server failed ${restartAttempts + 1} times in a row.`;
      connection.console.error(`Lumen: ${message}`);
      void connection.window.showErrorMessage(
        `Lumen: ${message} Restart the Lumen language server to try again.`,
      );
      return;
    }
    restartAttempts++;
    log(
      `Lumen: restarting TypeScript in ${delay} ms (attempt ${restartAttempts} of ${RESTART_DELAYS.length}).`,
    );
    const executable = tsExecutable;
    restartTimer = setTimeout(() => void restartTypeScript(executable), delay);
  }

  async function restartTypeScript(executable: TypeScriptExecutable): Promise<void> {
    if (shuttingDown) return;
    try {
      tsCapabilities = (await startTypeScript(executable)).capabilities;
    } catch (error) {
      connection.console.error(`Lumen: TypeScript failed to restart: ${errorMessage(error)}`);
      if (!shuttingDown) scheduleRestart();
      return;
    }
    notifyTs("initialized", {});
    let reopened = 0;
    for (const file of files.values()) {
      if (!file.typescript) continue;
      notifyTs("textDocument/didOpen", { textDocument: typeScriptDocument(file) });
      reopened++;
    }
    log(
      `Lumen: TypeScript language server restarted (pid ${ts?.process.pid}); ${reopened} open document(s) re-sent.`,
    );
    refreshClient();
  }

  /** Asks the client to re-pull what TypeScript computes (after a restart). */
  function refreshClient(): void {
    const workspace = client.workspace;
    if (!pullDiagnostics) schedulePush();
    else if (workspace?.diagnostics?.refreshSupport) {
      void connection.languages.diagnostics.refresh().catch(() => undefined);
    }
    if (workspace?.semanticTokens?.refreshSupport) {
      void connection.languages.semanticTokens.refresh().catch(() => undefined);
    }
    if (workspace?.inlayHint?.refreshSupport) {
      void connection.languages.inlayHint.refresh().catch(() => undefined);
    }
  }

  function wireTypeScript(server: TypeScriptInstance): void {
    const tsc = server.connection;
    tsc.onRequest(async (method, params, token) => {
      if (method === "workspace/diagnostic/refresh") {
        if (!pullDiagnostics) schedulePush();
        else if (client.workspace?.diagnostics?.refreshSupport) {
          await connection.languages.diagnostics.refresh();
        }
        return null;
      }
      return toTs(await connection.sendRequest(method, fromTs(params), token));
    });
    tsc.onNotification((method, params) => {
      if (method === "textDocument/publishDiagnostics") {
        const { uri, diagnostics, version } = params as {
          uri: string;
          diagnostics: Diagnostic[];
          version?: number;
        };
        const file = files.get(fileKey(toSource(uri) ?? uri));
        const snapshot = file?.shadowUri !== undefined ? snapshotOf(file) : undefined;
        const kept = snapshot
          ? filterBlockDiagnostics(snapshot.document, snapshot.blocks, diagnostics)
          : diagnostics;
        void connection.sendDiagnostics(
          fromTs({ uri, diagnostics: kept, ...(version === undefined ? {} : { version }) }),
        );
        return;
      }
      void connection.sendNotification(method, fromTs(params));
    });
    const ended = (reason: string) => {
      if (server.ended) return;
      server.ended = true;
      tsc.dispose();
      // A server that never initialized is reported by `startTypeScript`'s caller.
      if (ts !== server) return;
      ts = undefined;
      if (shuttingDown) return;
      connection.console.error(`Lumen: ${reason}`);
      if (Date.now() - server.startedAt >= RESTART_RESET_AFTER) restartAttempts = 0;
      scheduleRestart();
    };
    server.process.once("exit", (code, signal) =>
      ended(`The TypeScript language server exited (${signal ?? `code ${code}`}).`),
    );
    server.process.once("error", (error) =>
      ended(`The TypeScript language server failed: ${error.message}`),
    );
    tsc.listen();
  }

  /** The `textDocument` of a `didOpen` to TypeScript: `.stsx` documents as their masked shadow. */
  function typeScriptDocument(file: OpenFile) {
    const { version } = file.document;
    if (file.shadowUri !== undefined) {
      const text = snapshotOf(file).scan.masked;
      return { uri: file.shadowUri, languageId: "typescriptreact", version, text };
    }
    return { uri: file.uri, languageId: file.languageId, version, text: file.document.getText() };
  }

  // --- Lifecycle ---------------------------------------------------------------------------

  connection.onInitialize(async (params): Promise<InitializeResult> => {
    client = params.capabilities;
    pullDiagnostics = client.textDocument?.diagnostic !== undefined;
    const folders = (params.workspaceFolders ?? [])
      .map((folder) => uriToPath(folder.uri))
      .filter((path) => path !== undefined);
    if (folders.length === 0 && params.rootUri) {
      const root = uriToPath(params.rootUri);
      if (root !== undefined) folders.push(root);
    }
    projects = new Projects(folders);
    const root = folders[0] ?? process.cwd();

    const { lumen, ...initializationOptions } = (params.initializationOptions ?? {}) as {
      lumen?: { typescript?: string };
    };
    tsRoot = root;
    tsInitialize = {
      ...params,
      processId: process.pid,
      capabilities: capabilitiesForTypeScript(params.capabilities),
      initializationOptions,
    };
    try {
      const custom = options.typescript ?? lumen?.typescript;
      const executable = custom
        ? { path: custom, version: "custom" }
        : await resolveTypeScript(root);
      tsCapabilities = (await startTypeScript(executable)).capabilities;
      tsExecutable = executable;
      log(
        `Lumen: TypeScript ${executable.version} language server (${executable.path}, pid ${ts?.process.pid}).`,
      );
    } catch (error) {
      tsFailure = errorMessage(error);
      connection.console.error(`Lumen: TypeScript features are unavailable: ${tsFailure}`);
    }

    await Promise.all(
      folders.filter((folder) => existsSync(join(folder, "src"))).map((folder) => syncRoot(folder)),
    );
    return {
      capabilities: serverCapabilities(tsCapabilities),
      serverInfo: { name: "lumen-language-server", version: "0.0.0" },
    };
  });

  connection.onInitialized(() => {
    notifyTs("initialized", {});
    if (client.workspace?.didChangeWatchedFiles?.dynamicRegistration) {
      void connection.client.register(DidChangeWatchedFilesNotification.type, {
        watchers: [{ globPattern: "**/*.stsx" }],
      });
    }
    if (tsFailure !== undefined) {
      void connection.window.showErrorMessage(`Lumen: ${tsFailure}`);
    }
  });

  connection.onShutdown(async () => {
    shuttingDown = true;
    clearTimeout(restartTimer);
    if (ts) await ts.connection.sendRequest("shutdown").catch(() => undefined);
  });

  connection.onExit(() => {
    shuttingDown = true;
    clearTimeout(restartTimer);
    if (!ts) return;
    void ts.connection.sendNotification("exit").catch(() => undefined);
    ts.process.kill();
  });

  // --- Shadows -----------------------------------------------------------------------------

  async function syncRoot(root: string): Promise<void> {
    syncedRoots.add(root);
    try {
      const { files: synced } = await syncShadows(root);
      for (const file of synced) indexGlobals(file.source, root, file.text, file.scan);
    } catch (error) {
      connection.console.error(`Lumen: shadow sync failed in ${root}: ${String(error)}`);
    }
  }

  /** Indexes a file's `<style global>` classes from disk, unless it is open (its buffer wins). */
  function indexGlobals(path: string, root: string, text: string, scanned: ScanResult): void {
    if (!files.has(fileKey(path))) globals.update(path, root, text, scanned);
  }

  /** Syncs the shadows of `.stsx` paths and tells TypeScript which shadows changed. */
  async function syncFiles(changes: ReadonlyArray<{ path: string; type: FileChangeType }>) {
    const byRoot = Map.groupBy(changes, (change) => projects.rootFor(change.path));
    for (const [root, rootChanges] of byRoot) {
      try {
        const { files: synced } = await syncShadows(root, {
          files: rootChanges.map((change) => change.path),
        });
        const found = new Set(synced.map((file) => fileKey(file.source)));
        for (const file of synced) indexGlobals(file.source, root, file.text, file.scan);
        for (const { path } of rootChanges) {
          if (!found.has(fileKey(path)) && !files.has(fileKey(path))) globals.delete(path);
        }
      } catch (error) {
        connection.console.error(`Lumen: shadow sync failed in ${root}: ${String(error)}`);
        continue;
      }
      notifyTs("workspace/didChangeWatchedFiles", {
        changes: rootChanges.map((change) => ({
          uri: projects.shadowUri(pathToUri(change.path)),
          type: change.type,
        })),
      });
    }
  }

  // --- Documents ---------------------------------------------------------------------------

  function snapshotOf(file: OpenFile): StsxSnapshot {
    const { document } = file;
    if (file.snapshot?.document.version !== document.version) {
      // `TextDocument.update` mutates in place, so a snapshot keeps its own immutable copy.
      const copy = TextDocument.create(
        file.uri,
        file.languageId,
        document.version,
        document.getText(),
      );
      const path = uriToPath(file.uri);
      file.snapshot = new StsxSnapshot(copy, path ?? file.uri);
      if (path !== undefined) {
        globals.update(path, projects.rootFor(path), copy.getText(), file.snapshot.scan, file.uri);
      }
    }
    return file.snapshot;
  }

  connection.onDidOpenTextDocument(({ textDocument: { uri, languageId, version, text } }) => {
    const file: OpenFile = {
      uri,
      languageId,
      document: TextDocument.create(uri, languageId, version, text),
      typescript: false,
    };
    files.set(fileKey(uri), file);
    if (isStsx(uri)) {
      file.shadowUri = projects.shadowUri(uri);
      openShadows.set(fileKey(file.shadowUri), uri);
      // First file of a project not synced at startup (e.g. a nested app in a monorepo).
      const path = uriToPath(uri);
      const root = path === undefined ? undefined : projects.rootFor(path);
      if (root !== undefined && !syncedRoots.has(root) && existsSync(join(root, "src"))) {
        void syncRoot(root);
      }
      file.typescript = true;
    } else if (isTypeScriptDocument(uri, languageId)) {
      file.typescript = true;
    }
    if (file.typescript)
      notifyTs("textDocument/didOpen", { textDocument: typeScriptDocument(file) });
    schedulePush();
  });

  connection.onDidChangeTextDocument(({ textDocument: { uri, version }, contentChanges }) => {
    const file = files.get(fileKey(uri));
    if (!file) return;
    file.document = TextDocument.update(file.document, contentChanges, version);
    if (file.shadowUri !== undefined) {
      // A change can re-mask text far from the edit (an opened `<style>`), so send the full text.
      notifyTs("textDocument/didChange", {
        textDocument: { uri: file.shadowUri, version },
        contentChanges: [{ text: snapshotOf(file).scan.masked }],
      });
    } else if (file.typescript) {
      notifyTs("textDocument/didChange", { textDocument: { uri, version }, contentChanges });
    }
    schedulePush();
  });

  connection.onDidCloseTextDocument(({ textDocument: { uri } }) => {
    const file = files.get(fileKey(uri));
    if (!file) return;
    files.delete(fileKey(uri));
    if (file.shadowUri !== undefined) openShadows.delete(fileKey(file.shadowUri));
    if (file.typescript) {
      notifyTs("textDocument/didClose", { textDocument: { uri: file.shadowUri ?? uri } });
    }
    const path = uriToPath(uri);
    // TypeScript falls back to the on-disk shadow, which must follow the saved source again.
    if (file.shadowUri !== undefined && path !== undefined) {
      void syncFiles([{ path, type: FileChangeType.Changed }]);
    }
    if (!pullDiagnostics) void connection.sendDiagnostics({ uri, diagnostics: [] });
  });

  connection.onDidSaveTextDocument(({ textDocument: { uri } }) => {
    const file = files.get(fileKey(uri));
    if (file?.typescript) {
      notifyTs("textDocument/didSave", { textDocument: { uri: file.shadowUri ?? uri } });
    }
    const path = uriToPath(uri);
    if (file?.shadowUri !== undefined && path !== undefined) {
      void syncShadows(projects.rootFor(path), { files: [path] }).catch((error: unknown) =>
        connection.console.error(`Lumen: shadow sync failed for ${path}: ${String(error)}`),
      );
    }
  });

  connection.onDidChangeWatchedFiles(({ changes }) => {
    const stsx = changes.flatMap((change) => {
      const path = isStsx(change.uri) ? uriToPath(change.uri) : undefined;
      return path === undefined ? [] : [{ path, type: change.type }];
    });
    if (stsx.length > 0) void syncFiles(stsx);
    const others = changes.filter((change) => !isStsx(change.uri));
    if (others.length > 0) notifyTs("workspace/didChangeWatchedFiles", { changes: others });
  });

  // --- Diagnostics -------------------------------------------------------------------------

  async function diagnosticsFor(file: OpenFile, token?: CancellationToken): Promise<Diagnostic[]> {
    const fromTypeScript = async (uri: string) => {
      const report = await forward<DocumentDiagnosticReport>(
        "textDocument/diagnostic",
        { textDocument: { uri } },
        token,
        true,
      );
      return report?.kind === "full" ? report.items : [];
    };
    if (file.shadowUri === undefined) {
      const typescript = file.typescript ? fromTs(await fromTypeScript(file.uri)) : [];
      if (!isTsx(file.uri)) return typescript;
      // Raw CSS in a `.tsx` file (LUM1006 "rename to .stsx"), then the providers'.
      const { document } = file;
      const scanned = scan(document.getText(), uriToPath(file.uri) ?? file.uri);
      const lumen = [...scanned.diagnostics, ...(await provided(file, scanned))];
      return [
        ...typescript,
        ...withoutSuperseded(document, lumen, typescript).map((d) => toLspDiagnostic(document, d)),
      ];
    }
    const snapshot = snapshotOf(file);
    const typescript = fromTs(
      filterBlockDiagnostics(
        snapshot.document,
        snapshot.blocks,
        await fromTypeScript(file.shadowUri),
      ),
    );
    const lumen = [...snapshot.scan.diagnostics, ...(await provided(file, snapshot.scan))];
    return [
      ...typescript,
      ...withoutSuperseded(snapshot.document, lumen, typescript).map((diagnostic) =>
        toLspDiagnostic(snapshot.document, diagnostic),
      ),
      ...cssDiagnostics(snapshot),
    ];
  }

  /**
   * The diagnostic providers' results for the document's current version. Each version is
   * computed once: pulls follow the client's own debounce, pushes the server's.
   */
  function provided(file: OpenFile, scanned: ScanResult): Promise<CompilerDiagnostic[]> {
    const { version } = file.document;
    if (file.provided?.version === version) return file.provided.diagnostics;
    const path = uriToPath(file.uri);
    const lumenFile: LumenFile = {
      uri: file.uri,
      path: path ?? file.uri,
      root: path === undefined ? tsRoot : projects.rootFor(path),
      text: file.document.getText(),
      scan: scanned,
    };
    const diagnostics = (async () => {
      const results = await Promise.all(
        (options.diagnosticProviders ?? []).map(async (provider) => {
          try {
            return await provider(lumenFile);
          } catch (error) {
            connection.console.error(`Lumen: a diagnostic provider failed: ${errorMessage(error)}`);
            return [];
          }
        }),
      );
      return results.flat();
    })();
    file.provided = { version, diagnostics };
    return diagnostics;
  }

  connection.languages.diagnostics.on(async (params, token) => {
    const file = files.get(fileKey(params.textDocument.uri));
    if (file && (file.shadowUri !== undefined || isTsx(file.uri))) {
      return { kind: "full", items: await diagnosticsFor(file, token) };
    }
    return (
      (await forward<DocumentDiagnosticReport>("textDocument/diagnostic", params, token)) ?? {
        kind: "full",
        items: [],
      }
    );
  });

  /** Push mode for clients without pull diagnostics: republish every open document. */
  function schedulePush(): void {
    if (pullDiagnostics) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      for (const file of files.values()) {
        const { version } = file.document;
        void diagnosticsFor(file).then(
          (diagnostics) => connection.sendDiagnostics({ uri: file.uri, version, diagnostics }),
          (error: unknown) =>
            connection.console.error(`Lumen: diagnostics failed for ${file.uri}: ${String(error)}`),
        );
      }
    }, DIAGNOSTICS_DELAY);
  }

  // --- Locating positions in `.stsx` --------------------------------------------------------

  function stsxAt(uri: string, position: Position): StsxAt | undefined {
    const file = files.get(fileKey(uri));
    if (file?.shadowUri === undefined) return undefined;
    const snapshot = snapshotOf(file);
    const offset = snapshot.document.offsetAt(position);
    const at = snapshot.blockAt(offset);
    if (!at) return { file, snapshot, offset };
    return {
      file,
      snapshot,
      offset,
      css: snapshot.cssBlocks[at.index],
      ref: snapshot.refAt(at.block, offset),
    };
  }

  /** Top-level declaration ranges (components) from TypeScript's document symbols, cached. */
  function componentsOf(at: StsxAt): Promise<OffsetRange[] | undefined> {
    const { snapshot, file } = at;
    snapshot.components ??= (async () => {
      const symbols = await forward<Array<DocumentSymbol | SymbolInformation>>(
        "textDocument/documentSymbol",
        { textDocument: { uri: file.uri } },
        undefined,
        true,
      );
      if (!symbols) return undefined;
      return symbols.flatMap((symbol) => {
        const range =
          "location" in symbol
            ? symbol.containerName
              ? undefined
              : symbol.location.range
            : symbol.range;
        return range
          ? [
              {
                start: snapshot.document.offsetAt(range.start),
                end: snapshot.document.offsetAt(range.end),
              },
            ]
          : [];
      });
    })().catch(() => undefined);
    return snapshot.components;
  }

  /**
   * The occurrences that rename together with `target`: when only component blocks of the
   * target's component define the class, that component's selectors and usages; otherwise
   * (file-level or global definitions, or no definition) every occurrence in the file.
   */
  async function classGroup(at: StsxAt, target: ClassTarget): Promise<ClassOccurrenceRef[]> {
    const { snapshot } = at;
    const components = await componentsOf(at);
    const scopeOf = (offset: number) => components && componentAt(components, offset);
    const blockScope = (index: number) => {
      const block = snapshot.blocks[index]!;
      return block.placement === "jsx" ? scopeOf(block.span.start) : undefined;
    };
    const selectors = snapshot.selectors.filter((selector) => selector.name === target.name);
    const usages = snapshot.classAttributes.usages.filter((usage) => usage.name === target.name);
    const origin = target.block !== undefined ? blockScope(target.block) : scopeOf(target.start);
    const visible = selectors.filter((selector) => {
      const scope = blockScope(selector.block);
      return scope === undefined || scope === origin;
    });
    const fileWide =
      origin === undefined ||
      visible.length === 0 ||
      visible.some((selector) => blockScope(selector.block) === undefined);
    return [
      ...selectors
        .filter((selector) => fileWide || blockScope(selector.block) === origin)
        .map((selector) => ({ ...selector, selector: true })),
      ...usages
        .filter((usage) => fileWide || scopeOf(usage.start) === origin)
        .map((usage) => ({ ...usage, selector: false })),
    ];
  }

  // --- Completion --------------------------------------------------------------------------

  type Tag = "ts" | "css" | "class";

  function tagged(result: CompletionList | CompletionItem[] | null, tag: Tag) {
    if (!result) return result;
    const list = Array.isArray(result) ? { isIncomplete: false, items: result } : result;
    // Default data is folded into the items: a wrapped item no longer inherits it.
    const defaults: unknown = list.itemDefaults?.data;
    for (const item of list.items) item.data = { lumen: tag, data: item.data ?? defaults };
    if (list.itemDefaults) delete list.itemDefaults.data;
    return list;
  }

  async function classCompletion(at: StsxAt): Promise<CompletionList | undefined> {
    const { snapshot, offset } = at;
    const slot = snapshot.classAttributes.slots.find(
      (candidate) => candidate.start <= offset && offset <= candidate.end,
    );
    if (!slot) return undefined;
    const text = snapshot.document.getText();
    let start = slot.start;
    let end = slot.end;
    if (slot.kind === "string") {
      start = offset;
      end = offset;
      while (start > slot.start && !/\s/.test(text[start - 1]!)) start--;
      while (end < slot.end && !/\s/.test(text[end]!)) end++;
    }
    const present = new Set(
      slot.kind === "string"
        ? (text.slice(slot.start, start) + " " + text.slice(end, slot.end)).split(/\s+/)
        : [],
    );
    const visible = visibleBlocks(snapshot, await componentsOf(at), offset);
    const range = rangeOf(snapshot, start, end);
    const items = new Map<string, CompletionItem>();
    for (const selector of snapshot.selectors) {
      if (!visible.has(selector.block) || present.has(selector.name)) continue;
      if (items.has(selector.name)) continue;
      const block = snapshot.blocks[selector.block]!;
      const line = snapshot.document.positionAt(selector.start).line + 1;
      const newText =
        slot.kind === "key" && !isIdentifier(selector.name)
          ? JSON.stringify(selector.name)
          : selector.name;
      items.set(selector.name, {
        label: selector.name,
        kind: CompletionItemKind.Class,
        detail: `${block.global ? "global" : block.placement === "jsx" ? "component" : "file"} style, line ${line}`,
        filterText: selector.name,
        textEdit: { range, newText },
        data: { lumen: "class" satisfies Tag },
      });
    }
    const path = uriToPath(at.file.uri);
    const root = path === undefined ? undefined : projects.rootFor(path);
    for (const global of root === undefined ? [] : globals.classes(root, path!)) {
      if (present.has(global.name) || items.has(global.name)) continue;
      const file = relative(root!, global.path).split(sep).join("/");
      items.set(global.name, {
        label: global.name,
        kind: CompletionItemKind.Class,
        detail: `global style, ${file}:${global.range.start.line + 1}`,
        filterText: global.name,
        textEdit: {
          range,
          newText:
            slot.kind === "key" && !isIdentifier(global.name)
              ? JSON.stringify(global.name)
              : global.name,
        },
        data: { lumen: "class" satisfies Tag },
      });
    }
    return { isIncomplete: false, items: [...items.values()] };
  }

  /** `<style global>` definitions of `name` in the other files of `uri`'s project. */
  function globalDefinitions(uri: string, name: string): GlobalClass[] {
    const path = uriToPath(uri);
    if (path === undefined) return [];
    return globals.classes(projects.rootFor(path), path).filter((global) => global.name === name);
  }

  connection.onCompletion(async (params, token) => {
    const at = stsxAt(params.textDocument.uri, params.position);
    if (at?.css) {
      if (at.ref && at.offset > at.ref.span.start) {
        return tagged(await forward("textDocument/completion", params, token, true), "ts");
      }
      return tagged(cssCompletion(at.css, params.position), "css");
    }
    if (at?.snapshot.inBlock(at.offset)) return null;
    if (at) {
      const classes = await classCompletion(at);
      if (classes) return classes;
    }
    const trigger = params.context?.triggerCharacter;
    if (
      trigger !== undefined &&
      !tsCapabilities.completionProvider?.triggerCharacters?.includes(trigger)
    ) {
      return null;
    }
    // Completion lists carry no URIs (TypeScript keeps them in `data`), so they pass unmapped.
    return tagged(await forward("textDocument/completion", params, token, true), "ts");
  });

  connection.onCompletionResolve(async (item, token) => {
    const data = item.data as { lumen?: Tag; data?: unknown } | undefined;
    if (data?.lumen !== "ts") return item;
    const resolved = await forward<CompletionItem>(
      "completionItem/resolve",
      { ...item, data: data.data },
      token,
    );
    return resolved ? { ...resolved, data } : item;
  });

  // --- Hover -------------------------------------------------------------------------------

  async function refHover(at: StsxAt, ref: StyleRef, token: CancellationToken): Promise<Hover> {
    const { snapshot } = at;
    const last = ref.span.end - (ref.path.at(-1)?.length ?? 0);
    const hover = await forward<Hover>(
      "textDocument/hover",
      { textDocument: { uri: at.file.uri }, position: snapshot.document.positionAt(last) },
      token,
    );
    const name = snapshot.document.getText().slice(ref.span.start, ref.span.end);
    const markdown = hover ? hoverMarkdown(hover.contents) : "";
    const value = foldedValue(markdown);
    const header =
      value === undefined
        ? `\`${name}\`: Lumen constant reference (not statically resolved)`
        : `\`${name}\` → \`${value}\``;
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: markdown ? `${header}\n\n---\n\n${markdown}` : header,
      },
      range: rangeOf(snapshot, ref.span.start, ref.span.end),
    };
  }

  connection.onHover(async (params, token) => {
    const at = stsxAt(params.textDocument.uri, params.position);
    if (at?.ref) return refHover(at, at.ref, token);
    if (at?.css) return cssHover(at.css, params.position);
    if (at?.snapshot.inBlock(at.offset)) return null;
    return forward<Hover>("textDocument/hover", params, token);
  });

  // --- Definition, references, highlights, rename ------------------------------------------

  connection.onDefinition(async (params, token) => {
    const at = stsxAt(params.textDocument.uri, params.position);
    if (at && !at.ref) {
      const target = classTarget(at);
      if (at.css || target) {
        if (!target) return null;
        const { snapshot } = at;
        const origin = rangeOf(snapshot, target.start, target.end);
        let local: ClassOccurrence[] = [target]; // a selector is its own definition
        let external: GlobalClass[] = [];
        if (target.block === undefined) {
          const blocks = visibleBlocks(snapshot, await componentsOf(at), target.start);
          local = snapshot.selectors.filter(
            (selector) => selector.name === target.name && blocks.has(selector.block),
          );
          external = globalDefinitions(at.file.uri, target.name);
        }
        const definitions = [
          ...local.map((selector) => ({
            uri: at.file.uri,
            range: rangeOf(snapshot, selector.start, selector.end),
          })),
          ...external.map(({ uri, range }) => ({ uri, range })),
        ];
        if (client.textDocument?.definition?.linkSupport) {
          return definitions.map(({ uri, range }): LocationLink => ({
            originSelectionRange: origin,
            targetUri: uri,
            // The selector with its dot.
            targetRange: {
              start: { line: range.start.line, character: range.start.character - 1 },
              end: range.end,
            },
            targetSelectionRange: range,
          }));
        }
        return definitions satisfies Location[];
      }
      if (at.snapshot.inBlock(at.offset)) return null;
    }
    return forward<Definition | LocationLink[]>("textDocument/definition", params, token);
  });

  connection.onReferences(async (params, token) => {
    const at = stsxAt(params.textDocument.uri, params.position);
    if (at && !at.ref) {
      const target = classTarget(at);
      if (target) {
        return (await classGroup(at, target))
          .filter((occurrence) => params.context.includeDeclaration || !occurrence.selector)
          .map((occurrence): Location => ({
            uri: at.file.uri,
            range: rangeOf(at.snapshot, occurrence.start, occurrence.end),
          }));
      }
      if (at.css || at.snapshot.inBlock(at.offset)) return null;
    }
    return forward<Location[]>("textDocument/references", params, token);
  });

  connection.onDocumentHighlight(async (params, token) => {
    const at = stsxAt(params.textDocument.uri, params.position);
    if (at && !at.ref) {
      const target = classTarget(at);
      if (target) {
        return (await classGroup(at, target)).map((occurrence): DocumentHighlight => ({
          range: rangeOf(at.snapshot, occurrence.start, occurrence.end),
          kind: occurrence.selector ? DocumentHighlightKind.Write : DocumentHighlightKind.Read,
        }));
      }
      if (at.css) return cssHighlights(at.css, params.position);
      if (at.snapshot.inBlock(at.offset)) return null;
    }
    return forward<DocumentHighlight[]>("textDocument/documentHighlight", params, token, true);
  });

  connection.onPrepareRename(async (params, token) => {
    const at = stsxAt(params.textDocument.uri, params.position);
    if (at && !at.ref) {
      const target = classTarget(at);
      if (target) {
        return { range: rangeOf(at.snapshot, target.start, target.end), placeholder: target.name };
      }
      if (at.css || at.snapshot.inBlock(at.offset)) return null;
    }
    return forward<Range | { range: Range; placeholder: string }>(
      "textDocument/prepareRename",
      params,
      token,
    );
  });

  connection.onRenameRequest(async (params, token) => {
    const at = stsxAt(params.textDocument.uri, params.position);
    const target = at && !at.ref ? classTarget(at) : undefined;
    if (at && target) {
      const name = params.newName.trim();
      if (!/^-?[_a-zA-Z\u0080-￿][\w\-\u0080-￿]*$/.test(name)) {
        throw new ResponseError(ErrorCodes.InvalidParams, `\`${name}\` is not a valid class name.`);
      }
      const edits = (await classGroup(at, target)).map((occurrence): TextEdit => ({
        range: rangeOf(at.snapshot, occurrence.start, occurrence.end),
        newText: occurrence.key && !isIdentifier(name) ? JSON.stringify(name) : name,
      }));
      return { changes: { [at.file.uri]: edits } } satisfies WorkspaceEdit;
    }
    return forward<WorkspaceEdit>("textDocument/rename", params, token);
  });

  // --- CSS-only features -------------------------------------------------------------------

  function openStsx(uri: string): StsxSnapshot | undefined {
    const file = files.get(fileKey(uri));
    return file?.shadowUri === undefined ? undefined : snapshotOf(file);
  }

  connection.onDocumentColor((params) => {
    const snapshot = openStsx(params.textDocument.uri);
    return snapshot ? cssColors(snapshot) : [];
  });

  connection.onColorPresentation((params) => {
    const snapshot = openStsx(params.textDocument.uri);
    return snapshot ? cssColorPresentations(snapshot, params.color, params.range) : [];
  });

  connection.onFoldingRanges(async (params, token) => {
    const ranges =
      (await forward<FoldingRange[]>("textDocument/foldingRange", params, token, true)) ?? [];
    const snapshot = openStsx(params.textDocument.uri);
    return snapshot ? [...ranges, ...cssFoldingRanges(snapshot)] : ranges;
  });

  /** TypeScript's symbols plus one symbol per style block holding its rules. */
  connection.onDocumentSymbol(async (params, token) => {
    const symbols = await forward<DocumentSymbol[] | SymbolInformation[]>(
      "textDocument/documentSymbol",
      params,
      token,
    );
    const snapshot = openStsx(params.textDocument.uri);
    if (!snapshot || snapshot.blocks.length === 0) return symbols;
    const first = symbols?.[0];
    const hierarchical = first
      ? "selectionRange" in first
      : client.textDocument?.documentSymbol?.hierarchicalDocumentSymbolSupport === true;
    if (hierarchical) {
      return mergeDocumentSymbols(
        (symbols ?? []) as DocumentSymbol[],
        cssDocumentSymbols(snapshot),
      );
    }
    return [...((symbols ?? []) as SymbolInformation[]), ...cssSymbolInformation(snapshot)];
  });

  // --- Forwarded with `.stsx` adjustments --------------------------------------------------

  /** Formatting the masked TSX must not touch style blocks (blank there; `lumen fmt` formats CSS). */
  function formatting(method: string) {
    return async (params: { textDocument: { uri: string } }, token: CancellationToken) => {
      const edits = await forward<TextEdit[]>(method, params, token, true);
      const snapshot = openStsx(params.textDocument.uri);
      if (!edits || !snapshot) return edits;
      return edits.filter((edit) => !touchesBlock(snapshot.document, snapshot.blocks, edit.range));
    };
  }
  connection.onDocumentFormatting(formatting("textDocument/formatting"));
  connection.onDocumentRangeFormatting(formatting("textDocument/rangeFormatting"));
  connection.onDocumentOnTypeFormatting(formatting("textDocument/onTypeFormatting"));

  connection.onSignatureHelp(async (params, token) => {
    const at = stsxAt(params.textDocument.uri, params.position);
    if (at?.snapshot.inBlock(at.offset)) return null;
    return forward("textDocument/signatureHelp", params, token, true);
  });

  connection.onCodeAction(async (params, token) => {
    const snapshot = openStsx(params.textDocument.uri);
    // TypeScript computes fixes from its own diagnostics only.
    const tsParams = snapshot
      ? {
          ...params,
          context: {
            ...params.context,
            diagnostics: params.context.diagnostics.filter((d) => d.source === "ts"),
          },
        }
      : params;
    const actions =
      (await forward<Array<CodeAction | Command>>("textDocument/codeAction", tsParams, token)) ??
      [];
    if (!snapshot) return actions;
    const file = files.get(fileKey(params.textDocument.uri))!;
    const lumen = [...snapshot.scan.diagnostics, ...(await provided(file, snapshot.scan))];
    return [...lumenQuickFixes(snapshot.document, lumen, params.range), ...actions];
  });

  // --- Everything else goes to TypeScript --------------------------------------------------

  connection.onRequest((method, params, token) => forward(method, params, token));
  connection.onNotification((method, params) => notifyTs(method, toTs(params)));

  connection.listen();
}

function isTypeScriptDocument(uri: string, languageId: string): boolean {
  return TS_LANGUAGES.has(languageId) || TS_EXTENSION.test(uri);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isTsx(uri: string): boolean {
  return /\.tsx$/i.test(uri);
}

/**
 * Drops Lumen diagnostics that a TypeScript error inside their span supersedes (an unknown `$`
 * reference: TypeScript's "Cannot find name" is the actionable one), as `lumen check` does.
 */
function withoutSuperseded(
  document: TextDocument,
  lumen: readonly CompilerDiagnostic[],
  typescript: readonly Diagnostic[],
): CompilerDiagnostic[] {
  const errors = typescript
    .filter((d) => d.severity === DiagnosticSeverity.Error)
    .map((d) => document.offsetAt(d.range.start));
  return lumen.filter(
    (d) =>
      !SUPERSEDED_BY_TYPESCRIPT.has(d.code) ||
      !errors.some((offset) => d.span.start <= offset && offset < d.span.end),
  );
}

function classTarget(at: StsxAt): ClassTarget | undefined {
  const { snapshot, offset } = at;
  if (at.css) {
    return snapshot.selectors.find(
      (selector) => selector.start <= offset && offset <= selector.end,
    );
  }
  return snapshot.classAttributes.usages.find(
    (usage) => usage.start <= offset && offset <= usage.end,
  );
}

function rangeOf(snapshot: StsxSnapshot, start: number, end: number): Range {
  return { start: snapshot.document.positionAt(start), end: snapshot.document.positionAt(end) };
}

/** Client capabilities as TypeScript sees them: static registrations, pull diagnostics. */
function capabilitiesForTypeScript(capabilities: ClientCapabilities): ClientCapabilities {
  const result = structuredClone(capabilities);
  const textDocument = (result.textDocument ??= {});
  // Dynamic registrations would use TypeScript's document selectors, which exclude `.stsx`.
  for (const feature of Object.values(textDocument)) {
    if (feature !== null && typeof feature === "object" && "dynamicRegistration" in feature) {
      feature.dynamicRegistration = false;
    }
  }
  textDocument.diagnostic = { ...textDocument.diagnostic, dynamicRegistration: false };
  result.workspace = {
    ...result.workspace,
    // TypeScript watches files itself (it sees the shadows the proxy writes).
    didChangeWatchedFiles: { dynamicRegistration: false },
    diagnostics: { refreshSupport: true },
  };
  result.general = { ...result.general, positionEncodings: ["utf-16"] };
  return result;
}

function serverCapabilities(ts: ServerCapabilities): ServerCapabilities {
  const completion = ts.completionProvider;
  const codeActions = typeof ts.codeActionProvider === "object" ? ts.codeActionProvider : {};
  const willRename = ts.workspace?.fileOperations?.willRename;
  return {
    ...ts,
    positionEncoding: "utf-16",
    textDocumentSync: {
      openClose: true,
      change: TextDocumentSyncKind.Incremental,
      save: { includeText: false },
    },
    completionProvider: {
      ...completion,
      resolveProvider: true,
      triggerCharacters: [...new Set([...(completion?.triggerCharacters ?? []), ...CSS_TRIGGERS])],
    },
    hoverProvider: true,
    definitionProvider: true,
    referencesProvider: true,
    documentHighlightProvider: true,
    renameProvider: { prepareProvider: true },
    colorProvider: true,
    foldingRangeProvider: true,
    documentSymbolProvider: ts.documentSymbolProvider ?? true,
    codeActionProvider: {
      ...codeActions,
      codeActionKinds: [...new Set([...(codeActions.codeActionKinds ?? []), "quickfix"])],
    },
    diagnosticProvider: {
      identifier: "lumen",
      interFileDependencies: true,
      workspaceDiagnostics: false,
    },
    workspace: {
      ...ts.workspace,
      ...(willRename
        ? {
            fileOperations: {
              ...ts.workspace?.fileOperations,
              willRename: {
                filters: [
                  ...willRename.filters,
                  { scheme: "file", pattern: { glob: "**/*.stsx" } },
                ],
              },
            },
          }
        : {}),
    },
  };
}

function hoverMarkdown(contents: MarkupContent | MarkedString | MarkedString[]): string {
  const parts = Array.isArray(contents) ? contents : [contents];
  return parts
    .map((part) =>
      typeof part === "string"
        ? part
        : "kind" in part
          ? part.value
          : `\`\`\`${part.language}\n${part.value}\n\`\`\``,
    )
    .join("\n\n");
}

/**
 * The folded value of a `$` reference from TypeScript's hover of its last segment, when its type
 * is a string or number literal (`const gap: 8`, `(property) lg: "12px"`).
 */
export function foldedValue(markdown: string): string | undefined {
  const code = /```\w*\n([\s\S]*?)```/.exec(markdown)?.[1] ?? markdown;
  const first = code.split("\n")[0]!.trim();
  const literal = /:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)$/i.exec(
    first,
  )?.[1];
  if (literal === undefined) return undefined;
  if (literal.startsWith('"')) return JSON.parse(literal) as string;
  if (literal.startsWith("'")) return literal.slice(1, -1);
  return literal;
}
