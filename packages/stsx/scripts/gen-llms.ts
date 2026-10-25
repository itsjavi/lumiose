// Generates `docs/llms.txt` and `docs/llms-full.txt` of @lumiose/stsx (the /stsx section of the
// site): the index and its pages. The generator is @lumiose/cli's, shared with lumiose's and
// @lumiose/ui's docs.
// `--check` writes nothing and exits 1 when a file is out of date.
//
//   node packages/stsx/scripts/gen-llms.ts [--check]

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateStsxLlms } from "../../cli/src/docs/generate.ts";
import { loadDocs } from "../../cli/src/docs/index.ts";

const docs = fileURLToPath(new URL("../docs/", import.meta.url));
const check = process.argv.includes("--check");

const read = (path: string) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
};

const stale = [...generateStsxLlms(loadDocs(docs))].filter(
  ([path, content]) => read(join(docs, path)) !== content,
);
if (check) {
  for (const [path] of stale) console.error(`docs/${path} is out of date.`);
  if (stale.length > 0) console.error("Run: pnpm --filter @lumiose/stsx docs:gen");
  process.exitCode = stale.length > 0 ? 1 : 0;
} else {
  for (const [path, content] of stale) writeFileSync(join(docs, path), content);
  console.log(`llms.txt: ${stale.length} file(s) written.`);
}
