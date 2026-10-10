// `lumiose` CLI smoke tests (TASK-28): every command runs as a subprocess of the bin on a fixture app
// (written to a temp dir whose node_modules link lumiose, TypeScript and @lumiose/adapter-node), with
// its help, `--format json` envelope and exit code.
import { linkLumiose } from "@lumiose/vite/internal/test-links.ts";
import { spawn, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tsconfigTemplate } from "./check/tsconfig.ts";
import { suggest } from "./main.ts";

const here = dirname(fileURLToPath(import.meta.url));
const packageDir = join(here, "..");
const bin = join(packageDir, "src/bin.ts");
const binding = await import("@lumiose/compiler").catch(() => undefined);

const FILES: Record<string, string> = {
  "package.json": JSON.stringify({ name: "cli-fixture", private: true, type: "module" }),
  "tsconfig.json": JSON.stringify(tsconfigTemplate(), null, 2),
  // The project default is `server`, so the endpoint may take POST (static endpoints may not).
  "vite.config.ts": `import lumiose from "@lumiose/vite";
export default { plugins: [lumiose({ mode: "server" })] };
`,
  "src/components/Card.stsx": `export function Card(props: { title: string }) {
  return (
    <section class="card">
      <h2>{props.title}</h2>
      <style>
        .card {
          padding: 1rem;
        }
      </style>
    </section>
  );
}
`,
  "src/routes/_layout.stsx": `export default function Layout(props: { children?: JSX.Element }) {
  return <div class="layout">{props.children}</div>;
}
`,
  "src/routes/index.stsx": `import { Card } from "../components/Card.stsx";
export const mode = "static";
export default function Home() {
  return <main><Card title="Home" /></main>;
}
`,
  "src/routes/about.stsx": `export default function About() {
  return <main><h1>About</h1></main>;
}
`,
  "src/routes/api/hello.ts": `export const GET = () => Response.json({ hello: "world" });
export const POST = () => new Response(null, { status: 204 });
`,
};

let root: string;
beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), "lumiose-cli-")));
  for (const [name, text] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  const require = createRequire(import.meta.url);
  mkdirSync(join(root, "node_modules/@lumiose"), { recursive: true });
  linkLumiose(root);
  symlinkSync(
    dirname(require.resolve("typescript/package.json")),
    join(root, "node_modules/typescript"),
    "dir",
  );
  symlinkSync(
    join(packageDir, "../adapter-node"),
    join(root, "node_modules/@lumiose/adapter-node"),
    "dir",
  );
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

interface Run {
  code: number | null;
  stdout: string;
  stderr: string;
}

function start(args: string[], cwd = root): ChildProcess {
  return spawn(process.execPath, [bin, ...args], {
    cwd,
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: undefined },
  });
}

function run(...args: string[]): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = start(args);
    let stdout = "";
    let stderr = "";
    child.stdout!.on("data", (chunk) => (stdout += chunk));
    child.stderr!.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function runJson(...args: string[]) {
  const result = await run(...args, "--format", "json");
  return { ...result, json: JSON.parse(result.stdout) as Record<string, any> };
}

/** Starts a server command with `--format json --port 0`, reads its JSON line, then stops it. */
async function serve(command: string, use: (url: string) => Promise<void>) {
  const child = start([command, "--format", "json", "--port", "0"]);
  let stderr = "";
  child.stderr!.on("data", (chunk) => (stderr += chunk));
  const closed = new Promise<number | null>((resolve) => child.on("close", resolve));
  try {
    const line = await new Promise<string>((resolve, reject) => {
      let stdout = "";
      child.stdout!.on("data", (chunk) => {
        stdout += chunk;
        if (stdout.includes("\n")) resolve(stdout.slice(0, stdout.indexOf("\n")));
      });
      child.on("close", (code) => reject(new Error(`${command} exited (${code}): ${stderr}`)));
    });
    const envelope = JSON.parse(line) as { command: string; ok: boolean; url: string };
    expect(envelope).toMatchObject({ command, ok: true });
    await use(envelope.url);
  } finally {
    child.kill("SIGTERM");
  }
  // Vite's dev server exits with 128 + 15 on SIGTERM; on Windows the process is terminated
  // without an exit code (null).
  expect(process.platform === "win32" ? [0, 143, null] : [0, 143]).toContain(await closed);
}

describe("lumiose CLI", () => {
  it("prints help, per-command help, JSON help and the version", async () => {
    const help = await run("--help");
    expect(help.code).toBe(0);
    for (const command of [
      "dev",
      "build",
      "preview",
      "check",
      "typegen",
      "routes",
      "lint",
      "fmt",
      "docs",
      "explain",
    ]) {
      expect(help.stdout).toMatch(new RegExp(`^  ${command}\\b`, "m"));
    }
    const routes = await run("routes", "--help");
    expect(routes.stdout).toMatch(/^Usage: lumiose routes \[options\]/);
    expect(routes.stdout).toContain("Exit codes:");
    expect((await run("help", "fmt")).stdout).toContain("--check");

    const json = await runJson("help");
    expect(json.json.commands.map((command: { name: string }) => command.name)).toContain(
      "typegen",
    );
    expect((await runJson("help", "check")).json).toMatchObject({
      command: "help",
      ok: true,
      name: "check",
      usage: "lumiose check [options]",
    });
    expect((await runJson("--version")).json).toMatchObject({ command: "version", ok: true });
    expect((await run("-v")).stdout).toMatch(/^lumiose \d+\.\d+\.\d+/);
  });

  it("suggests commands for typos and reports misuse with exit code 2", async () => {
    const typo = await run("chek");
    expect(typo.code).toBe(2);
    expect(typo.stderr).toContain('Unknown command "chek".\nDid you mean "lumiose check"?');
    const json = await runJson("rotues");
    expect(json.code).toBe(2);
    expect(json.json).toMatchObject({ command: "rotues", ok: false, suggestions: ["routes"] });

    const misuse = await runJson("check", "--port", "3000");
    expect(misuse.code).toBe(2);
    expect(misuse.json.failure.message).toBe(
      "--port does not apply to check (only to dev, preview).",
    );
    expect((await run("routes", "extra")).code).toBe(2);
    expect((await run("check", "--format", "xml")).code).toBe(2);
    expect((await run("check", "--nope")).code).toBe(2);
    expect((await run("dev", "--port", "http")).code).toBe(2);
  });

  it("does not exit 2 for unknown commands that are not close to any", () => {
    expect(suggest("zzz", ["check", "routes"])).toEqual([]);
    expect(suggest("biuld", ["build", "check"])).toEqual(["build"]);
    expect(suggest("type", ["typegen", "build"])).toEqual(["typegen"]);
  });

  it("lumiose routes prints the table and JSON with modes from lumiose({ mode })", async () => {
    const table = await run("routes");
    expect(table.code).toBe(0);
    expect(table.stdout).toContain(
      "Routes in src/routes (default mode: server): 2 pages, 1 endpoint",
    );
    expect(table.stdout).toMatch(/^\/\s+page\s+static\s+index\.stsx\s+_layout\.stsx$/m);
    expect(table.stdout).toMatch(/^\/about\s+page\s+server\s+about\.stsx\s+_layout\.stsx$/m);
    expect(table.stdout).toMatch(/^\/api\/hello\s+endpoint\s+server\s+api\/hello\.ts$/m);

    const { code, json } = await runJson("routes", "--root", root);
    expect(code).toBe(0);
    expect(json).toMatchObject({
      command: "routes",
      ok: true,
      defaultMode: "server",
      diagnostics: [],
    });
    expect(json.routes).toContainEqual({
      pattern: "/",
      file: "src/routes/index.stsx",
      kind: "page",
      mode: "static",
      ssr: true,
      layouts: ["src/routes/_layout.stsx"],
      params: [],
    });
  });

  it("lumiose typegen writes the route types and the shadows", async () => {
    const { code, json } = await runJson("typegen", "--cwd", root);
    expect(code).toBe(0);
    expect(json).toMatchObject({
      command: "typegen",
      ok: true,
      routeTypes: { file: ".lumiose/types/routes.d.ts" },
      routes: 3,
      shadows: { dir: ".lumiose/shadow", files: 4 },
    });
    expect(existsSync(join(root, ".lumiose/types/routes.d.ts"))).toBe(true);
    expect(existsSync(join(root, ".lumiose/shadow/src/components/Card.stsx.tsx"))).toBe(true);
    expect((await run("typegen")).stdout).toMatch(
      /^Up to date: \.lumiose\/types\/routes\.d\.ts \(3 routes\)\./,
    );
  });

  it.skipIf(!binding)(
    "lumiose check, lint and fmt report in the envelope",
    async () => {
      const check = await runJson("check");
      expect(check.code, check.stderr).toBe(0);
      expect(check.json).toMatchObject({ command: "check", ok: true, diagnostics: [] });

      const lint = await runJson("lint");
      expect(lint.json).toMatchObject({ command: "lint", ok: lint.code === 0 });

      const fmt = await runJson("fmt", "--check", "src/components");
      expect(fmt.json).toMatchObject({
        command: "fmt",
        ok: fmt.code === 0,
        check: true,
        summary: { files: 1, errors: 0 },
      });
      // Three CLI runs, one of them a full TypeScript check: seconds on a CI runner.
    },
    60_000,
  );

  it("lumiose docs and explain answer in the envelope", async () => {
    expect((await runJson("docs", "signals")).json).toMatchObject({
      command: "docs",
      ok: true,
      topic: "concepts/signals",
    });
    const missing = await runJson("docs", "zzqqxx");
    expect(missing.code).toBe(1);
    expect(missing.json).toMatchObject({ command: "docs", ok: false, results: [] });
    expect((await runJson("explain", "LUM1006")).json).toMatchObject({
      command: "explain",
      ok: true,
      code: "LUM1006",
    });
  });

  it.skipIf(!binding)(
    "lumiose build, preview and dev run with JSON on stdout",
    { timeout: 60_000 },
    async () => {
      const build = await runJson("build");
      expect(build.code, build.stderr).toBe(0);
      expect(build.json).toMatchObject({ command: "build", ok: true, clientDir: "dist/client" });
      expect(build.json.prerendered).toContainEqual(
        expect.objectContaining({ path: "/", file: "index.html", kind: "page" }),
      );

      await serve("preview", async (url) => {
        expect(await (await fetch(new URL("/about", url))).text()).toContain("<h1>About</h1>");
        expect(await (await fetch(new URL("/api/hello", url))).json()).toEqual({ hello: "world" });
      });
      await serve("dev", async (url) => {
        const home = await fetch(url);
        expect(home.status).toBe(200);
        expect(await home.text()).toMatch(/<h2[^>]*>Home<\/h2>/);
      });
    },
  );
});
