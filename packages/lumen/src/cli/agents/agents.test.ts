// `lumen agents init` and the agent files shared with create-lumen (TASK-33).
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { main } from "../main.ts";
import {
  AGENTS_END,
  AGENTS_START,
  agentsSection,
  GITATTRIBUTES_LINE,
  planAgentFiles,
  SKILL_FILE,
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
    expect(agents).toContain("node_modules/lumen/docs");
    expect(agents).toContain("npx lumen check");
    expect(files[1]!.content).toBe("Follow the instructions in @AGENTS.md\n");
    expect(files[3]!.content).toBe(`${GITATTRIBUTES_LINE}\n`);
    expect(files[4]!.content).toContain('"extends": "./.lumen/tsconfig.generated.json"');
  });

  it("adds Lumen's parts to existing files and replaces only its own section", () => {
    const existing: Record<string, string> = {
      "AGENTS.md": `# Shop\n\nOur rules.\n\n${AGENTS_START}\nold Lumen text\n${AGENTS_END}\n\nMore rules.\n`,
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

  it("lumen agents init writes once, then reports everything unchanged", async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "lumen-agents-")));
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
      /^---\nname: lumen\ndescription: /,
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
});
