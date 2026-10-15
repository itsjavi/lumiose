// Writes src/ui-demos from the `tsx check` examples of packages/ui/docs (src/content/ui-demos.ts):
// the live demos of the /ui pages. `--check` only reports stale files and exits 1, as
// src/content/ui-demos.test.ts does in `pnpm check`.
//
//   pnpm --filter @lumiose/web ui:demos
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DEMOS_DIR, GENERATE, uiDemoFiles } from "../src/content/ui-demos.ts";

const WEB = join(import.meta.dirname, "..");
const UI_DOCS = join(WEB, "../../packages/ui/docs");
const OUT = join(WEB, DEMOS_DIR);

/** packages/ui/docs/*.md by page name. */
export function readUiPages(): Record<string, string> {
  return Object.fromEntries(
    readdirSync(UI_DOCS)
      .filter((file) => file.endsWith(".md"))
      .map((file) => [file.slice(0, -".md".length), readFileSync(join(UI_DOCS, file), "utf8")]),
  );
}

/** The generated files that are missing, changed or no longer generated. */
export function staleDemoFiles(): string[] {
  const files = uiDemoFiles(readUiPages());
  const present = listDemoFiles();
  const stale = [...files]
    .filter(([file, text]) => !present.includes(file) || read(file) !== text)
    .map(([file]) => file);
  return [...stale, ...present.filter((file) => !files.has(file))].toSorted();
}

function listDemoFiles(): string[] {
  try {
    return readdirSync(OUT).filter((file) => file.endsWith(".tsx"));
  } catch {
    return [];
  }
}

function read(file: string): string {
  return readFileSync(join(OUT, file), "utf8");
}

if (import.meta.main) {
  if (process.argv.includes("--check")) {
    const stale = staleDemoFiles();
    if (stale.length > 0) {
      console.error(`${DEMOS_DIR} is stale (${stale.join(", ")}): run ${GENERATE}.`);
      process.exit(1);
    }
  } else {
    const files = uiDemoFiles(readUiPages());
    mkdirSync(OUT, { recursive: true });
    for (const file of listDemoFiles()) if (!files.has(file)) rmSync(join(OUT, file));
    for (const [file, text] of files) writeFileSync(join(OUT, file), text);
    console.log(`${DEMOS_DIR}: ${files.size - 1} demos`);
  }
}
