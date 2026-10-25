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
  const extension = vscode.extensions.getExtension("itsjavi.lumiose-vscode");
  assert.ok(extension, "the extension is loaded");

  const card = vscode.Uri.file(path.join(folder.uri.fsPath, "src/components/Card.stsx"));
  const document = await vscode.workspace.openTextDocument(card);
  await vscode.window.showTextDocument(document);
  assert.equal(document.languageId, "stsx", ".stsx files get the stsx language");
  const api = await extension.activate();
  log("activated");

  // Which server the extension launched: the workspace's @lumiose/language-server (TS sources on
  // `node`), or the one bundled in the .vsix on VS Code's own Node.js (scripts/test-vscode.ts).
  const expected = process.env["LUMIOSE_SMOKE_EXPECT_SERVER"];
  const server = api.server();
  assert.ok(server, "a language server was started");
  if (expected) assert.equal(server.source, expected, `the ${expected} server is used`);
  if (server.source === "bundled") {
    assert.match(server.path, /[\\/]server[\\/]bin\.mjs$/);
    assert.match(server.runtime, /^VS Code's Node\.js/);
  }
  log(`server: ${server.source} (${server.path}) on ${server.runtime}`);

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

  // LSP client → the Lumiose language server → TypeScript 7 (the workspace's typescript).
  const text = document.getText();
  const refHover = await hoverText(card, document.positionAt(text.indexOf("$gap") + 2));
  assert.match(refHover, /\b8\b/, "hover on a $ref shows its folded value");
  const tsHover = await hoverText(card, document.positionAt(text.indexOf("Card(") + 1));
  assert.match(tsHover, /function Card/);
  log("hovers in .stsx: ok");

  // Takeover mode: the Lumiose server also serves .tsx (the built-in TS extension is disabled).
  const main = vscode.Uri.file(path.join(folder.uri.fsPath, "src/main.tsx"));
  const mainDocument = await vscode.workspace.openTextDocument(main);
  const mainHover = await hoverText(
    main,
    mainDocument.positionAt(mainDocument.getText().indexOf("<Card") + 2),
  );
  assert.match(mainHover, /function Card/);
  log("takeover hover in .tsx: ok");

  // Completion (TASK-80): classes scoped to the enclosing subtree (decision-23) plus the project's
  // global classes (imported .css), custom properties with their values, `global` as the only
  // `<style>` attribute, and snippets from the server only where they fit.
  const nested = vscode.Uri.file(path.join(folder.uri.fsPath, "src/components/Nested.stsx"));
  const nestedDocument = await vscode.workspace.openTextDocument(nested);
  await vscode.window.showTextDocument(nestedDocument);
  const nestedText = nestedDocument.getText();
  const at = (needle, shift) => nestedDocument.positionAt(nestedText.indexOf(needle) + shift);
  const lead = await completionLabels(nested, at('class="lead"', 7), "panel-frame");
  assert.ok(lead.includes("app-button"), "global .css classes are offered");
  assert.ok(!lead.includes("details-grid"), "a sibling subtree's classes are not offered");
  const note = await completionLabels(nested, at('class="note"', 7), "note-text");
  for (const name of ["note-text", "details-grid", "panel-frame", "app-button"]) {
    assert.ok(note.includes(name), `${name} is offered inside the nested subtree`);
  }
  const properties = await completionItems(nested, at("var(--space)", 4), "--brand");
  const brand = properties.find((item) => labelOf(item) === "--brand");
  assert.equal(brand.detail, "#3b82f6", "custom properties show their declared value");
  log("scoped classes, global CSS classes and custom properties: ok");

  // A scratch file on disk (the server serves `file:` documents).
  const scratchUri = vscode.Uri.file(path.join(folder.uri.fsPath, "src/components/Scratch.stsx"));
  await vscode.workspace.fs.writeFile(
    scratchUri,
    Buffer.from("export const x = 1;\n\n<style >\n  .a { color: red; }\n</style>\nco\n"),
  );
  const scratch = await vscode.workspace.openTextDocument(scratchUri);
  await vscode.window.showTextDocument(scratch);
  const scratchText = scratch.getText();
  const styleTag = await completionLabels(
    scratchUri,
    scratch.positionAt(scratchText.indexOf("<style >") + 7),
    "global",
  );
  assert.deepEqual(styleTag, ["global"], "inside <style …> the only completion is global");
  const statement = await completionLabels(
    scratchUri,
    scratch.positionAt(scratchText.lastIndexOf("co") + 2),
    "comp",
  );
  for (const name of ["comp", "acomp", "route"]) assert.ok(statement.includes(name));
  log("<style> attribute and snippet completion: ok");

  await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  await vscode.workspace.fs.delete(scratchUri);

  // Auto-closing of <style> (the language configuration), in an untitled document.
  const untitled = await vscode.workspace.openTextDocument({ language: "stsx", content: "" });
  await vscode.window.showTextDocument(untitled);
  // Let the editor take focus (and the previous editor's suggest widget close) before typing.
  await new Promise((resolve) => setTimeout(resolve, 500));
  for (const char of "<style>") await vscode.commands.executeCommand("type", { text: char });
  assert.equal(
    untitled.getText(),
    "<style></style>",
    `typing <style> auto-closes it (got ${JSON.stringify(untitled.getText())})`,
  );
  log("auto-closing: ok");
  await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");

  const signal = process.env["LUMIOSE_SMOKE_SCREENSHOT_SIGNAL"];
  if (signal) {
    const completion = process.env["LUMIOSE_SMOKE_SCREENSHOT_VIEW"] === "completion";
    await pauseForScreenshot(signal, completion ? nested : card, completion);
  }
}

/**
 * Shows Card.stsx with the $ref hover open, or (`completion`) the class completion list in
 * Nested.stsx's innermost subtree, then waits while the runner captures the window.
 */
async function pauseForScreenshot(signal, uri, completion) {
  const fs = require("node:fs");
  await vscode.commands.executeCommand("workbench.action.closeSidebar");
  await vscode.commands.executeCommand("workbench.action.closePanel");
  await vscode.commands.executeCommand("workbench.action.closeAuxiliaryBar");
  const document = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(document);
  const text = document.getText();
  const position = document.positionAt(
    completion ? text.indexOf('class="note"') + 7 : text.indexOf("$gap") + 2,
  );
  editor.selection = new vscode.Selection(position, position);
  if (completion) {
    await vscode.commands.executeCommand("editor.action.triggerSuggest");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    // Expand the details of the focused item.
    await vscode.commands.executeCommand("toggleSuggestionDetails");
  } else {
    await vscode.commands.executeCommand("editor.action.showHover");
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));
  fs.writeFileSync(signal, "ready");
  const deadline = Date.now() + 30_000;
  while (!fs.existsSync(`${signal}.done`) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

function labelOf(item) {
  return typeof item.label === "string" ? item.label : item.label.label;
}

/** Completion items at a position, retried until one is labeled `expected`. */
async function completionItems(uri, position, expected) {
  const deadline = Date.now() + TIMEOUT;
  for (;;) {
    const list = await vscode.commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      uri,
      position,
    );
    const items = list?.items ?? [];
    if (items.some((item) => labelOf(item) === expected)) return items;
    if (Date.now() > deadline) {
      throw new Error(
        `no ${expected} completion at ${uri.fsPath}:${position.line + 1}: ${items.map(labelOf).join(", ")}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function completionLabels(uri, position, expected) {
  return (await completionItems(uri, position, expected)).map(labelOf);
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
  console.log(`[lumiose-vscode smoke] ${message}`);
}

module.exports = { run };
