// The Lumen VS Code extension (spec §9.2): the `stsx` language (contributed in package.json), the
// language client for `@lumen/language-server`, and the takeover-mode prompt.

import * as vscode from "vscode";
import {
  LanguageClient,
  TransportKind,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node";
import {
  documentLanguages,
  resolveServerEntry,
  SERVER_PACKAGE,
  shouldPromptTakeover,
  takeoverActive,
  usesLumen,
  type TakeoverSetting,
  type TakeoverState,
} from "./workspace.ts";

/** Extensions whose TypeScript features the takeover server replaces. */
const TYPESCRIPT_EXTENSIONS = [
  "vscode.typescript-language-features",
  "TypeScriptTeam.native-preview",
];
const BUILTIN_TYPESCRIPT_NAME = "TypeScript and JavaScript Language Features";

let client: LanguageClient | undefined;
let output: vscode.LogOutputChannel | undefined;
/** The takeover state the running client was started with. */
let clientTakeover: boolean | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  output = vscode.window.createOutputChannel("Lumen Language Server", { log: true });
  context.subscriptions.push(
    output,
    vscode.commands.registerCommand("lumen.restartServer", () => restart(context)),
    vscode.commands.registerCommand("lumen.setupTakeover", () => showTakeoverSteps()),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration("lumen.server") ||
        event.affectsConfiguration("lumen.takeover")
      ) {
        void restart(context);
      }
    }),
    // Enabling or disabling a TypeScript extension switches takeover mode.
    vscode.extensions.onDidChange(() => {
      if (clientTakeover !== undefined && clientTakeover !== takeoverActive(takeoverState())) {
        void restart(context);
      }
    }),
  );
  await start(context);
  void promptTakeover();
}

export async function deactivate(): Promise<void> {
  await stop();
}

async function start(context: vscode.ExtensionContext): Promise<void> {
  const configuration = vscode.workspace.getConfiguration("lumen");
  const folders = (vscode.workspace.workspaceFolders ?? [])
    .filter((folder) => folder.uri.scheme === "file")
    .map((folder) => folder.uri.fsPath);
  const entry = resolveServerEntry({
    configured: configuration.get<string>("server.path"),
    folders,
    extensionPath: context.extensionPath,
  });
  if (entry === undefined) {
    void reportMissingServer(configuration.get<string>("server.path"));
    return;
  }

  const runtime = configuration.get<string>("server.runtime")?.trim() || "node";
  const serverOptions: ServerOptions = {
    command: runtime,
    args: [entry.path],
    transport: TransportKind.stdio,
    options: { cwd: folders[0] ?? context.extensionPath },
  };
  const takeover = takeoverActive(takeoverState());
  clientTakeover = takeover;
  const clientOptions: LanguageClientOptions = {
    // File documents only: TypeScript 7 has no project for untitled documents.
    documentSelector: documentLanguages(takeover).map((language) => ({ scheme: "file", language })),
    outputChannel: output,
  };
  output?.info(
    `Starting ${entry.path} (${entry.source}) with ${runtime}; takeover ${takeover ? "on" : "off"}.`,
  );
  client = new LanguageClient("lumen", "Lumen Language Server", serverOptions, clientOptions);
  try {
    await client.start();
  } catch (error) {
    output?.error(`The language server failed to start: ${String(error)}`);
    void vscode.window.showErrorMessage(
      `Lumen: the language server failed to start (${runtime} ${entry.path}). It needs Node.js ≥ 24; set "lumen.server.runtime" to a newer node.`,
    );
  }
}

async function stop(): Promise<void> {
  const current = client;
  client = undefined;
  clientTakeover = undefined;
  if (current?.isRunning()) await current.stop();
}

async function restart(context: vscode.ExtensionContext): Promise<void> {
  await stop();
  await start(context);
}

function takeoverState(): TakeoverState {
  const setting = vscode.workspace
    .getConfiguration("lumen")
    .get<TakeoverSetting>("takeover", "prompt");
  return {
    setting,
    typescriptExtensionActive: TYPESCRIPT_EXTENSIONS.some(
      (id) => vscode.extensions.getExtension(id) !== undefined,
    ),
    usesLumen: (vscode.workspace.workspaceFolders ?? []).some(
      (folder) => folder.uri.scheme === "file" && usesLumen(folder.uri.fsPath),
    ),
  };
}

/** Offers takeover mode, as Vue's extension does: the built-in TS extension must be disabled. */
async function promptTakeover(): Promise<void> {
  if (!shouldPromptTakeover(takeoverState())) return;
  const enable = "Enable Takeover Mode";
  const never = "Don't Ask Again";
  const choice = await vscode.window.showInformationMessage(
    "This workspace uses Lumen. In takeover mode, one TypeScript 7 server (through the Lumen language server) handles .ts, .tsx and .stsx files, so types and renames flow between them. It needs the built-in TypeScript extension disabled for this workspace.",
    enable,
    never,
  );
  if (choice === enable) await showTakeoverSteps();
  else if (choice === never) {
    // "auto" keeps takeover following the TypeScript extension's state, without prompting.
    await vscode.workspace
      .getConfiguration("lumen")
      .update("takeover", "auto", vscode.ConfigurationTarget.Workspace);
  }
}

/** VS Code has no API to disable an extension: show it, with the steps. */
async function showTakeoverSteps(): Promise<void> {
  const active = TYPESCRIPT_EXTENSIONS.filter((id) => vscode.extensions.getExtension(id));
  if (active.length === 0) {
    void vscode.window.showInformationMessage(
      "Lumen takeover mode is already active: no TypeScript extension is enabled in this workspace.",
    );
    return;
  }
  await vscode.commands.executeCommand(
    "workbench.extensions.search",
    active.includes(TYPESCRIPT_EXTENSIONS[0]!) ? "@builtin typescript" : `@id:${active[0]}`,
  );
  const reload = "Reload Window";
  const choice = await vscode.window.showInformationMessage(
    `In the Extensions view, open the gear menu of "${BUILTIN_TYPESCRIPT_NAME}" (and of TypeScript Native Preview, if installed), choose "Disable (Workspace)", then reload the window.`,
    reload,
  );
  if (choice === reload) await vscode.commands.executeCommand("workbench.action.reloadWindow");
}

async function reportMissingServer(configured: string | undefined): Promise<void> {
  const message = configured?.trim()
    ? `Lumen: the language server at "${configured}" (lumen.server.path) does not exist.`
    : `Lumen: ${SERVER_PACKAGE} was not found in this workspace, so .stsx files only get syntax highlighting. Install it as a dev dependency, or set "lumen.server.path".`;
  const settings = "Open Settings";
  if ((await vscode.window.showWarningMessage(message, settings)) === settings) {
    await vscode.commands.executeCommand("workbench.action.openSettings", "lumen.server");
  }
}
