// LOCAL ONLY (never in CI): builds the sample without an adapter and checks the output where the
// server build's `export default { fetch }` runs: @lumiose/adapter-node (`lumiose preview`), Bun
// (`bun dist/server/entry.js`) and Deno (`deno serve`). Bun and Deno run pinned through
// `pnpm dlx`.
//
//   pnpm --filter @lumiose-examples/ssr-deploy e2e:runtimes [node|bun|deno ...]
import { report, runChecks } from "./checks.ts";
import { run, start } from "./process.ts";

/** Pinned: the runtimes are not dependencies of the repo. */
export const BUN = "bun@1.4.2";
export const DENO = "deno@2.9.6";

const RUNTIMES = {
  node: { label: "Node.js (@lumiose/adapter-node, lumiose preview)", port: 4180 },
  bun: { label: `Bun (${BUN})`, port: 4181 },
  deno: { label: `Deno (${DENO} serve)`, port: 4182 },
} as const;
type Runtime = keyof typeof RUNTIMES;

function command(runtime: Runtime, port: number): [string, string[], Record<string, string>] {
  switch (runtime) {
    case "node":
      return [
        "pnpm",
        ["exec", "lumiose", "preview", "--port", String(port), "--host", "127.0.0.1"],
        {},
      ];
    case "bun":
      return [
        "pnpm",
        ["dlx", BUN, "dist/server/entry.js"],
        { PORT: String(port), NODE_ENV: "production" },
      ];
    case "deno":
      return [
        "pnpm",
        [
          "dlx",
          DENO,
          "serve",
          "--allow-net",
          "--allow-read",
          "--allow-env",
          "--port",
          String(port),
          "dist/server/entry.js",
        ],
        {},
      ];
  }
}

const selected = process.argv.slice(2).filter((name): name is Runtime => name in RUNTIMES);
await run("pnpm", ["build"]);
let ok = true;
for (const runtime of selected.length > 0 ? selected : (Object.keys(RUNTIMES) as Runtime[])) {
  const { label, port } = RUNTIMES[runtime];
  const base = `http://127.0.0.1:${port}/`;
  const [cmd, args, env] = command(runtime, port);
  const server = await start(cmd, args, `${base}robots.txt`, { env });
  try {
    ok =
      report(
        label,
        await runChecks(base, {
          clientAddress: true,
          immutableAssets: true,
          waitUntil: true,
        }),
      ) && ok;
  } finally {
    await server.stop();
  }
}
process.exitCode = ok ? 0 : 1;
