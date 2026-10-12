// LOCAL ONLY (never in CI): builds the sample with @lumiose/adapter-netlify and checks it with
// `netlify serve`, the Netlify CLI's local production server: it runs the build command of
// netlify.toml, then serves the publish directory and the Frameworks API functions.
//
//   pnpm --filter @lumiose-examples/ssr-deploy e2e:netlify
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { report, runChecks } from "./checks.ts";
import { SAMPLE, start } from "./process.ts";

/** Pinned: the emulator is not a dependency of the repo. */
export const NETLIFY = "netlify-cli@27.10.0";
const PORT = 8888;

// The CLI adds `.netlify` to the repository's .gitignore: put the file back afterwards.
const gitignore = join(SAMPLE, "../../.gitignore");
const ignored = readFileSync(gitignore, "utf8");

const base = `http://localhost:${PORT}/`;
const server = await start(
  "pnpm",
  ["--package", NETLIFY, "dlx", "netlify", "serve", "--offline", "--port", String(PORT)],
  `${base}robots.txt`,
  { timeoutMs: 600_000 },
);
let ok = false;
try {
  ok = report(
    `Netlify (${NETLIFY} serve)`,
    await runChecks(base, {
      clientAddress: true,
      // `netlify serve` sends `max-age=0` for static files whatever `_headers` says: the rule is
      // checked in the file instead (below).
      immutableAssets: false,
      // Function invocations do not share module state in `netlify serve`.
      waitUntil: false,
    }),
  );
  const headers = readFileSync(join(SAMPLE, "dist/client/_headers"), "utf8");
  const rule = headers.includes("/assets/*\n  cache-control: public, max-age=31536000, immutable");
  console.log(`  ${rule ? "✓" : "✗"} dist/client/_headers caches /assets/* for a year`);
  ok &&= rule;
} finally {
  await server.stop();
  if (readFileSync(gitignore, "utf8") !== ignored) writeFileSync(gitignore, ignored);
}
process.exitCode = ok ? 0 : 1;
