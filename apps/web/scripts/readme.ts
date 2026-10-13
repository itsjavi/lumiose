// `pnpm readme:gen`: rewrites the root README's generated numbers from the committed benchmark
// results (src/content/readme.ts, TASK-269). The content modules load through Vite's module runner,
// because evidence.ts reads the results with `?raw` imports and `import.meta.glob`.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const README = fileURLToPath(new URL("../../../README.md", import.meta.url));
const MODULE = fileURLToPath(new URL("../src/content/readme.ts", import.meta.url));

const { module } = await runnerImport<typeof import("../src/content/readme.ts")>(MODULE, {
  configFile: false,
  logLevel: "silent",
});
const current = readFileSync(README, "utf8");
const next = module.generateReadme(current);
if (next === current) {
  console.log("README.md is up to date.");
} else {
  writeFileSync(README, next);
  console.log("README.md updated from the committed results.");
}
