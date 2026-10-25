// The docs' llms.txt and llms-full.txt are generated (`pnpm --filter @lumiose/stsx docs:gen`): they
// must match the pages.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { generateStsxLlms } from "../../cli/src/docs/generate.ts";
import { loadDocs } from "../../cli/src/docs/index.ts";

const docs = fileURLToPath(new URL("../docs/", import.meta.url));

it("keeps llms.txt and llms-full.txt in sync with the docs", () => {
  for (const [path, content] of generateStsxLlms(loadDocs(docs))) {
    expect(readFileSync(`${docs}${path}`, "utf8"), `${path}: run docs:gen`).toBe(content);
  }
});
