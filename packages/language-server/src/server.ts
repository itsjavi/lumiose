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
// attributes and selectors, `$ref` hovers with the folded value, and Lumen diagnostics.

import type { Diagnostic as CompilerDiagnostic, ScanResult, StyleRef } from "@lumen/compiler";
import { scan } from "@lumen/compiler";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  CompletionItemKind,
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
  cssFoldingRanges,
  cssHighlights,
  cssHover,
} from "./css.ts";
import {
  filterBlockDiagnostics,
  lumenQuickFixes,
  toLspDiagnostic,
  touchesBlock,
} from "./diagnostics.ts";
import { rewriteUris } from "./rewrite.ts";
import { syncShadows } from "./shadows.ts";
import {
  componentAt,
  StsxSnapshot,
  visibleBlocks,
  type CssBlock,
  type OffsetRange,
} from "./stsx.ts";
import { resolveTypeScript, spawnTypeScript, type TypeScriptServer } from "./typescript.ts";
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
  text: string;
  scan: ScanResult;
}

/** Extra Lumen diagnostics (e.g. the compiler's) for an `.stsx` file, as UTF-16 spans. */
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
  let projects = new Projects([]);
  let ts: TypeScriptServer | undefined;
  let tsCapabilities: ServerCapabilities = {};
  let tsFailure: string | undefined;
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
    if (!ts) return null;
    // vscode-jsonrpc sends every argument before a token as a parameter, so an `undefined` token
    // must not be passed (it would turn the params into a positional array).
    const args: unknown[] = params === undefined ? [] : [toTs(params)];
    if (token) args.push(token);
    const result = await ts.connection.sendRequest<R>(method, ...args);
    return raw ? result : fromTs(result);
  }

  function notifyTs(method: string, params: unknown): void {
    if (ts) void ts.connection.sendNotification(method, params);
  }

  // --- TypeScript process ------------------------------------------------------------------

  function wireTypeScript(server: TypeScriptServer): void {
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
    server.process.on("exit", (code, signal) => {
      if (ts === server) ts = undefined;
      if (!shuttingDown) {
        const reason = `The TypeScript language server exited (${signal ?? `code ${code}`}).`;
        connection.console.error(reason);
        void connection.window.showErrorMessage(
          `Lumen: ${reason} Restart the Lumen language server to recover TypeScript features.`,
        );
      }
    });
    tsc.listen();
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
    try {
      const custom = options.typescript ?? lumen?.typescript;
      const executable = custom
        ? { path: custom, version: "custom" }
        : await resolveTypeScript(root);
      ts = spawnTypeScript(executable, root, log);
      wireTypeScript(ts);
      const result = await ts.connection.sendRequest<InitializeResult>("initialize", {
        ...params,
        processId: process.pid,
        capabilities: capabilitiesForTypeScript(params.capabilities),
        initializationOptions,
      });
      tsCapabilities = result.capabilities;
      log(`Lumen: TypeScript ${executable.version} language server (${executable.path}).`);
    } catch (error) {
      ts?.process.kill();
      ts = undefined;
      tsFailure = error instanceof Error ? error.message : String(error);
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
    if (ts) await ts.connection.sendRequest("shutdown").catch(() => undefined);
  });

  connection.onExit(() => {
    shuttingDown = true;
    if (!ts) return;
    void ts.connection.sendNotification("exit").catch(() => undefined);
    ts.process.kill();
  });

  // --- Shadows -----------------------------------------------------------------------------

  async function syncRoot(root: string): Promise<void> {
    syncedRoots.add(root);
    try {
      await syncShadows(root);
    } catch (error) {
      connection.console.error(`Lumen: shadow sync failed in ${root}: ${String(error)}`);
    }
  }

  /** Syncs the shadows of `.stsx` paths and tells TypeScript which shadows changed. */
  async function syncFiles(changes: ReadonlyArray<{ path: string; type: FileChangeType }>) {
    const byRoot = Map.groupBy(changes, (change) => projects.rootFor(change.path));
    for (const [root, rootChanges] of byRoot) {
      try {
        await syncShadows(root, { files: rootChanges.map((change) => change.path) });
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
      file.snapshot = new StsxSnapshot(copy, uriToPath(file.uri) ?? file.uri);
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
      notifyTs("textDocument/didOpen", {
        textDocument: {
          uri: file.shadowUri,
          languageId: "typescriptreact",
          version,
          text: snapshotOf(file).scan.masked,
        },
      });
    } else if (isTypeScriptDocument(uri, languageId)) {
      file.typescript = true;
      notifyTs("textDocument/didOpen", { textDocument: { uri, languageId, version, text } });
    }
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
      const items = file.typescript ? fromTs(await fromTypeScript(file.uri)) : [];
      if (/\.tsx$/i.test(file.uri)) {
        // Raw CSS in a `.tsx` file (LUM1006 "rename to .stsx").
        const result = scan(file.document.getText(), uriToPath(file.uri) ?? file.uri);
        items.push(...result.diagnostics.map((d) => toLspDiagnostic(file.document, d)));
      }
      return items;
    }
    const snapshot = snapshotOf(file);
    const typescript = filterBlockDiagnostics(
      snapshot.document,
      snapshot.blocks,
      await fromTypeScript(file.shadowUri),
    );
    const lumen = [...snapshot.scan.diagnostics];
    const path = uriToPath(file.uri) ?? file.uri;
    for (const provider of options.diagnosticProviders ?? []) {
      try {
        lumen.push(
          ...(await provider({
            uri: file.uri,
            path,
            text: snapshot.document.getText(),
            scan: snapshot.scan,
          })),
        );
      } catch (error) {
        connection.console.error(`Lumen: a diagnostic provider failed: ${String(error)}`);
      }
    }
    return [
      ...fromTs(typescript),
      ...lumen.map((diagnostic) => toLspDiagnostic(snapshot.document, diagnostic)),
      ...cssDiagnostics(snapshot),
    ];
  }

  connection.languages.diagnostics.on(async (params, token) => {
    const file = files.get(fileKey(params.textDocument.uri));
    if (file && (file.shadowUri !== undefined || /\.tsx$/i.test(file.uri))) {
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
    return { isIncomplete: false, items: [...items.values()] };
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
        let definitions: ClassOccurrence[] = [target]; // a selector is its own definition
        if (target.block === undefined) {
          const blocks = visibleBlocks(snapshot, await componentsOf(at), target.start);
          definitions = snapshot.selectors.filter(
            (selector) => selector.name === target.name && blocks.has(selector.block),
          );
        }
        if (client.textDocument?.definition?.linkSupport) {
          return definitions.map((selector): LocationLink => ({
            originSelectionRange: origin,
            targetUri: at.file.uri,
            targetRange: rangeOf(snapshot, selector.start - 1, selector.end),
            targetSelectionRange: rangeOf(snapshot, selector.start, selector.end),
          }));
        }
        return definitions.map((selector): Location => ({
          uri: at.file.uri,
          range: rangeOf(snapshot, selector.start, selector.end),
        }));
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
    return [
      ...lumenQuickFixes(snapshot.document, snapshot.scan.diagnostics, params.range),
      ...actions,
    ];
  });

  // --- Everything else goes to TypeScript --------------------------------------------------

  connection.onRequest((method, params, token) => forward(method, params, token));
  connection.onNotification((method, params) => notifyTs(method, toTs(params)));

  connection.listen();
}

function isTypeScriptDocument(uri: string, languageId: string): boolean {
  return TS_LANGUAGES.has(languageId) || TS_EXTENSION.test(uri);
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
