// create-lumiose (TASK-33): the CLI contract, then every template scaffolded by the bin into a temp
// dir (node_modules linked to the workspace's lumiose, adapter, TypeScript and Vite), checked with
// `lumiose check`, built with `lumiose build` and served by `lumiose dev`.
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { main, type CreateIO } from "./main.ts";
import { isValidPackageName, packageName, TEMPLATES } from "./scaffold.ts";

const here = dirname(fileURLToPath(import.meta.url));
const createBin = join(here, "bin.ts");
const packagesDir = join(here, "../..");
const lumioseBin = join(packagesDir, "lumiose/src/cli/bin.ts");
// The compiler binding is lumiose's dependency; templates are only built when it is available.
const binding = await import(
  createRequire(join(packagesDir, "lumiose/package.json")).resolve("@lumiose/compiler")
).catch(() => undefined);
const tmp = realpathSync(mkdtempSync(join(tmpdir(), "create-lumiose-")));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function io(cwd = tmp) {
  const out = { stdout: "", stderr: "" };
  const value: CreateIO = {
    cwd,
    write: (text) => void (out.stdout += text),
    writeError: (text) => void (out.stderr += text),
  };
  return { io: value, out };
}

function run(bin: string, args: string[], cwd: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [bin, ...args], { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

/** Links what `pnpm install` would provide. */
function link(root: string) {
  mkdirSync(join(root, "node_modules/@lumiose"), { recursive: true });
  symlinkSync(join(packagesDir, "lumiose"), join(root, "node_modules/lumiose"), "dir");
  symlinkSync(
    join(packagesDir, "adapter-node"),
    join(root, "node_modules/@lumiose/adapter-node"),
    "dir",
  );
  for (const name of ["typescript", "vite"]) {
    symlinkSync(
      realpathSync(join(here, "../node_modules", name)),
      join(root, "node_modules", name),
      "dir",
    );
  }
}

describe("create-lumiose CLI", () => {
  it("prints help and rejects misuse with exit code 2", async () => {
    const help = io();
    expect(await main(["--help"], help.io)).toBe(0);
    for (const template of TEMPLATES) expect(help.out.stdout).toContain(`  ${template.name} `);

    const unknown = io();
    expect(await main(["app", "--template", "vue", "--format", "json"], unknown.io)).toBe(2);
    expect(JSON.parse(unknown.out.stdout)).toMatchObject({ command: "create", ok: false });
    expect(await main(["a", "b"], io().io)).toBe(2);
    expect(await main(["--nope"], io().io)).toBe(2);
  });

  it("refuses a non-empty directory (exit 1) unless --force", async () => {
    const dir = join(tmp, "taken");
    mkdirSync(dir);
    writeFileSync(join(dir, "notes.txt"), "keep me");
    const refused = io();
    expect(await main([dir, "-t", "minimal", "-y"], refused.io)).toBe(1);
    expect(refused.out.stderr).toContain("is not empty");
    expect(await main([dir, "-t", "minimal", "-y", "--force"], io().io)).toBe(0);
    expect(readFileSync(join(dir, "notes.txt"), "utf8")).toBe("keep me");
    expect(existsSync(join(dir, "src/routes/index.stsx"))).toBe(true);
  });

  it("asks for the directory and template in a terminal", async () => {
    const answers = ["asked-app", "3"];
    const asked = io();
    asked.io.ask = async () => answers.shift()!;
    asked.io.userAgent = "npm/11.0.0 node/v24.0.0";
    expect(await main([], asked.io)).toBe(0);
    expect(asked.out.stdout).toContain("(template: ssr, mode: server)");
    expect(asked.out.stdout).toContain("  cd asked-app\n  npm install\n  npm run dev\n");
  });

  it("registers the MCP server for Claude Code and Codex with --mcp (TASK-131)", async () => {
    const dir = join(tmp, "with-mcp");
    const created = io();
    created.io.userAgent = "npm/11.0.0 node/v24.0.0";
    expect(await main([dir, "-t", "minimal", "-y", "--mcp", "--format", "json"], created.io)).toBe(
      0,
    );
    expect(JSON.parse(readFileSync(join(dir, ".mcp.json"), "utf8"))).toEqual({
      mcpServers: { lumiose: { command: "npx", args: ["lumiose", "mcp"] } },
    });
    expect(readFileSync(join(dir, ".codex/config.toml"), "utf8")).toBe(
      '[mcp_servers.lumiose]\ncommand = "npx"\nargs = ["lumiose", "mcp"]\n',
    );
    const report = JSON.parse(created.out.stdout);
    expect(report.files).toEqual(expect.arrayContaining([".mcp.json", ".codex/config.toml"]));
    expect(report.mcp).toMatchObject({ command: "npx", args: ["lumiose", "mcp"] });
    expect(report.mcp.note).toContain("codex mcp add lumiose -- npx lumiose mcp");

    // Without --mcp nothing is registered; pnpm runs the project's binary with `pnpm exec`.
    const plain = join(tmp, "without-mcp");
    expect(await main([plain, "-t", "minimal", "-y"], io().io)).toBe(0);
    expect(existsSync(join(plain, ".mcp.json"))).toBe(false);
    const pnpm = join(tmp, "pnpm-mcp");
    expect(await main([pnpm, "-t", "minimal", "-y", "--mcp"], io().io)).toBe(0);
    expect(readFileSync(join(pnpm, ".codex/config.toml"), "utf8")).toContain(
      'command = "pnpm"\nargs = ["exec", "lumiose", "mcp"]',
    );
  });

  it("derives valid package names", () => {
    expect(packageName("My App!")).toBe("my-app");
    expect(packageName("...")).toBe("lumiose-app");
    expect(isValidPackageName("@scope/app")).toBe(true);
    expect(isValidPackageName("Bad Name")).toBe(false);
  });
});

describe.skipIf(!binding).each(TEMPLATES)("template $name", (template) => {
  const root = join(tmp, `app-${template.name}`);

  it("scaffolds an agent-ready project with its mode in vite.config.ts", async () => {
    const created = await run(
      createBin,
      [root, "--template", template.name, "--format", "json"],
      tmp,
    );
    expect(created.code, created.stderr).toBe(0);
    const result = JSON.parse(created.stdout);
    expect(result).toMatchObject({
      command: "create",
      ok: true,
      name: `app-${template.name}`,
      template: template.name,
      mode: template.mode,
    });
    expect(result.files).toEqual(
      expect.arrayContaining([
        "package.json",
        "tsconfig.json",
        "vite.config.ts",
        ".gitignore",
        ".gitattributes",
        "AGENTS.md",
        "CLAUDE.md",
        ".claude/skills/lumiose/SKILL.md",
      ]),
    );
    const read = (file: string) => readFileSync(join(root, file), "utf8");
    expect(read("vite.config.ts")).toContain(`lumiose({ mode: "${template.mode}" })`);
    expect(read("tsconfig.json")).toContain('"extends": "./.lumiose/tsconfig.generated.json"');
    expect(read(".gitattributes")).toBe("*.stsx linguist-language=TSX\n");
    expect(read("AGENTS.md")).toContain("node_modules/lumiose/docs");
    expect(read("CLAUDE.md")).toContain("@AGENTS.md");
    expect(read(".claude/skills/lumiose/SKILL.md")).toMatch(/^---\nname: lumiose\n/);
    expect(read("src/routes/index.stsx")).not.toContain("{{name}}");
    link(root);
  });

  it("passes lumiose check and builds", async () => {
    const check = await run(lumioseBin, ["check", "--format", "json"], root);
    expect(JSON.parse(check.stdout), check.stderr).toMatchObject({ command: "check", ok: true });
    const fmt = await run(lumioseBin, ["fmt", "--check"], root);
    expect(fmt.code, fmt.stdout).toBe(0);
    const build = await run(lumioseBin, ["build", "--format", "json"], root);
    expect(build.code, build.stderr).toBe(0);
    // Static pages are prerendered; server and spa routes render per request (spa shells: TASK-25).
    const { prerendered } = JSON.parse(build.stdout);
    if (template.mode === "static") expect(prerendered.length).toBeGreaterThan(0);
  });

  it("routes use the template's default mode", async () => {
    const routes = await run(lumioseBin, ["routes", "--format", "json"], root);
    expect(JSON.parse(routes.stdout)).toMatchObject({ ok: true, defaultMode: template.mode });
  });

  it("serves its home page with lumiose dev", async () => {
    const child = spawn(process.execPath, [lumioseBin, "dev", "--format", "json", "--port", "0"], {
      cwd: root,
    });
    try {
      const line = await new Promise<string>((resolve, reject) => {
        let stdout = "";
        child.stdout.on("data", (chunk) => {
          stdout += chunk;
          if (stdout.includes("\n")) resolve(stdout.slice(0, stdout.indexOf("\n")));
        });
        child.on("close", (code) => reject(new Error(`lumiose dev exited with ${code}`)));
      });
      const { url } = JSON.parse(line) as { url: string };
      const home = await fetch(url);
      expect(home.status).toBe(200);
      expect(await home.text()).toContain("<title>");
      if (template.name === "ssr") {
        const posted = await fetch(new URL("/guestbook?/sign", url), {
          method: "POST",
          headers: { origin: new URL(url).origin },
          body: new URLSearchParams({ name: "Ada", message: "Hello" }),
          redirect: "manual",
        });
        expect(posted.status).toBe(303);
        expect(await (await fetch(new URL("/api/entries", url))).json()).toMatchObject([
          { name: "Ada", message: "Hello" },
        ]);
      }
    } finally {
      child.kill("SIGTERM");
    }
  });
});
