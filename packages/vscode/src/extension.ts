// The Lumiose VS Code extension (spec §9.2): the `stsx` language (contributed in package.json), the
// language client for `@lumiose/language-server`, and the takeover-mode prompt.

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
  serverRuntime,
  shouldPromptTakeover,
  takeoverActive,
  usesLumiose,
  type ServerEntry,
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
/** The server the running client was started with. */
let server: (ServerEntry & { runtime: string }) | undefined;
let output: vscode.LogOutputChannel | undefined;
/** The takeover state the running client was started with. */
let clientTakeover: boolean | undefined;

/** What `activate` returns: read by the smoke test, and by other extensions. */
export interface LumioseExtensionApi {
  /** The language server in use: its entry, where it was found, and the runtime running it. */
  server(): (ServerEntry & { runtime: string }) | undefined;
}

export async function activate(context: vscode.ExtensionContext): Promise<LumioseExtensionApi> {
  output = vscode.window.createOutputChannel("Lumiose Language Server", { log: true });
  context.subscriptions.push(
    output,
    vscode.commands.registerCommand("lumiose.restartServer", () => restart(context)),
    vscode.commands.registerCommand("lumiose.setupTakeover", () => showTakeoverSteps()),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration("lumiose.server") ||
        event.affectsConfiguration("lumiose.takeover")
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
  return { server: () => server };
}

export async function deactivate(): Promise<void> {
  await stop();
}

async function start(context: vscode.ExtensionContext): Promise<void> {
  const configuration = vscode.workspace.getConfiguration("lumiose");
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

  const runtime = serverRuntime(entry, configuration.get<string>("server.runtime"));
  const cwd = folders[0] ?? context.extensionPath;
  // A module without `runtime` runs on VS Code's own Node.js (its executable as Node).
  const serverOptions: ServerOptions =
    runtime.kind === "vscode"
      ? { module: entry.path, transport: TransportKind.stdio, options: { cwd } }
      : {
          command: runtime.command,
          args: [entry.path],
          transport: TransportKind.stdio,
          options: { cwd },
        };
  const runtimeName =
    runtime.kind === "vscode" ? `VS Code's Node.js ${process.version}` : runtime.command;
  server = { ...entry, runtime: runtimeName };
  const takeover = takeoverActive(takeoverState());
  clientTakeover = takeover;
  const clientOptions: LanguageClientOptions = {
    // File documents only: TypeScript 7 has no project for untitled documents.
    documentSelector: documentLanguages(takeover).map((language) => ({ scheme: "file", language })),
    outputChannel: output,
  };
  output?.info(
    `Starting ${entry.path} (${entry.source}) with ${runtimeName}; takeover ${takeover ? "on" : "off"}.`,
  );
  client = new LanguageClient("lumiose", "Lumiose Language Server", serverOptions, clientOptions);
  try {
    await client.start();
  } catch (error) {
    output?.error(`The language server failed to start: ${String(error)}`);
    void vscode.window.showErrorMessage(
      runtime.kind === "vscode"
        ? `Lumiose: the bundled language server failed to start (${entry.path}). See the "Lumiose Language Server" output.`
        : `Lumiose: the language server failed to start (${runtime.command} ${entry.path}). It needs Node.js ≥ 24; set "lumiose.server.runtime" to a newer node.`,
    );
  }
}

async function stop(): Promise<void> {
  const current = client;
  client = undefined;
  server = undefined;
  clientTakeover = undefined;
  if (current?.isRunning()) await current.stop();
}

async function restart(context: vscode.ExtensionContext): Promise<void> {
  await stop();
  await start(context);
}

function takeoverState(): TakeoverState {
  const setting = vscode.workspace
    .getConfiguration("lumiose")
    .get<TakeoverSetting>("takeover", "prompt");
  return {
    setting,
    typescriptExtensionActive: TYPESCRIPT_EXTENSIONS.some(
      (id) => vscode.extensions.getExtension(id) !== undefined,
    ),
    usesLumiose: (vscode.workspace.workspaceFolders ?? []).some(
      (folder) => folder.uri.scheme === "file" && usesLumiose(folder.uri.fsPath),
    ),
  };
}

/** Offers takeover mode, as Vue's extension does: the built-in TS extension must be disabled. */
async function promptTakeover(): Promise<void> {
  if (!shouldPromptTakeover(takeoverState())) return;
  const enable = "Enable Takeover Mode";
  const never = "Don't Ask Again";
  const choice = await vscode.window.showInformationMessage(
    "This workspace uses Lumiose. In takeover mode, one TypeScript 7 server (through the Lumiose language server) handles .ts, .tsx and .stsx files, so types and renames flow between them. It needs the built-in TypeScript extension disabled for this workspace.",
    enable,
    never,
  );
  if (choice === enable) await showTakeoverSteps();
  else if (choice === never) {
    // "auto" keeps takeover following the TypeScript extension's state, without prompting.
    await vscode.workspace
      .getConfiguration("lumiose")
      .update("takeover", "auto", vscode.ConfigurationTarget.Workspace);
  }
}

/** VS Code has no API to disable an extension: show it, with the steps. */
async function showTakeoverSteps(): Promise<void> {
  const active = TYPESCRIPT_EXTENSIONS.filter((id) => vscode.extensions.getExtension(id));
  if (active.length === 0) {
    void vscode.window.showInformationMessage(
      "Lumiose takeover mode is already active: no TypeScript extension is enabled in this workspace.",
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
    ? `Lumiose: the language server at "${configured}" (lumiose.server.path) does not exist.`
    : `Lumiose: ${SERVER_PACKAGE} was not found in this workspace, so .stsx files only get syntax highlighting. Install it as a dev dependency, or set "lumiose.server.path".`;
  const settings = "Open Settings";
  if ((await vscode.window.showWarningMessage(message, settings)) === settings) {
    await vscode.commands.executeCommand("workbench.action.openSettings", "lumiose.server");
  }
}
