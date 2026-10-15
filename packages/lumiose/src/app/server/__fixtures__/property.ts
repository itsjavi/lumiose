// Property-based tests (fast-check, decision-56, TASK-313): `pnpm test` runs a short pass of each
// `*.property.test.ts`; the nightly workflow runs many more cases with
// `pnpm --filter lumiose test:properties [runs]` (scripts/properties.ts), which sets
// `LUMIOSE_PROPERTY_RUNS`. A failure prints its seed and path: rerun it with
// `LUMIOSE_PROPERTY_SEED=<seed>` (and the path in `fc.assert`'s report) to reproduce it.
import fc from "fast-check";

/** Cases per property. */
export const RUNS = Number(process.env.LUMIOSE_PROPERTY_RUNS ?? 100);

/** A test timeout that grows with the case count (properties that start a request handler are slower). */
export const TIMEOUT = Math.max(10_000, RUNS * 25);

const seed = process.env.LUMIOSE_PROPERTY_SEED;
fc.configureGlobal({ numRuns: RUNS, ...(seed === undefined ? {} : { seed: Number(seed) }) });

export { fc };
