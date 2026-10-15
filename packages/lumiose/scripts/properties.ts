// The property tests (`*.property.test.ts`, TASK-313) with many cases, for the nightly workflow
// (TASK-311). `pnpm test` runs them with 100 cases each.
//
//   pnpm --filter lumiose test:properties [runs]   # default 20000 cases per property
//
// A failure prints its seed: `LUMIOSE_PROPERTY_SEED=<seed>` reproduces it.
import { spawnSync } from "node:child_process";

const runs = process.argv[2] ?? process.env.LUMIOSE_PROPERTY_RUNS ?? "20000";
if (!/^\d+$/.test(runs)) {
  console.error(`test:properties: expected a number of cases, got ${JSON.stringify(runs)}`);
  process.exit(2);
}
const result = spawnSync("vitest", ["run", ".property.test"], {
  stdio: "inherit",
  env: { ...process.env, LUMIOSE_PROPERTY_RUNS: runs },
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
