// Smoke test in a real VS Code (not part of `pnpm test`; run through `pnpm test:vscode`, which
// packages the .vsix for this platform first): unpacks lumiose-vscode-<target>.vsix, copies
// test/vscode/workspace to a temp dir with `lumiose` and `typescript` linked into its node_modules,
// and runs test/vscode/suite.cjs in an isolated VS Code instance with the unpacked extension loaded
// in development mode and the built-in TypeScript extension disabled (takeover mode). Two modes:
//
// - `workspace`: @lumiose/language-server is installed in the workspace too, so the extension runs
//   it from its TypeScript sources with `node` (Node ≥ 24 on PATH);
// - `bundled`: it is not, so the extension runs the server bundled in the .vsix (server/bin.mjs
//   and the native compiler) on VS Code's own Node.js (TASK-51).
//
// The suite asserts which server and runtime the extension picked. `--mode=workspace|bundled` runs
// one mode (default: both). VS Code: $VSCODE_EXECUTABLE, else the default macOS install.
// `--screenshot=<file.png>` also saves a capture of the VS Code window (over the Chrome DevTools
// protocol, so only that window) showing Card.stsx, in the first mode run;
// `--screenshot-view=completion` shows the class completion list in Nested.stsx instead.

import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hostTarget } from "./targets.ts";

type Mode = "workspace" | "bundled";

const root = fileURLToPath(new URL("../", import.meta.url));
const packages = join(root, "..");
const executable =
  process.env["VSCODE_EXECUTABLE"] ?? "/Applications/Visual Studio Code.app/Contents/MacOS/Code";
if (!existsSync(executable)) {
  console.error(`VS Code was not found at ${executable}; set VSCODE_EXECUTABLE.`);
  process.exit(1);
}

const vsix = join(root, `lumiose-vscode-${hostTarget()}.vsix`);
if (!existsSync(vsix)) {
  console.error(`${vsix} does not exist; run \`pnpm package\` first.`);
  process.exit(1);
}
const typescriptDir = dirname(
  createRequire(join(packages, "language-server/package.json")).resolve("typescript/package.json"),
);

const modeArg = process.argv.find((arg) => arg.startsWith("--mode="))?.slice("--mode=".length);
if (modeArg !== undefined && modeArg !== "workspace" && modeArg !== "bundled") {
  console.error("--mode must be workspace or bundled.");
  process.exit(1);
}
const modes: Mode[] = modeArg === undefined ? ["workspace", "bundled"] : [modeArg];
let screenshotFile = process.argv
  .find((arg) => arg.startsWith("--screenshot="))
  ?.slice("--screenshot=".length);
/** `hover` (default: a `$ref` hover in Card.stsx) or `completion` (scoped class completion). */
const screenshotView = process.argv
  .find((arg) => arg.startsWith("--screenshot-view="))
  ?.slice("--screenshot-view=".length);
const debugPort = 9339;

let failed = false;
for (const mode of modes) {
  const code = await runMode(mode, screenshotFile);
  screenshotFile = undefined;
  console.log(
    code === 0
      ? `VS Code smoke test passed (${mode} server).`
      : `VS Code smoke test failed (${mode} server, exit ${code}).`,
  );
  if (code !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;

async function runMode(mode: Mode, screenshot: string | undefined): Promise<number | null> {
  const temp = await mkdtemp(join(tmpdir(), `lumiose-vscode-${mode}-`));
  // A .vsix is a zip whose `extension/` folder is the installed extension.
  execFileSync("unzip", ["-q", vsix, "extension/*", "-d", join(temp, "vsix")]);
  const extension = join(temp, "vsix", "extension");
  const workspace = join(temp, "workspace");
  await cp(join(root, "test/vscode/workspace"), workspace, { recursive: true });
  await mkdir(join(workspace, "node_modules/@lumiose"), { recursive: true });
  await symlink(join(packages, "lumiose"), join(workspace, "node_modules/lumiose"), "dir");
  await symlink(typescriptDir, join(workspace, "node_modules/typescript"), "dir");
  if (mode === "workspace") {
    await symlink(
      join(packages, "language-server"),
      join(workspace, "node_modules/@lumiose/language-server"),
      "dir",
    );
  }

  const env: NodeJS.ProcessEnv = { ...process.env, LUMIOSE_SMOKE_EXPECT_SERVER: mode };
  delete env["ELECTRON_RUN_AS_NODE"];
  let captured: Promise<void> = Promise.resolve();
  if (screenshot) {
    const signal = join(temp, "screenshot-signal");
    env["LUMIOSE_SMOKE_SCREENSHOT_SIGNAL"] = signal;
    if (screenshotView) env["LUMIOSE_SMOKE_SCREENSHOT_VIEW"] = screenshotView;
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
  return code;
}

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
