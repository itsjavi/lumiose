// `lumiose agents init` and the agent files shared with create-lumiose (TASK-33).
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { main } from "../main.ts";
import {
  AGENTS_END,
  AGENTS_START,
  agentsSection,
  CODEX_CONFIG,
  detectPackageManager,
  MCP_JSON,
  GITATTRIBUTES_LINE,
  planAgentFiles,
  SKILL_FILE,
  UI_SKILL_FILE,
} from "./index.ts";

const roots: string[] = [];
afterAll(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

async function agentsInit(root: string) {
  let stdout = "";
  const code = await main(["agents", "init", "--format", "json"], {
    cwd: root,
    color: false,
    write: (text) => void (stdout += text),
    writeError: () => {},
  });
  return {
    code,
    json: JSON.parse(stdout) as { ok: boolean; files: { file: string; action: string }[] },
  };
}

describe("agent files", () => {
  it("creates every file in an empty project", () => {
    const files = planAgentFiles(() => undefined, { name: "shop" });
    expect(files.map(({ file, action }) => [file, action])).toEqual([
      ["AGENTS.md", "created"],
      ["CLAUDE.md", "created"],
      [SKILL_FILE, "created"],
      [".gitattributes", "created"],
      ["tsconfig.json", "created"],
    ]);
    const agents = files[0]!.content;
    expect(agents).toMatch(/^# shop\n/);
    expect(agents).toContain(AGENTS_START);
    expect(agents).toContain("node_modules/lumiose/docs");
    expect(agents).toContain("npx lumiose check");
    expect(files[1]!.content).toBe("Follow the instructions in @AGENTS.md\n");
    expect(files[3]!.content).toBe(`${GITATTRIBUTES_LINE}\n`);
    expect(files[4]!.content).toContain('"extends": "./.lumiose/tsconfig.generated.json"');
  });

  it("adds Lumiose's parts to existing files and replaces only its own section", () => {
    const existing: Record<string, string> = {
      "AGENTS.md": `# Shop\n\nOur rules.\n\n${AGENTS_START}\nold Lumiose text\n${AGENTS_END}\n\nMore rules.\n`,
      "CLAUDE.md": "Be brief.\n",
      ".gitattributes": "*.png binary",
      "tsconfig.json": "{}",
    };
    const files = planAgentFiles((file) => existing[file], { name: "shop" });
    const content = Object.fromEntries(files.map((file) => [file.file, file.content]));
    expect(content["AGENTS.md"]).toBe(
      `# Shop\n\nOur rules.\n\n${agentsSection().trimEnd()}\n\nMore rules.\n`,
    );
    expect(content["CLAUDE.md"]).toBe("Be brief.\n\nFollow the instructions in @AGENTS.md\n");
    expect(content[".gitattributes"]).toBe(`*.png binary\n${GITATTRIBUTES_LINE}\n`);
    // An existing tsconfig is left alone.
    expect(content["tsconfig.json"]).toBeUndefined();

    const appended = planAgentFiles((file) => (file === "AGENTS.md" ? "# Mine\n" : undefined), {
      name: "x",
    });
    expect(appended[0]!.content).toBe(`# Mine\n\n${agentsSection()}`);
  });

  it("lumiose agents init writes once, then reports everything unchanged", async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "lumiose-agents-")));
    roots.push(root);
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "CLAUDE.md"), "See @AGENTS.md for the rules.\n");
    const first = await agentsInit(root);
    expect(first.code).toBe(0);
    expect(first.json.files).toEqual([
      { file: "AGENTS.md", action: "created" },
      { file: "CLAUDE.md", action: "unchanged" },
      { file: SKILL_FILE, action: "created" },
      { file: ".gitattributes", action: "created" },
      { file: "tsconfig.json", action: "created" },
    ]);
    expect(readFileSync(join(root, SKILL_FILE), "utf8")).toMatch(
      /^---\nname: lumiose\ndescription: /,
    );
    const second = await agentsInit(root);
    expect(second.json.files.every((file) => file.action === "unchanged")).toBe(true);

    let stderr = "";
    const misuse = await main(["agents", "setup"], {
      cwd: root,
      color: false,
      write: () => {},
      writeError: (text) => void (stderr += text),
    });
    expect(misuse).toBe(2);
    expect(stderr).toContain('Unknown agents subcommand "setup".');
  });

  it("registers lumiose mcp with --mcp, keeping other servers and settings (TASK-131)", async () => {
    const existing: Record<string, string> = {
      [MCP_JSON]: JSON.stringify({ mcpServers: { db: { command: "db-mcp" } }, other: 1 }),
      [CODEX_CONFIG]: [
        'model = "o4"',
        "",
        "[mcp_servers.lumiose]",
        'command = "old"',
        "",
        "[mcp_servers.lumiose.env]",
        'A = "1"',
        "",
        "[mcp_servers.db]",
        'command = "db-mcp"',
        "",
      ].join("\n"),
    };
    const files = planAgentFiles((file) => existing[file], { name: "shop", mcp: "pnpm" });
    const content = Object.fromEntries(files.map((file) => [file.file, file.content]));
    expect(JSON.parse(content[MCP_JSON]!)).toEqual({
      mcpServers: {
        db: { command: "db-mcp" },
        lumiose: { command: "pnpm", args: ["exec", "lumiose", "mcp"] },
      },
      other: 1,
    });
    expect(content[CODEX_CONFIG]).toBe(
      'model = "o4"\n\n[mcp_servers.lumiose]\ncommand = "pnpm"\nargs = ["exec", "lumiose", "mcp"]\n\n[mcp_servers.db]\ncommand = "db-mcp"\n',
    );
    // Appended to a config without the table; untouched without --mcp.
    const appended = planAgentFiles(
      (file) => (file === CODEX_CONFIG ? 'model = "o4"\n' : undefined),
      { name: "x", mcp: "bun" },
    );
    expect(appended.find((file) => file.file === CODEX_CONFIG)!.content).toBe(
      'model = "o4"\n\n[mcp_servers.lumiose]\ncommand = "bunx"\nargs = ["lumiose", "mcp"]\n',
    );
    expect(planAgentFiles(() => undefined, { name: "x" }).map((file) => file.file)).not.toContain(
      MCP_JSON,
    );
  });

  it("adds the UI part and the lumiose-ui skill when the project depends on @lumiose/ui", async () => {
    const manifest = JSON.stringify({
      dependencies: { lumiose: "^0.4.0", "@lumiose/ui": "^0.1.0" },
    });
    const files = planAgentFiles((file) => (file === "package.json" ? manifest : undefined), {
      name: "shop",
    });
    const content = Object.fromEntries(files.map((file) => [file.file, file.content]));
    expect(content["AGENTS.md"]).toContain("### UI components (`@lumiose/ui`)");
    expect(content["AGENTS.md"]).toContain("node_modules/@lumiose/ui/docs/llms.txt");
    expect(content["AGENTS.md"]!.indexOf("### UI components")).toBeLessThan(
      content["AGENTS.md"]!.indexOf(AGENTS_END),
    );
    expect(content[UI_SKILL_FILE]).toMatch(/^---\nname: lumiose-ui\ndescription: /);
    for (const topic of [
      "bind:open",
      "lu.core",
      "lu.theme",
      "data-highlighted",
      "--lu-",
      "Dialog.Title",
    ]) {
      expect(content[UI_SKILL_FILE], topic).toContain(topic);
    }
    // Without the dependency: no UI part, no skill.
    const plain = planAgentFiles(() => undefined, { name: "shop" });
    expect(plain[0]!.content).not.toContain("@lumiose/ui");
    expect(plain.map((file) => file.file)).not.toContain(UI_SKILL_FILE);

    // lumiose agents init reads package.json; once the dependency goes, the UI part goes too.
    const root = realpathSync(mkdtempSync(join(tmpdir(), "lumiose-agents-ui-")));
    roots.push(root);
    writeFileSync(join(root, "package.json"), manifest);
    const first = await agentsInit(root);
    expect(first.json.files).toContainEqual({ file: UI_SKILL_FILE, action: "created" });
    expect(readFileSync(join(root, "AGENTS.md"), "utf8")).toContain("lumiose-ui");
    writeFileSync(join(root, "package.json"), "{}");
    await agentsInit(root);
    expect(readFileSync(join(root, "AGENTS.md"), "utf8")).not.toContain("lumiose-ui");
  });

  it("detects the package manager from the lockfile, then package.json", () => {
    const reader = (files: Record<string, string>) => (file: string) => files[file];
    expect(detectPackageManager(reader({ "pnpm-lock.yaml": "" }))).toBe("pnpm");
    expect(detectPackageManager(reader({ "yarn.lock": "" }))).toBe("yarn");
    expect(detectPackageManager(reader({ "bun.lock": "" }))).toBe("bun");
    expect(
      detectPackageManager(reader({ "package.json": '{ "packageManager": "pnpm@10.0.0" }' })),
    ).toBe("pnpm");
    expect(detectPackageManager(reader({}))).toBe("npm");
    expect(detectPackageManager(reader({}), "yarn")).toBe("yarn");
  });

  it("lumiose agents init --mcp writes both configs and prints the Codex note", async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "lumiose-agents-mcp-")));
    roots.push(root);
    writeFileSync(join(root, "pnpm-lock.yaml"), "");
    let stdout = "";
    const code = await main(["agents", "init", "--mcp"], {
      cwd: root,
      color: false,
      write: (text) => void (stdout += text),
      writeError: () => {},
    });
    expect(code).toBe(0);
    expect(stdout).toContain(`created  ${MCP_JSON}`);
    expect(stdout).toContain(`created  ${CODEX_CONFIG}`);
    expect(stdout).toContain("codex mcp add lumiose -- pnpm exec lumiose mcp");
    expect(JSON.parse(readFileSync(join(root, MCP_JSON), "utf8")).mcpServers.lumiose).toEqual({
      command: "pnpm",
      args: ["exec", "lumiose", "mcp"],
    });
  });
});
