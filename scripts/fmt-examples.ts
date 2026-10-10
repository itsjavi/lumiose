// `pnpm fmt:examples`: `lumiose fmt --check` in every example (or in the project directories
// given as arguments), one summary line per project, exit 1 when any file is not formatted.
// It calls the CLI in-process instead of `pnpm --filter … exec`, whose failure output adds a
// stray "undefined" line (pnpm 11) that reads like a Lumiose error.
//
//   node scripts/fmt-examples.ts [dir...]

import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { main } from "@lumiose/cli/internal/main.ts";

const repo = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const dirs =
  args.length > 0
    ? args.map((dir) => resolve(dir))
    : readdirSync(join(repo, "examples"), { withFileTypes: true })
        .filter(
          (entry) => entry.isDirectory() && existsSync(join(repo, "examples", entry.name, "src")),
        )
        .map((entry) => join(repo, "examples", entry.name))
        .toSorted();

let failed = 0;
for (const dir of dirs) {
  const name = relative(repo, dir).split("\\").join("/") || ".";
  const prefix = (text: string) =>
    text
      .split("\n")
      .filter((line) => line !== "")
      .map((line) => `${name}: ${line}\n`)
      .join("");
  const code = await main(["fmt", "--check", "--root", dir], {
    cwd: dir,
    color: false,
    write: (text) => void process.stdout.write(prefix(text)),
    writeError: (text) => void process.stderr.write(prefix(text)),
  });
  if (code !== 0) failed++;
}
if (failed > 0) {
  process.stderr.write(
    `fmt:examples: ${failed} of ${dirs.length} projects need \`lumiose fmt\`.\n`,
  );
}
process.exitCode = failed > 0 ? 1 : 0;
