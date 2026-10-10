// Generates `docs/errors/LUMxxxx.md` and `docs/errors/README.md` from the compiler's diagnostics
// registry (TASK-32). Hand-written explanations below each page's end marker are kept; a new code
// gets a stub to fill in. `--check` writes nothing and exits 1 when a file is out of date.
//
//   node packages/lumiose/scripts/gen-error-docs.ts [--check]

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateErrorDocs, REGISTRY_PATH } from "@lumiose/cli/internal/docs/generate.ts";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const docs = fileURLToPath(new URL("../docs/", import.meta.url));
const check = process.argv.includes("--check");

const errorsDir = join(docs, "errors");
const existing = new Map<string, string>();
if (existsSync(errorsDir)) {
  for (const name of readdirSync(errorsDir)) {
    if (name.endsWith(".md"))
      existing.set(`errors/${name}`, readFileSync(join(errorsDir, name), "utf8"));
  }
}

const { files, orphans } = generateErrorDocs(
  readFileSync(join(repo, REGISTRY_PATH), "utf8"),
  existing,
);
const stale = [...files]
  .filter(([path, content]) => existing.get(path) !== content)
  .map(([path]) => path);

for (const path of orphans) {
  console.error(
    `docs/${path}: no ${REGISTRY_PATH} entry generates this page (a retired code keeps its entry).`,
  );
}
if (check) {
  for (const path of stale) console.error(`docs/${path} is out of date.`);
  if (stale.length > 0) console.error("Run: node packages/lumiose/scripts/gen-error-docs.ts");
  process.exitCode = stale.length > 0 || orphans.length > 0 ? 1 : 0;
} else {
  mkdirSync(errorsDir, { recursive: true });
  for (const path of stale) writeFileSync(join(docs, path), files.get(path)!);
  console.log(`Error docs: ${files.size} files, ${stale.length} written.`);
  process.exitCode = orphans.length > 0 ? 1 : 0;
}
