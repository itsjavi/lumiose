import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildCommand, previewCommand } from "./command.ts";

const root = mkdtempSync(join(tmpdir(), "lumen-command-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe("build and preview commands", () => {
  it("lumen build reports route errors and exits 1", async () => {
    mkdirSync(join(root, "src/routes/api"), { recursive: true });
    writeFileSync(
      join(root, "src/routes/api/subscribe.ts"),
      "export function GET() {}\nexport function POST() {}\n",
    );
    const errors: string[] = [];
    const code = await buildCommand({ root, writeError: (text) => errors.push(text) });
    expect(code).toBe(1);
    expect(errors.join("")).toMatch(/^lumen build: The routes have errors:\n.*LUM5005/);
  });

  it("lumen preview serves with the project's @lumen/adapter-node and needs a build", async () => {
    mkdirSync(join(root, "node_modules/@lumen"), { recursive: true });
    symlinkSync(
      resolve(import.meta.dirname, "../../../../adapter-node"),
      join(root, "node_modules/@lumen/adapter-node"),
      "dir",
    );
    const errors: string[] = [];
    const code = await previewCommand({
      root,
      write: () => {},
      writeError: (text) => errors.push(text),
    });
    expect(code).toBe(1);
    expect(errors.join("")).toMatch(/^lumen preview: No build in .*Run `lumen build` first\.\n$/);
  });
});
