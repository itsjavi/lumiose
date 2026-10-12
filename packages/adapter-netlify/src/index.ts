// `@lumiose/adapter-netlify` (spec §8 Build "Adapters", decision-45): deploys a Lumiose build to
// Netlify, through its Frameworks API.
//
//   // vite.config.ts
//   import { netlify } from "@lumiose/adapter-netlify";
//   export default defineConfig({ plugins: [lumiose({ adapter: netlify() })] });
//
// After prerendering, `lumiose build` writes `.netlify/v1/functions/lumiose-server.mjs`: a Netlify
// Function (web Request/Response) that calls the build's fetch handler with `ctx.platform` =
// { waitUntil: `context.waitUntil`, clientAddress: `context.ip` }, for every path below the app's
// `base` that no static file answers (`preferStatic`); `lumiose-actions.mjs` takes the form posts
// to prerendered pages with actions, which their static file would refuse. The site is
// `dist/client` (`publish` in
// netlify.toml), with the build's `_headers`, to which this adapter adds a year of caching for the
// assets directory; Netlify compresses on its own, so the build writes no `.br`/`.gz` copies.
// Netlify bundles the function and the npm packages it imports when it deploys.

import { existsSync } from "node:fs";
import { appendFile, mkdir, rm, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Adapter, AdapterBuild } from "@lumiose/vite/build";
import {
  ACTIONS_FUNCTION_FILE,
  actionsFunctionCode,
  assetsCacheRule,
  FUNCTIONS_DIR,
  FUNCTION_FILE,
  functionCode,
} from "./output.ts";

/** The adapter for `lumiose({ adapter: netlify() })`. */
export function netlify(): Adapter {
  return {
    name: "@lumiose/adapter-netlify",
    staticFiles: "platform",
    adapt,
  };
}

export default netlify;

async function adapt(build: AdapterBuild): Promise<void> {
  const { root, clientDir, serverEntry, config, logger } = build;
  await appendFile(join(clientDir, "_headers"), assetsCacheRule(config.base, config.assetsDir));
  const functions = join(root, FUNCTIONS_DIR);
  const file = join(functions, FUNCTION_FILE);
  const actionsFile = join(functions, ACTIONS_FUNCTION_FILE);
  await rm(file, { force: true });
  await rm(actionsFile, { force: true });
  if (serverEntry !== undefined) {
    await mkdir(functions, { recursive: true });
    await writeFile(file, functionCode(functions, serverEntry, config.base));
    const actionPaths = build.prerendered
      .filter((page) => page.actions === true)
      .map((page) => config.base.slice(0, -1) + page.path);
    if (actionPaths.length > 0) {
      await writeFile(actionsFile, actionsFunctionCode(functions, serverEntry, actionPaths));
    }
  }
  const publish = relative(root, clientDir).split("\\").join("/");
  logger.info(
    serverEntry === undefined
      ? `✓ ${publish} for Netlify (every route is prerendered: no function).`
      : `✓ ${FUNCTIONS_DIR}/${FUNCTION_FILE} and ${publish} for Netlify.`,
  );
  if (!existsSync(join(root, "netlify.toml"))) {
    logger.warn(
      `No netlify.toml in the project. Add one so that Netlify publishes ${publish}:\n[build]\n  command = "lumiose build"\n  publish = "${publish}"\nSee lumiose docs deploy/netlify.`,
    );
  }
}
