// Runs the conformance suite (e2e/tracker.e2e.ts) against each app in production mode: seed a fresh
// database, build, start the server with slow comments (so streaming is visible), run Playwright.
//
//   pnpm --filter @bench/harness conformance [--only lumen,next] [--no-build]
//   pnpm --filter @bench/harness conformance --url http://127.0.0.1:4101   (an already running server)
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { type App, baseUrl, runScript, startServer } from "./apps.ts";
import { args, selectApps } from "./cli.ts";

const HARNESS = fileURLToPath(new URL("..", import.meta.url));
export const COMMENTS_DELAY_MS = 150;

/** Runs the Playwright suite against a server; resolves to whether it passed. */
export function runSuite(url: string, streaming: boolean, quiet = false): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("pnpm", ["exec", "playwright", "test", "-c", "e2e/playwright.config.ts"], {
      cwd: HARNESS,
      env: { ...process.env, BENCH_BASE_URL: url, BENCH_EXPECT_STREAMING: streaming ? "1" : "0" },
      stdio: quiet ? "ignore" : "inherit",
    });
    child.on("exit", (code) => resolve(code === 0));
  });
}

/** Seeds, builds (unless `build` is false) and serves one app, then runs the suite. */
export async function checkApp(
  app: App,
  options: { build: boolean; quiet?: boolean },
): Promise<boolean> {
  await runScript(app, "seed");
  if (options.build) await runScript(app, "build");
  const server = await startServer(app, "start", { COMMENTS_DELAY_MS: String(COMMENTS_DELAY_MS) });
  try {
    return await runSuite(baseUrl(app), true, options.quiet);
  } finally {
    await server.stop();
    await runScript(app, "seed"); // the suite mutates data
  }
}

if (import.meta.main) {
  const values = args({
    only: { type: "string" },
    url: { type: "string" },
    "no-build": { type: "boolean", default: false },
  });
  if (values.url !== undefined) {
    process.exitCode = (await runSuite(values.url, false)) ? 0 : 1;
  } else {
    const summary: string[] = [];
    for (const app of selectApps(values.only)) {
      console.log(`\n== ${app.name} (${baseUrl(app)}) ==`);
      const passed = await checkApp(app, { build: !values["no-build"] });
      summary.push(`${app.name}: ${passed ? "pass" : "FAIL"}`);
      if (!passed) process.exitCode = 1;
    }
    console.log(`\n${summary.join("\n") || "No app found under benchmarks/fullstack/apps."}`);
  }
}
