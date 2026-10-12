// `@lumiose/adapter-cloudflare` (spec §8 Build "Adapters", decision-45): deploys a Lumiose build to
// Cloudflare Workers with static assets.
//
//   // vite.config.ts
//   import { cloudflare } from "@lumiose/adapter-cloudflare";
//   export default defineConfig({ plugins: [lumiose({ adapter: cloudflare() })] });
//
// After prerendering, `lumiose build` writes `dist/_worker.js`, the Worker: the build's fetch
// handler, with `ctx.platform` = { env: the bindings, waitUntil: `ctx.waitUntil`, clientAddress:
// `CF-Connecting-IP` }. Cloudflare serves `dist/client` (`assets.directory` in the wrangler config)
// before calling the Worker, with the build's `_headers`, to which this adapter adds a year of
// caching for the assets directory; it compresses on its own, so the build writes no `.br`/`.gz`
// copies. Prerendered pages with form actions are left out of the assets (`.assetsignore`):
// Cloudflare would answer their POSTs with 405, so the Worker renders them. Wrangler bundles the Worker and the npm packages it imports when it deploys. The server
// runtime needs the `nodejs_compat` flag (AsyncLocalStorage).

import { existsSync } from "node:fs";
import { appendFile, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Adapter, AdapterBuild } from "@lumiose/vite/build";
import {
  assetsCacheRule,
  assetsIgnore,
  WORKER_FILE,
  workerCode,
  wranglerConfig,
} from "./output.ts";

const WRANGLER_CONFIGS = ["wrangler.jsonc", "wrangler.json", "wrangler.toml"];

/** The adapter for `lumiose({ adapter: cloudflare() })`. */
export function cloudflare(): Adapter {
  return {
    name: "@lumiose/adapter-cloudflare",
    staticFiles: "platform",
    adapt,
  };
}

async function adapt(build: AdapterBuild): Promise<void> {
  const { outDir, clientDir, serverEntry, config, logger } = build;
  await appendFile(join(clientDir, "_headers"), assetsCacheRule(config.base, config.assetsDir));
  // Cloudflare answers a POST to a static file itself (405): pages with form actions are left out
  // of the assets, so the Worker renders them and runs their actions.
  const ignored = assetsIgnore(build.prerendered);
  if (ignored !== "") await appendFile(join(clientDir, ".assetsignore"), ignored);
  const worker = join(outDir, WORKER_FILE);
  await rm(worker, { force: true });
  if (serverEntry !== undefined) await writeFile(worker, workerCode(outDir, serverEntry));
  const dist = relative(build.root, outDir).split("\\").join("/");
  const files =
    serverEntry === undefined ? `${dist}/client` : `${dist}/${WORKER_FILE} and ${dist}/client`;
  logger.info(`✓ ${files} for Cloudflare Workers (wrangler deploy).`);
  if (!WRANGLER_CONFIGS.some((name) => existsSync(join(build.root, name)))) {
    logger.warn(
      `No wrangler config in the project. Add a wrangler.jsonc:\n${wranglerConfig(build)}\nSee lumiose docs deploy/cloudflare.`,
    );
  }
}
