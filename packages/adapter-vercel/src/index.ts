// `@lumiose/adapter-vercel` (spec §8 Build "Adapters", decision-45): deploys a Lumiose build to
// Vercel, as the Build Output API (v3) describes it.
//
//   // vite.config.ts
//   import { vercel } from "@lumiose/adapter-vercel";
//   export default defineConfig({ plugins: [lumiose({ adapter: vercel() })] });
//
// After prerendering, `lumiose build` writes `.vercel/output`, which Vercel deploys as is:
//
// - `static/`: `dist/client` (below the app's `base`), served first. Prerendered pages answer their
//   URL without the trailing slash too (`overrides`), as `trailingSlash` says.
// - `functions/__lumiose.func`: the build's fetch handler, for every other path below `base`, on
//   the Node.js runtime (`runtime: "nodejs"`, the default: a `(req, res)` handler with the npm
//   packages it imports, traced with @vercel/nft) or the Edge runtime (`runtime: "edge"`: one
//   bundled module). `ctx.platform.clientAddress` is `X-Real-IP`; `waitUntil` is Vercel's.
// - `config.json`: the routes: `lumiose({ headers })` and Lumiose's default headers, a year of
//   caching for content-hashed assets, the static files, then the function.
//
// Vercel compresses on its own, so the build writes no `.br`/`.gz` copies.

import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Adapter, AdapterBuild } from "@lumiose/vite/build";
import { FUNCTION_NAME, outputConfig } from "./config.ts";
import { edgeFunction, nodeFunction, type Runtime } from "./function.ts";

export interface VercelOptions {
  /** Where the function runs: Vercel's Node.js runtime, or its Edge runtime. Default: `"nodejs"`. */
  runtime?: Runtime;
}

/** The adapter for `lumiose({ adapter: vercel() })`. */
export function vercel(options: VercelOptions = {}): Adapter {
  const runtime = options.runtime ?? "nodejs";
  if (runtime !== "nodejs" && runtime !== "edge") {
    throw new TypeError(
      `vercel({ runtime }): expected "nodejs" or "edge", got ${JSON.stringify(runtime)}.`,
    );
  }
  return {
    name: "@lumiose/adapter-vercel",
    staticFiles: "platform",
    adapt: (build) => adapt(build, runtime),
  };
}

/** The Build Output API directory, relative to the project. */
const OUTPUT_DIR = ".vercel/output";

async function adapt(build: AdapterBuild, runtime: Runtime): Promise<void> {
  const { root, clientDir, serverEntry, config, logger } = build;
  const output = join(root, OUTPUT_DIR);
  await rm(output, { recursive: true, force: true });
  const staticDir = join(output, "static", config.base.slice(1));
  await mkdir(staticDir, { recursive: true });
  // `_headers` is for static hosts; config.json carries the headers here.
  await cp(clientDir, staticDir, {
    recursive: true,
    filter: (source) => source !== join(clientDir, "_headers"),
  });
  if (serverEntry !== undefined) {
    const funcDir = join(output, "functions", `${FUNCTION_NAME}.func`);
    await mkdir(funcDir, { recursive: true });
    const functionConfig =
      runtime === "edge" ? await edgeFunction(build, funcDir) : await nodeFunction(build, funcDir);
    await writeFile(
      join(funcDir, ".vc-config.json"),
      `${JSON.stringify(functionConfig, null, 2)}\n`,
    );
  }
  const pages = build.prerendered.filter((file) => file.kind === "page");
  const prefix = config.base.slice(0, -1);
  await writeFile(
    join(output, "config.json"),
    `${JSON.stringify(
      outputConfig({
        config,
        hasFunction: serverEntry !== undefined,
        pages: pages.map((file) => config.base.slice(1) + file.file),
        actionPaths: pages
          .filter((file) => file.actions === true)
          .map((file) => prefix + file.path),
        notFoundPage: existsSync(join(clientDir, "404.html")),
        hashedFiles: build.hashedFiles,
        unhashedAssets: build.unhashedAssets,
      }),
      null,
      2,
    )}\n`,
  );
  logger.info(
    `✓ ${OUTPUT_DIR} for Vercel (${serverEntry === undefined ? "static files only" : `${runtime === "edge" ? "an Edge" : "a Node.js"} function`}).`,
  );
}
