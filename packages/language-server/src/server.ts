// The Lumiose language server (spec §9.2, decisions 6 and 11).
//
// Takeover proxy: one TypeScript 7 native LSP (`tsc --lsp --stdio`) serves `.ts`, `.tsx` and
// `.stsx`. An `.stsx` document reaches TypeScript as its shadow (`.lumiose/shadow/<path>.stsx.tsx`)
// holding the masked TSX, which is offset-identical to the source in UTF-16, so positions pass
// through unchanged and only URIs are rewritten (source → shadow on the way in, shadow → source
// in every response, server request, notification and workspace edit). Unopened `.stsx` files
// reach TypeScript through their on-disk shadows, kept in sync with `syncShadows`.
//
// On top, for `.stsx`: CSS features in style blocks (vscode-css-languageservice on per-block
// virtual CSS), class-name completion / definition / references / rename between JSX `class`
// attributes and selectors, scoped by placement (decision-23: a nested block covers its enclosing
// element's subtree), plus the project's global classes (`<style global>` blocks and imported
// `.css` files) and custom properties, `$ref` hovers with the folded value, `<style>` tag
// completion and hovers, snippets, CSS document symbols, and Lumiose diagnostics (scanner and
// diagnostic providers, e.g. the compiler's, also for `.tsx`). Diagnostic providers get a per-project `ModuleHost` that
// reads open documents before the disk, so the compiler sees constants imported by `$` references
// as edited; a change to such a module (in an editor or on disk) re-runs its dependents' providers.
//
// A crashed TypeScript server is restarted with backoff, and the open documents are re-sent.

import type {
  Diagnostic as CompilerDiagnostic,
  ScanResult,
  StyleBlock,
  StyleRef,
  ContractEntry,
} from "@lumiose/compiler";
import { scan } from "@lumiose/compiler";
import { ModuleHost, SUPERSEDED_BY_TYPESCRIPT, type ModuleChange } from "lumiose/tooling";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import {
  CompletionItemKind,
  DiagnosticSeverity,
  DidChangeWatchedFilesNotification,
  DocumentHighlightKind,
  FileChangeType,
  InsertTextFormat,
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
  islandPropDiagnostics,
  lumioseQuickFixes,
  toLspDiagnostic,
  touchesBlock,
} from "./diagnostics.ts";
import { contractAt, contractEntries, contractMarkdown } from "./contract.ts";
import { attributeDoc, GLOBAL_DOC, STYLE_DOC } from "./descriptions.ts";
import {
  isProjectModule,
  projectModules,
  ProjectStyles,
  type CustomProperty,
  type GlobalClass,
} from "./project-styles.ts";
import { propertyContext, propertyDeclarations } from "./properties.ts";
import { rewriteUris } from "./rewrite.ts";
import { syncShadows } from "./shadows.ts";
import { snippetCompletions } from "./snippets.ts";
import { StsxSnapshot, type CssBlock } from "./stsx.ts";
import {
  RESTART_DELAYS,
  RESTART_RESET_AFTER,
  resolveTypeScript,
  spawnTypeScript,
  type TypeScriptExecutable,
  type TypeScriptServer,
} from "./typescript.ts";
import { fileKey, isStsx, pathToUri, Projects, uriToPath } from "./workspace.ts";

export interface LumioseFile {
  uri: string;
  path: string;
  /** The file's project root. */
  root: string;
  text: string;
  scan: ScanResult;
  /**
   * Answers the compiler's module requests for imported `$` constants (open documents win over
   * the disk); unset for documents that are not files.
   */
  modules?: ModuleHost;
}

/**
 * Extra Lumiose diagnostics (e.g. the compiler's) for an open `.stsx` or `.tsx` document, as UTF-16
 * spans. Called at most once per document version.
 */
export type LumioseDiagnosticProvider = (
  file: LumioseFile,
) => readonly CompilerDiagnostic[] | Promise<readonly CompilerDiagnostic[]>;

/**
 * Project-wide Lumiose diagnostics (LUM4003, LUM3012; TASK-137): for a project root and its module
 * host (open documents win over the disk), a function that checks the whole project, by absolute
 * file. Called again after files change; it should only redo the work for what changed.
 */
export type ProjectDiagnosticsFactory = (
  root: string,
  modules: ModuleHost,
) => () => Promise<ReadonlyMap<string, readonly CompilerDiagnostic[]>>;

export interface ServerOptions {
  diagnosticProviders?: readonly LumioseDiagnosticProvider[];
  projectDiagnostics?: ProjectDiagnosticsFactory;
  /**
   * Path of the TypeScript 7 native binary. Default: `initializationOptions.lumiose.typescript`, else
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
  /** The execution contract of one document version, for hovers. */
  contract?: { version: number; entries: readonly ContractEntry[] };
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

/** Wires the Lumiose language server onto `connection` and starts listening. */
export function startServer(connection: Connection, options: ServerOptions = {}): void {
  const files = new Map<string, OpenFile>();
  /** Shadow URI key → source URI of open `.stsx` documents (also covers non-file schemes). */
  const openShadows = new Map<string, string>();
  const syncedRoots = new Set<string>();
  const styles = new ProjectStyles((specifier, importer) =>
    moduleHostFor(projects.rootFor(importer)).resolve(specifier, importer),
  );
  /** Module hosts of the diagnostic providers, by project root. */
  const moduleHosts = new Map<string, ModuleHost>();
  /** Per project root: its project-wide check and the last run, by change generation. */
  const projectChecks = new Map<
    string,
    {
      run: () => Promise<ReadonlyMap<string, readonly CompilerDiagnostic[]>>;
      generation: number;
      result?: Promise<ReadonlyMap<string, readonly CompilerDiagnostic[]>>;
      /** The diagnostics last reported per file, to tell whether other documents need a refresh. */
      reported: Map<string, string>;
    }
  >();
  /** Bumped by every change to a document or a file, so project checks run again. */
  let changeGeneration = 0;
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
    const source = projects.shadowToSource(uri);
    return source === undefined ? undefined : (files.get(fileKey(source))?.uri ?? source);
  }

  function toShadow(uri: string): string | undefined {
    if (!isStsx(uri)) return undefined;
    return files.get(fileKey(uri))?.shadowUri ?? projects.shadowUri(uri);
  }

  const toTs = <T>(value: T): T => rewriteUris(value, toShadow);
  const fromTs = <T>(value: T): T =>
    rewriteUris(value, toSource, (text) => projects.rewriteShadowText(text));

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
      connection.console.error(`Lumiose: ${message}`);
      void connection.window.showErrorMessage(
        `Lumiose: ${message} Restart the Lumiose language server to try again.`,
      );
      return;
    }
    restartAttempts++;
    log(
      `Lumiose: restarting TypeScript in ${delay} ms (attempt ${restartAttempts} of ${RESTART_DELAYS.length}).`,
    );
    const executable = tsExecutable;
    restartTimer = setTimeout(() => void restartTypeScript(executable), delay);
  }

  async function restartTypeScript(executable: TypeScriptExecutable): Promise<void> {
    if (shuttingDown) return;
    try {
      tsCapabilities = (await startTypeScript(executable)).capabilities;
    } catch (error) {
      connection.console.error(`Lumiose: TypeScript failed to restart: ${errorMessage(error)}`);
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
      `Lumiose: TypeScript language server restarted (pid ${ts?.process.pid}); ${reopened} open document(s) re-sent.`,
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
          ? islandPropDiagnostics(
              snapshot.document,
              filterBlockDiagnostics(snapshot.document, snapshot.blocks, diagnostics),
            )
          : file
            ? islandPropDiagnostics(
                file.document,
                isTsx(file.uri)
                  ? filterBlockDiagnostics(
                      file.document,
                      scan(file.document.getText(), uriToPath(file.uri) ?? file.uri).blocks,
                      diagnostics,
                    )
                  : diagnostics,
              )
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
      connection.console.error(`Lumiose: ${reason}`);
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

    const { lumiose, ...initializationOptions } = (params.initializationOptions ?? {}) as {
      lumiose?: { typescript?: string };
    };
    tsRoot = root;
    tsInitialize = {
      ...params,
      processId: process.pid,
      capabilities: capabilitiesForTypeScript(params.capabilities),
      initializationOptions,
    };
    try {
      const custom = options.typescript ?? lumiose?.typescript;
      const executable = custom
        ? { path: custom, version: "custom" }
        : await resolveTypeScript(root);
      tsCapabilities = (await startTypeScript(executable)).capabilities;
      tsExecutable = executable;
      log(
        `Lumiose: TypeScript ${executable.version} language server (${executable.path}, pid ${ts?.process.pid}).`,
      );
    } catch (error) {
      tsFailure = errorMessage(error);
      connection.console.error(`Lumiose: TypeScript features are unavailable: ${tsFailure}`);
    }

    await Promise.all(
      folders.filter((folder) => existsSync(join(folder, "src"))).map((folder) => syncRoot(folder)),
    );
    return {
      capabilities: serverCapabilities(tsCapabilities),
      serverInfo: { name: "lumiose-language-server", version: "0.0.0" },
    };
  });

  connection.onInitialized(() => {
    notifyTs("initialized", {});
    if (client.workspace?.didChangeWatchedFiles?.dynamicRegistration) {
      void connection.client.register(DidChangeWatchedFilesNotification.type, {
        // `.stsx` for shadows; modules that `$` constants can be imported from, and the configs
        // that drive their resolution, for the module hosts (and the CSS imports of modules).
        // `.css` for the project's global classes and custom properties.
        watchers: [
          { globPattern: "**/*.stsx" },
          { globPattern: "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,json}" },
          { globPattern: "**/*.css" },
        ],
      });
    }
    if (tsFailure !== undefined) {
      void connection.window.showErrorMessage(`Lumiose: ${tsFailure}`);
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
      const { files: synced, layout } = await syncShadows(root);
      projects.setLayout(root, layout);
      // Used packages' files are indexed by their own project.
      for (const file of synced) {
        if (file.own) indexStyles(file.source, root, file.text, file.scan);
      }
      for (const module of await projectModules(root)) {
        if (!files.has(fileKey(module.path))) styles.updateModule(module.path, root, module.text);
      }
    } catch (error) {
      connection.console.error(`Lumiose: shadow sync failed in ${root}: ${String(error)}`);
    }
  }

  /** Indexes a file's project-wide style symbols from disk, unless it is open (its buffer wins). */
  function indexStyles(path: string, root: string, text: string, scanned: ScanResult): void {
    if (!files.has(fileKey(path))) styles.updateStsx(path, root, text, scanned);
  }

  /** Re-indexes the CSS imports of a JS/TS module of a project from disk (unless it is open). */
  async function indexModule(path: string): Promise<void> {
    const root = projects.rootFor(path);
    if (!isProjectModule(root, path) || files.has(fileKey(path))) return;
    const text = await readFile(path, "utf8").catch(() => undefined);
    if (files.has(fileKey(path))) return;
    if (text === undefined) styles.delete(path);
    else styles.updateModule(path, root, text);
  }

  /**
   * Syncs the shadows of `.stsx` paths and tells TypeScript which shadows changed: in the file's
   * own project, and in the projects that shadow it as a used package's file (TASK-73).
   */
  async function syncFiles(changes: ReadonlyArray<{ path: string; type: FileChangeType }>) {
    const byRoot = new Map<string, { path: string; type: FileChangeType }[]>();
    for (const change of changes) {
      for (const root of projects.rootsShadowing(change.path)) {
        byRoot.set(root, [...(byRoot.get(root) ?? []), change]);
      }
    }
    for (const [root, rootChanges] of byRoot) {
      try {
        const { files: synced } = await syncShadows(root, {
          files: rootChanges.map((change) => change.path),
          layout: projects.layoutFor(root),
        });
        const found = new Set(synced.map((file) => fileKey(file.source)));
        for (const file of synced) {
          if (file.own) indexStyles(file.source, root, file.text, file.scan);
        }
        for (const { path } of rootChanges) {
          if (projects.rootFor(path) !== root) continue;
          if (!found.has(fileKey(path)) && !files.has(fileKey(path))) styles.delete(path);
        }
      } catch (error) {
        connection.console.error(`Lumiose: shadow sync failed in ${root}: ${String(error)}`);
        continue;
      }
      notifyTs("workspace/didChangeWatchedFiles", {
        changes: rootChanges.map((change) => ({
          uri: projects.shadowUri(pathToUri(change.path), root),
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
        styles.updateStsx(
          path,
          projects.rootFor(path),
          copy.getText(),
          file.snapshot.scan,
          file.uri,
        );
      }
    }
    return file.snapshot;
  }

  /** Indexes the CSS imports of an open JS/TS module of a project from its buffer. */
  function indexOpenModule(file: OpenFile): void {
    const path = uriToPath(file.uri);
    if (path === undefined) return;
    const root = projects.rootFor(path);
    if (isProjectModule(root, path)) styles.updateModule(path, root, file.document.getText());
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
      indexOpenModule(file);
    }
    if (file.typescript)
      notifyTs("textDocument/didOpen", { textDocument: typeScriptDocument(file) });
    modulesChanged([{ uri }]);
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
      indexOpenModule(file);
    }
    modulesChanged([{ uri }]);
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
    } else if (path !== undefined) {
      void indexModule(path);
    }
    // Module hosts read the file from disk again.
    modulesChanged([{ uri }]);
    if (!pullDiagnostics) void connection.sendDiagnostics({ uri, diagnostics: [] });
  });

  connection.onDidSaveTextDocument(({ textDocument: { uri } }) => {
    const file = files.get(fileKey(uri));
    if (file?.typescript) {
      notifyTs("textDocument/didSave", { textDocument: { uri: file.shadowUri ?? uri } });
    }
    const path = uriToPath(uri);
    if (file?.shadowUri !== undefined && path !== undefined) {
      void syncFiles([{ path, type: FileChangeType.Changed }]);
    }
  });

  connection.onDidChangeWatchedFiles(({ changes }) => {
    const stsx = changes.flatMap((change) => {
      const path = isStsx(change.uri) ? uriToPath(change.uri) : undefined;
      return path === undefined ? [] : [{ path, type: change.type }];
    });
    if (stsx.length > 0) void syncFiles(stsx);
    // A tsconfig or manifest change may move the shadows (TASK-73): sync those projects again.
    const configs = changes.flatMap((change) => {
      const path = uriToPath(change.uri);
      return path !== undefined && /(?:^|[/\\])(?:tsconfig[^/\\]*|package)\.json$/i.test(path)
        ? [path]
        : [];
    });
    for (const root of new Set(configs.map((path) => projects.rootFor(path)))) {
      if (!syncedRoots.has(root)) continue;
      projects.setLayout(root, undefined);
      void syncRoot(root);
    }
    for (const change of changes) {
      const path = uriToPath(change.uri);
      if (path === undefined) continue;
      if (/\.css$/i.test(path)) styles.cssChanged(path);
      else if (!isStsx(path)) void indexModule(path);
    }
    const others = changes.filter((change) => !isStsx(change.uri) && !/\.css$/i.test(change.uri));
    if (others.length > 0) notifyTs("workspace/didChangeWatchedFiles", { changes: others });
    modulesChanged(changes);
  });

  // --- Diagnostics -------------------------------------------------------------------------

  function moduleHostFor(root: string): ModuleHost {
    let host = moduleHosts.get(root);
    if (host === undefined) {
      host = new ModuleHost({
        root,
        read: (path) => files.get(fileKey(path))?.document.getText(),
      });
      moduleHosts.set(root, host);
    }
    return host;
  }

  /**
   * Files changed (an open document's buffer, or files on disk): the module hosts forget them, and
   * open documents whose providers read them are computed again.
   */
  function modulesChanged(changes: ReadonlyArray<{ uri: string; type?: FileChangeType }>): void {
    if (changes.length > 0) changeGeneration++;
    let stale = false;
    for (const { uri, type } of changes) {
      const path = uriToPath(uri);
      if (path === undefined) continue;
      const change: ModuleChange =
        type === FileChangeType.Created
          ? "created"
          : type === FileChangeType.Deleted
            ? "deleted"
            : "changed";
      for (const host of moduleHosts.values()) {
        for (const dependent of host.invalidate(path, change)) {
          const file = files.get(fileKey(dependent));
          if (file?.provided === undefined) continue;
          file.provided = undefined;
          stale = true;
        }
      }
    }
    if (!stale) return;
    if (!pullDiagnostics) schedulePush();
    else if (client.workspace?.diagnostics?.refreshSupport) {
      void connection.languages.diagnostics.refresh().catch(() => undefined);
    }
  }

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
      const typescript = file.typescript
        ? islandPropDiagnostics(file.document, fromTs(await fromTypeScript(file.uri)))
        : [];
      if (!isTsx(file.uri)) return typescript;
      // Raw CSS in a `.tsx` file (LUM1006 "rename to .stsx"), then the providers'. TypeScript's
      // errors inside such a block are noise that the rename removes.
      const { document } = file;
      const scanned = scan(document.getText(), uriToPath(file.uri) ?? file.uri);
      const kept = filterBlockDiagnostics(document, scanned.blocks, typescript);
      const lumiose = [
        ...scanned.diagnostics,
        ...(await provided(file, scanned)),
        ...(await projectFindings(file)),
      ];
      return [
        ...kept,
        ...withoutSuperseded(document, lumiose, kept).map((d) => toLspDiagnostic(document, d)),
      ];
    }
    const snapshot = snapshotOf(file);
    const typescript = islandPropDiagnostics(
      snapshot.document,
      fromTs(
        filterBlockDiagnostics(
          snapshot.document,
          snapshot.blocks,
          await fromTypeScript(file.shadowUri),
        ),
      ),
    );
    const lumiose = [
      ...snapshot.scan.diagnostics,
      ...(await provided(file, snapshot.scan)),
      ...(await projectFindings(file)),
    ];
    const lumioseLsp = withoutSuperseded(snapshot.document, lumiose, typescript).map((diagnostic) =>
      toLspDiagnostic(snapshot.document, diagnostic),
    );
    return [...typescript, ...lumioseLsp, ...cssDiagnostics(snapshot, lumioseLsp)];
  }

  /**
   * The project-wide diagnostics of the document's file (LUM4003, LUM3012): one run per project
   * and change generation. When a run changes what other open documents show, they are refreshed.
   */
  async function projectFindings(file: OpenFile): Promise<readonly CompilerDiagnostic[]> {
    const factory = options.projectDiagnostics;
    const path = uriToPath(file.uri);
    if (factory === undefined || path === undefined) return [];
    const root = projects.rootFor(path);
    let state = projectChecks.get(root);
    if (state === undefined) {
      state = { run: factory(root, moduleHostFor(root)), generation: -1, reported: new Map() };
      projectChecks.set(root, state);
    }
    let result = state.result;
    if (result === undefined || state.generation !== changeGeneration) {
      const current = state;
      current.generation = changeGeneration;
      result = current.run().catch((error: unknown) => {
        connection.console.error(`Lumiose: the project checks failed: ${errorMessage(error)}`);
        return new Map();
      });
      current.result = result;
      void result.then((found) => refreshIfChanged(current, found, path));
    }
    return (await result).get(path) ?? [];
  }

  /** Refreshes the diagnostics of the other open documents whose project findings changed. */
  function refreshIfChanged(
    state: { reported: Map<string, string> },
    found: ReadonlyMap<string, readonly CompilerDiagnostic[]>,
    requested: string,
  ): void {
    let changed = false;
    const keys = new Set([...state.reported.keys(), ...found.keys()]);
    for (const key of keys) {
      const next = JSON.stringify(found.get(key) ?? []);
      if (state.reported.get(key) === next) continue;
      state.reported.set(key, next);
      if (key !== requested && files.has(fileKey(key))) changed = true;
    }
    if (!changed) return;
    if (!pullDiagnostics) schedulePush();
    else if (client.workspace?.diagnostics?.refreshSupport) {
      void connection.languages.diagnostics.refresh().catch(() => undefined);
    }
  }

  /**
   * The diagnostic providers' results for the document's current version. Each version is
   * computed once: pulls follow the client's own debounce, pushes the server's.
   */
  function provided(file: OpenFile, scanned: ScanResult): Promise<CompilerDiagnostic[]> {
    const { version } = file.document;
    if (file.provided?.version === version) return file.provided.diagnostics;
    const path = uriToPath(file.uri);
    const root = path === undefined ? tsRoot : projects.rootFor(path);
    const lumioseFile: LumioseFile = {
      uri: file.uri,
      path: path ?? file.uri,
      root,
      text: file.document.getText(),
      scan: scanned,
      ...(path === undefined ? {} : { modules: moduleHostFor(root) }),
    };
    const diagnostics = (async () => {
      const results = await Promise.all(
        (options.diagnosticProviders ?? []).map(async (provider) => {
          try {
            return await provider(lumioseFile);
          } catch (error) {
            connection.console.error(
              `Lumiose: a diagnostic provider failed: ${errorMessage(error)}`,
            );
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
            connection.console.error(
              `Lumiose: diagnostics failed for ${file.uri}: ${String(error)}`,
            ),
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

  // --- Completion --------------------------------------------------------------------------

  type Tag = "ts" | "css" | "class" | "snippet" | "style";

  function tagged(result: CompletionList | CompletionItem[] | null, tag: Tag) {
    if (!result) return result;
    const list = Array.isArray(result) ? { isIncomplete: false, items: result } : result;
    // Default data is folded into the items: a wrapped item no longer inherits it.
    const defaults: unknown = list.itemDefaults?.data;
    for (const item of list.items) item.data = { lumiose: tag, data: item.data ?? defaults };
    if (list.itemDefaults) delete list.itemDefaults.data;
    return list;
  }

  /** The project root and path of a file URI (unset for other schemes). */
  function projectOf(uri: string): { root: string; path: string } | undefined {
    const path = uriToPath(uri);
    return path === undefined ? undefined : { root: projects.rootFor(path), path };
  }

  /**
   * Class completion in a `class` attribute (decision-23): the blocks that apply at the cursor
   * (its enclosing subtrees' blocks, file-level and global blocks of the file), then the project's
   * global classes (other files' `<style global>` blocks, imported `.css` files). Sorted in that
   * order: innermost subtree first.
   */
  function classCompletion(at: StsxAt): CompletionList | undefined {
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
    const range = rangeOf(snapshot, start, end);
    const items = new Map<string, CompletionItem>();
    const add = (name: string, detail: string, rank: string) => {
      if (present.has(name) || items.has(name)) return;
      items.set(name, {
        label: name,
        kind: CompletionItemKind.Class,
        detail,
        sortText: `${rank}-${name}`,
        filterText: name,
        textEdit: {
          range,
          newText: slot.kind === "key" && !isIdentifier(name) ? JSON.stringify(name) : name,
        },
        data: { lumiose: "class" satisfies Tag },
      });
    };
    // Ranks: enclosing subtrees (the innermost, i.e. the smallest, first), file, global.
    const local = snapshot.selectors
      .filter((selector) => snapshot.visibleAt(selector.block, offset))
      .map((selector) => {
        const block = snapshot.blocks[selector.block]!;
        const scope = snapshot.scopes[selector.block];
        const rank = scope
          ? `0${String(scope.end - scope.start).padStart(10, "0")}`
          : block.global
            ? "2"
            : "1";
        const kind = scope ? `<${scope.element?.name ?? ""}>` : block.global ? "global" : "file";
        return { selector, rank, kind };
      })
      .toSorted((a, b) => a.rank.localeCompare(b.rank));
    for (const { selector, rank, kind } of local) {
      const line = snapshot.document.positionAt(selector.start).line + 1;
      add(selector.name, `${kind} style, line ${line}`, rank);
    }
    const project = projectOf(at.file.uri);
    for (const global of project ? styles.classes(project.root, project.path) : []) {
      const kind = global.css ? "global CSS" : "global style";
      add(
        global.name,
        `${kind}, ${where(project!.root, global.path, global.range.start.line)}`,
        "3",
      );
    }
    return { isIncomplete: false, items: [...items.values()] };
  }

  /** Project global classes (other files, imported `.css`) named `name`, for `uri`'s project. */
  function globalDefinitions(uri: string, name: string): GlobalClass[] {
    const project = projectOf(uri);
    if (!project) return [];
    return styles.classes(project.root, project.path).filter((global) => global.name === name);
  }

  /**
   * Custom property names in `var(…)` and at declaration starts: the file's own declarations
   * first (every block: custom properties are not scoped), then the project's. The detail is the
   * declared value; the documentation lists the declarations.
   */
  function propertyCompletion(at: StsxAt & { css: CssBlock }, base: CompletionList) {
    const { snapshot, css, offset } = at;
    const virtual = css.document.getText();
    const context = propertyContext(
      virtual,
      offset,
      css.block.content.start,
      css.block.content.end,
    );
    if (!context) return base;
    const text = snapshot.document.getText();
    const local: CustomProperty[] = snapshot.cssBlocks.flatMap(({ block, document }) =>
      propertyDeclarations(document.getText(), block.content.start, block.content.end)
        .filter((found) => !(found.start <= offset && offset <= found.end))
        .map((found) => ({
          name: found.name,
          uri: at.file.uri,
          path: uriToPath(at.file.uri) ?? at.file.uri,
          range: rangeOf(snapshot, found.start, found.end),
          value: text.slice(found.valueStart, found.valueEnd),
          selector: found.selector,
          origin: block.global ? "global" : block.placement === "jsx" ? "element" : "file",
        })),
    );
    const project = projectOf(at.file.uri);
    const others = project ? styles.customProperties(project.root, project.path) : [];
    const byName = new Map<string, { local: boolean; declarations: CustomProperty[] }>();
    for (const property of [...local, ...others]) {
      const entry = byName.get(property.name) ?? {
        local: local.includes(property),
        declarations: [],
      };
      entry.declarations.push(property);
      byName.set(property.name, entry);
    }
    const range = rangeOf(snapshot, context.start, context.end);
    const snippets = client.textDocument?.completion?.completionItem?.snippetSupport === true;
    // A declaration name gets its colon unless one follows already.
    const colon =
      context.kind === "declaration" && !/^\s*:/.test(virtual.slice(context.end, context.end + 40));
    const items: CompletionItem[] = [...byName].map(([name, { local: own, declarations }]) => ({
      label: name,
      kind: CompletionItemKind.Variable,
      detail: clip(declarations[0]!.value),
      documentation: {
        kind: MarkupKind.Markdown,
        value: declarations
          .slice(0, 6)
          .map((declaration) => {
            const file = project
              ? where(project.root, declaration.path, declaration.range.start.line)
              : `line ${declaration.range.start.line + 1}`;
            const rule = declaration.selector ? `\`${declaration.selector}\` ` : "";
            return `- ${rule}\`${clip(declaration.value)}\` (${declaration.origin}, ${file})`;
          })
          .join("\n"),
      },
      sortText: `${own ? 0 : 1}-${name}`,
      filterText: name,
      textEdit: {
        range,
        newText: colon ? (snippets ? `${name}: $0;` : `${name}: `) : name,
      },
      ...(colon && snippets ? { insertTextFormat: InsertTextFormat.Snippet } : {}),
      data: { lumiose: "css" satisfies Tag },
    }));
    // The CSS service's own custom properties are the current block's only: replaced.
    const kept = base.items.filter(
      (item) => !(item.label.startsWith("--") && byName.has(item.label)),
    );
    return { ...base, items: [...kept, ...items] };
  }

  /** Completion in a `<style …>` open tag: its only attribute, `global`. */
  function styleTagCompletion(at: StsxAt, block: StyleBlock): CompletionList | null {
    const { snapshot, offset } = at;
    const text = snapshot.document.getText();
    const nameEnd = block.openTag.start + "<style".length;
    if (offset < nameEnd || offset >= block.openTag.end) return null;
    let start = offset;
    while (start > nameEnd && /[\w-]/.test(text[start - 1]!)) start--;
    let end = offset;
    while (end < block.openTag.end && /[\w-]/.test(text[end]!)) end++;
    if (start === nameEnd && start === offset && !/\s/.test(text[start] ?? "")) return null;
    const written = block.attributes.some(
      (attribute) => attribute.name === "global" && !(attribute.span.start === start),
    );
    if (written) return { isIncomplete: false, items: [] };
    return {
      isIncomplete: false,
      items: [
        {
          label: "global",
          kind: CompletionItemKind.Property,
          detail: "app-wide, unscoped CSS",
          documentation: { kind: MarkupKind.Markdown, value: GLOBAL_DOC },
          textEdit: { range: rangeOf(snapshot, start, end), newText: "global" },
          data: { lumiose: "style" satisfies Tag },
        },
      ],
    };
  }

  connection.onCompletion(async (params, token) => {
    const at = stsxAt(params.textDocument.uri, params.position);
    if (at?.css) {
      if (at.ref && at.offset > at.ref.span.start) {
        return tagged(await forward("textDocument/completion", params, token, true), "ts");
      }
      return propertyCompletion(
        { ...at, css: at.css },
        tagged(cssCompletion(at.css, params.position), "css")!,
      );
    }
    const block = at?.snapshot.inBlock(at.offset);
    if (at && block) return styleTagCompletion(at, block);
    if (at) {
      const classes = classCompletion(at);
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
    const list = tagged(await forward("textDocument/completion", params, token, true), "ts");
    if (!at || trigger !== undefined) return list;
    const snippets = snippetCompletions(
      at.snapshot.scan.masked,
      at.offset,
      at.snapshot.jsx,
      uriToPath(at.file.uri) ?? at.file.uri,
      (start, end) => rangeOf(at.snapshot, start, end),
    );
    if (snippets.length === 0) return list;
    return {
      isIncomplete: list?.isIncomplete ?? false,
      ...(list?.itemDefaults ? { itemDefaults: list.itemDefaults } : {}),
      items: [...(list?.items ?? []), ...snippets],
    };
  });

  connection.onCompletionResolve(async (item, token) => {
    const data = item.data as { lumiose?: Tag; data?: unknown } | undefined;
    if (data?.lumiose !== "ts") return item;
    const resolved = await forward<CompletionItem>(
      "completionItem/resolve",
      { ...item, data: data.data },
      token,
    );
    if (!resolved) return item;
    // Lumiose attributes TypeScript cannot document (`on:x`, `key`).
    const doc =
      resolved.detail && !hasText(resolved.documentation) && attributeDoc(resolved.detail);
    return {
      ...resolved,
      ...(doc ? { documentation: { kind: MarkupKind.Markdown, value: doc } } : {}),
      data,
    };
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
        ? `\`${name}\`: Lumiose constant reference (not statically resolved)`
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
    const block = at?.snapshot.inBlock(at.offset);
    if (at && block) return styleTagHover(at, block);
    const hover = await forward<Hover>("textDocument/hover", params, token);
    const file = files.get(fileKey(params.textDocument.uri));
    const document = at?.snapshot.document ?? file?.document;
    if (!document) return hover;
    const offset = document.offsetAt(params.position);
    const documented = withAttributeDoc(hover, document.getText(), offset);
    return file && (isStsx(file.uri) || isTsx(file.uri))
      ? withContract(documented, file, offset)
      : documented;
  });

  /** Adds the execution contract of the JSX expression under the cursor (TASK-137). */
  function withContract(hover: Hover | null, file: OpenFile, offset: number): Hover | null {
    const { document } = file;
    if (file.contract?.version !== document.version) {
      const path = uriToPath(file.uri) ?? file.uri;
      file.contract = {
        version: document.version,
        entries: contractEntries(document.getText(), path),
      };
    }
    const entry = contractAt(file.contract.entries, offset);
    if (entry === undefined) return hover;
    const contract = contractMarkdown(entry, document.getText());
    if (!hover) {
      return {
        contents: { kind: MarkupKind.Markdown, value: contract },
        range: {
          start: document.positionAt(entry.span.start),
          end: document.positionAt(entry.span.end),
        },
      };
    }
    return {
      ...hover,
      contents: {
        kind: MarkupKind.Markdown,
        value: `${hoverMarkdown(hover.contents)}\n\n---\n\n${contract}`,
      },
    };
  }

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
          local = snapshot.selectors.filter(
            (selector) =>
              selector.name === target.name && snapshot.visibleAt(selector.block, target.start),
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
        return classGroup(at.snapshot, target)
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
        return classGroup(at.snapshot, target).map((occurrence): DocumentHighlight => ({
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
      const edits = classGroup(at.snapshot, target).map((occurrence): TextEdit => ({
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

  /** Formatting the masked TSX must not touch style blocks (blank there; `lumiose fmt` formats CSS). */
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
    const lumiose = [...snapshot.scan.diagnostics, ...(await provided(file, snapshot.scan))];
    return [...lumioseQuickFixes(snapshot.document, lumiose, params.range), ...actions];
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
 * Drops Lumiose diagnostics that a TypeScript error inside their span supersedes (an unknown `$`
 * reference: TypeScript's "Cannot find name" is the actionable one), as `lumiose check` does.
 */
function withoutSuperseded(
  document: TextDocument,
  lumiose: readonly CompilerDiagnostic[],
  typescript: readonly Diagnostic[],
): CompilerDiagnostic[] {
  const errors = typescript
    .filter((d) => d.severity === DiagnosticSeverity.Error)
    .map((d) => document.offsetAt(d.range.start));
  return lumiose.filter(
    (d) =>
      !SUPERSEDED_BY_TYPESCRIPT.has(d.code) ||
      !errors.some((offset) => d.span.start <= offset && offset < d.span.end),
  );
}

/**
 * The occurrences that rename together with `target`. Its definitions are the selectors of the
 * blocks that apply at its position (for a selector: at its block's enclosing element). When all
 * of them are nested blocks, the group is the outermost of their subtrees: the selectors of the
 * blocks inside it and the usages inside it. Otherwise (a file-level or global definition, or
 * none) it is every occurrence in the file.
 */
function classGroup(snapshot: StsxSnapshot, target: ClassTarget): ClassOccurrenceRef[] {
  const { scopes } = snapshot;
  const selectors = snapshot.selectors.filter((selector) => selector.name === target.name);
  const usages = snapshot.classAttributes.usages.filter((usage) => usage.name === target.name);
  const origin = target.block === undefined ? target.start : scopes[target.block]?.start;
  const defining =
    origin === undefined
      ? [undefined]
      : selectors
          .filter((selector) => snapshot.visibleAt(selector.block, origin))
          .map((selector) => scopes[selector.block]);
  let group: { start: number; end: number } | undefined;
  if (defining.length > 0 && defining.every((scope) => scope !== undefined)) {
    group = {
      start: Math.min(...defining.map((scope) => scope!.start)),
      end: Math.max(...defining.map((scope) => scope!.end)),
    };
  }
  const inGroup = (start: number, end: number) =>
    group === undefined || (group.start <= start && end <= group.end);
  return [
    ...selectors
      .filter((selector) => {
        const scope = scopes[selector.block];
        return group === undefined || (scope !== undefined && inGroup(scope.start, scope.end));
      })
      .map((selector) => ({ ...selector, selector: true })),
    ...usages
      .filter((usage) => inGroup(usage.start, usage.end))
      .map((usage) => ({ ...usage, selector: false })),
  ];
}

/** `src/a.stsx:3`, relative to the project root. */
function where(root: string, path: string, line: number): string {
  return `${relative(root, path).split(sep).join("/")}:${line + 1}`;
}

/** The `style` name and the `global` attribute of a `<style>` open tag. */
function styleTagHover(at: StsxAt, block: StyleBlock): Hover | null {
  const { snapshot, offset } = at;
  const name = { start: block.openTag.start + 1, end: block.openTag.start + "<style".length };
  if (name.start <= offset && offset <= name.end) {
    return {
      contents: { kind: MarkupKind.Markdown, value: STYLE_DOC },
      range: rangeOf(snapshot, name.start, name.end),
    };
  }
  const global = block.attributes.find(
    (attribute) =>
      attribute.name === "global" && attribute.span.start <= offset && offset <= attribute.span.end,
  );
  if (!global) return null;
  return {
    contents: { kind: MarkupKind.Markdown, value: GLOBAL_DOC },
    range: rangeOf(snapshot, global.span.start, global.span.end),
  };
}

/** Adds the description of a Lumiose attribute TypeScript leaves undocumented (`on:x`, `key`). */
function withAttributeDoc(hover: Hover | null, text: string, offset: number): Hover | null {
  if (!hover) return hover;
  const markdown = hoverMarkdown(hover.contents);
  const code = /^```\w*\n([\s\S]*?)```\s*$/.exec(markdown)?.[1];
  if (code === undefined) return hover; // documented already, or not a property
  const doc = attributeDoc(code);
  // `key` must be a JSX attribute (`key={…}`), not an object's `key` property.
  if (!doc || (/\bkey\?/.test(code) && !/^[\w$]*\s*=/.test(text.slice(offset)))) return hover;
  return { ...hover, contents: { kind: MarkupKind.Markdown, value: `${markdown}\n${doc}` } };
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

/** A declared value for a one-line detail. */
function clip(value: string): string {
  const line = value.replace(/\s+/g, " ");
  return line.length > 60 ? `${line.slice(0, 59)}…` : line;
}

function hasText(documentation: CompletionItem["documentation"]): boolean {
  if (documentation === undefined) return false;
  return (typeof documentation === "string" ? documentation : documentation.value).trim() !== "";
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
      identifier: "lumiose",
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
