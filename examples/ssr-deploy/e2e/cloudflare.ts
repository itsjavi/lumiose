// LOCAL ONLY (never in CI): builds the sample with @lumiose/adapter-cloudflare and checks it in
// `wrangler dev`, which runs the Worker in workerd with the static assets.
//
//   pnpm --filter @lumiose-examples/ssr-deploy e2e:cloudflare
import { report, runChecks } from "./checks.ts";
import { run, start } from "./process.ts";

/** Pinned: the emulator is not a dependency of the repo. */
export const WRANGLER = "wrangler@4.142.0";
const PORT = 8787;

await run("pnpm", ["build:cloudflare"]);
const base = `http://127.0.0.1:${PORT}/`;
const server = await start(
  "pnpm",
  ["dlx", WRANGLER, "dev", "--ip", "127.0.0.1", "--port", String(PORT)],
  base,
);
let ok = false;
try {
  ok = report(
    `Cloudflare Workers (${WRANGLER} dev, workerd)`,
    await runChecks(base, {
      clientAddress: false,
      greeting: "hello from wrangler",
      immutableAssets: true,
      waitUntil: true,
    }),
  );
} finally {
  await server.stop();
}
process.exitCode = ok ? 0 : 1;
