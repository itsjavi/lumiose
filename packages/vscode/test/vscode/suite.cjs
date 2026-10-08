// Runs inside a real VS Code extension host (`--extensionTestsPath`, started by
// scripts/test-vscode.ts) on a temp copy of test/vscode/workspace, with the built-in TypeScript
// extension disabled (takeover mode). Throwing fails the run.
const assert = require("node:assert/strict");
const path = require("node:path");
const vscode = require("vscode");

const TIMEOUT = 60_000;

async function run() {
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, "a workspace folder is open");
  const extension = vscode.extensions.getExtension("lumen.lumen-vscode");
  assert.ok(extension, "the extension is loaded");

  const card = vscode.Uri.file(path.join(folder.uri.fsPath, "src/components/Card.stsx"));
  const document = await vscode.workspace.openTextDocument(card);
  await vscode.window.showTextDocument(document);
  assert.equal(document.languageId, "stsx", ".stsx files get the stsx language");
  await extension.activate();
  log("activated");

  // Grammar, as VS Code tokenizes it (the internal command behind VS Code's colorize tests).
  const tokens = await vscode.commands.executeCommand("_workbench.captureSyntaxTokens", card);
  const scopesOf = (text, after = 0) => tokens.slice(after).find((token) => token.c === text)?.t;
  const style = tokens.findIndex((token) => token.c === "style");
  assert.match(scopesOf("style"), /entity\.name\.tag\.style\.stsx/);
  assert.match(scopesOf("card", style), /source\.css .*entity\.other\.attribute-name\.class\.css/);
  assert.match(scopesOf("gap", style), /source\.css .*variable\.other\.constant\.ref\.stsx/);
  assert.match(scopesOf("primary", style), /variable\.other\.property\.ref\.stsx/);
  assert.match(scopesOf("Card"), /entity\.name\.function\.tsx/);
  log(`grammar: ${tokens.length} tokens`);

  // LSP client → @lumen/language-server (resolved from the workspace) → TypeScript 7.
  const text = document.getText();
  const refHover = await hoverText(card, document.positionAt(text.indexOf("$gap") + 2));
  assert.match(refHover, /\b8\b/, "hover on a $ref shows its folded value");
  const tsHover = await hoverText(card, document.positionAt(text.indexOf("Card(") + 1));
  assert.match(tsHover, /function Card/);
  log("hovers in .stsx: ok");

  // Takeover mode: the Lumen server also serves .tsx (the built-in TS extension is disabled).
  const main = vscode.Uri.file(path.join(folder.uri.fsPath, "src/main.tsx"));
  const mainDocument = await vscode.workspace.openTextDocument(main);
  const mainHover = await hoverText(
    main,
    mainDocument.positionAt(mainDocument.getText().indexOf("<Card") + 2),
  );
  assert.match(mainHover, /function Card/);
  log("takeover hover in .tsx: ok");

  // Snippets and auto-closing of <style>.
  const scratch = await vscode.workspace.openTextDocument({ language: "stsx", content: "" });
  const editor = await vscode.window.showTextDocument(scratch);
  await vscode.commands.executeCommand("editor.action.insertSnippet", {
    langId: "stsx",
    name: "Component",
  });
  assert.match(
    scratch.getText(),
    /export function \w*\(props: \{[^}]*\}\) \{[\s\S]*<style>[\s\S]*<\/style>/,
  );
  await editor.edit((edit) => edit.delete(new vscode.Range(0, 0, scratch.lineCount, 0)));
  for (const char of "<style>") await vscode.commands.executeCommand("type", { text: char });
  assert.equal(scratch.getText(), "<style></style>", "typing <style> auto-closes it");
  log("snippet + auto-closing: ok");
  await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");

  const signal = process.env["LUMEN_SMOKE_SCREENSHOT_SIGNAL"];
  if (signal) await pauseForScreenshot(card, signal);
}

/** Shows Card.stsx with the $ref hover open, then waits while the runner captures the window. */
async function pauseForScreenshot(uri, signal) {
  const fs = require("node:fs");
  await vscode.commands.executeCommand("workbench.action.closeSidebar");
  await vscode.commands.executeCommand("workbench.action.closePanel");
  await vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document);
  const position = document.positionAt(document.getText().indexOf("$gap") + 2);
  editor.selection = new vscode.Selection(position, position);
  await vscode.commands.executeCommand("editor.action.showHover");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  fs.writeFileSync(signal, "ready");
  const deadline = Date.now() + 30_000;
  while (!fs.existsSync(`${signal}.done`) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/** Hover contents at a position, retried while the server warms up. */
async function hoverText(uri, position) {
  const deadline = Date.now() + TIMEOUT;
  for (;;) {
    const hovers = await vscode.commands.executeCommand(
      "vscode.executeHoverProvider",
      uri,
      position,
    );
    const text = (hovers ?? [])
      .flatMap((hover) => hover.contents)
      .map((content) => (typeof content === "string" ? content : content.value))
      .join("\n");
    if (text.trim() !== "") return text;
    if (Date.now() > deadline) throw new Error(`no hover at ${uri.fsPath}:${position.line + 1}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

function log(message) {
  console.log(`[lumen-vscode smoke] ${message}`);
}

module.exports = { run };
