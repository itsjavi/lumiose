// Generates `docs/llms.txt` and `docs/llms-full.txt` from the docs (TASK-32): the sections of
// `docs/README.md` in order, then every diagnostic page. Run after `gen-error-docs.ts`.
// `--check` writes nothing and exits 1 when a file is out of date.
//
//   node packages/lumen/scripts/gen-llms.ts [--check]

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "../package.json" with { type: "json" };
import { generateLlms } from "../src/cli/docs/generate.ts";
import { loadDocs } from "../src/cli/docs/index.ts";

const docs = fileURLToPath(new URL("../docs/", import.meta.url));
const check = process.argv.includes("--check");

const read = (path: string) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
};

const stale = [...generateLlms(loadDocs(docs), pkg.version)].filter(
  ([path, content]) => read(join(docs, path)) !== content,
);
if (check) {
  for (const [path] of stale) console.error(`docs/${path} is out of date.`);
  if (stale.length > 0) console.error("Run: node packages/lumen/scripts/gen-llms.ts");
  process.exitCode = stale.length > 0 ? 1 : 0;
} else {
  for (const [path, content] of stale) writeFileSync(join(docs, path), content);
  console.log(`llms.txt: ${stale.length} file(s) written.`);
}
