// Smoke test in a real VS Code (not part of `pnpm test`; run through `pnpm test:vscode`, which
// packages the .vsix first): unpacks lumen-vscode.vsix, copies test/vscode/workspace to a temp dir
// (with `lumen` and `@lumen/language-server` linked into its node_modules), and runs
// test/vscode/suite.cjs in an isolated VS Code instance with the unpacked extension loaded in
// development mode and the built-in TypeScript extension disabled (takeover mode).
//
// VS Code: $VSCODE_EXECUTABLE, else the default macOS install. Node ≥ 24 must be on PATH (the
// language server runs from TypeScript sources). `--screenshot=<file.png>` also saves a capture of
// the VS Code window (over the Chrome DevTools protocol, so only that window) showing Card.stsx.

import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const packages = join(root, "..");
const executable =
  process.env["VSCODE_EXECUTABLE"] ?? "/Applications/Visual Studio Code.app/Contents/MacOS/Code";
if (!existsSync(executable)) {
  console.error(`VS Code was not found at ${executable}; set VSCODE_EXECUTABLE.`);
  process.exit(1);
}

const vsix = join(root, "lumen-vscode.vsix");
if (!existsSync(vsix)) {
  console.error(`${vsix} does not exist; run \`pnpm package\` first.`);
  process.exit(1);
}
const temp = await mkdtemp(join(tmpdir(), "lumen-vscode-"));
// A .vsix is a zip whose `extension/` folder is the installed extension.
execFileSync("unzip", ["-q", vsix, "extension/*", "-d", join(temp, "vsix")]);
const extension = join(temp, "vsix", "extension");
const workspace = join(temp, "workspace");
await cp(join(root, "test/vscode/workspace"), workspace, { recursive: true });
await mkdir(join(workspace, "node_modules/@lumen"), { recursive: true });
await symlink(join(packages, "lumen"), join(workspace, "node_modules/lumen"), "dir");
await symlink(
  join(packages, "language-server"),
  join(workspace, "node_modules/@lumen/language-server"),
  "dir",
);

const screenshot = process.argv
  .find((arg) => arg.startsWith("--screenshot="))
  ?.slice("--screenshot=".length);
const debugPort = 9339;
const env: NodeJS.ProcessEnv = { ...process.env };
delete env["ELECTRON_RUN_AS_NODE"];
let captured: Promise<void> = Promise.resolve();
if (screenshot) {
  const signal = join(temp, "screenshot-signal");
  env["LUMEN_SMOKE_SCREENSHOT_SIGNAL"] = signal;
  captured = captureWhenReady(signal, resolve(screenshot));
}
const code = await new Promise<number | null>((done) => {
  const child = spawn(
    executable,
    [
      workspace,
      `--extensionDevelopmentPath=${extension}`,
      `--extensionTestsPath=${join(root, "test/vscode/suite.cjs")}`,
      `--user-data-dir=${join(temp, "user-data")}`,
      `--extensions-dir=${join(temp, "extensions")}`,
      "--disable-extension=vscode.typescript-language-features",
      "--disable-workspace-trust",
      "--skip-welcome",
      "--skip-release-notes",
      "--disable-telemetry",
      "--disable-updates",
      "--new-window",
      ...(screenshot ? [`--remote-debugging-port=${debugPort}`] : []),
    ],
    { env, stdio: "inherit" },
  );
  child.on("exit", done);
});
await captured;
await rm(temp, { recursive: true, force: true });
process.exitCode = code ?? 1;
console.log(
  code === 0 ? "VS Code smoke test passed." : `VS Code smoke test failed (exit ${code}).`,
);

/** Waits for the suite's signal file, captures the workbench page, then releases the suite. */
async function captureWhenReady(signal: string, file: string): Promise<void> {
  const deadline = Date.now() + 180_000;
  while (!existsSync(signal)) {
    if (Date.now() > deadline) return;
    await new Promise((done) => setTimeout(done, 250));
  }
  try {
    const targets = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()) as {
      type: string;
      url: string;
      webSocketDebuggerUrl: string;
    }[];
    const page = targets.find(
      (target) => target.type === "page" && target.url.includes("workbench"),
    );
    if (!page) throw new Error("no workbench page target");
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((done, fail) => {
      socket.addEventListener("open", done, { once: true });
      socket.addEventListener("error", fail, { once: true });
    });
    const data = await new Promise<string>((done) => {
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data)) as {
          id?: number;
          result?: { data: string };
        };
        if (message.id === 1 && message.result) done(message.result.data);
      });
      socket.send(
        JSON.stringify({ id: 1, method: "Page.captureScreenshot", params: { format: "png" } }),
      );
    });
    socket.close();
    await writeFile(file, Buffer.from(data, "base64"));
    console.log(`Screenshot saved to ${file}`);
  } catch (error) {
    console.error(`Screenshot failed: ${String(error)}`);
  } finally {
    await writeFile(`${signal}.done`, "");
  }
}
