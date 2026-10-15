# Large-app benchmark results

The A/B of [scripts/ab.ts](scripts/ab.ts) on the generated app (1,500 routes, 5,000
components, 417 islands, seed 1); see the [README](README.md) for the app and the
method. Only the ratios of one run compare: the absolute numbers depend on the machine and its load.

## 2026-10-15: v0.4.0 against M10

- **a:** v0.4.0, commit `9702f55e9cda` (the last release).
- **b:** the M10 and M11 work merged so far (main as of commit `cb3c1fd34ec2`, plus this
  benchmark; still version 0.4.0 in its package.json).
- **Machine:** Apple M1 Max, 10 cores, 32 GB, darwin 27.0.0 arm64, Node v26.8.1. Load average
  4.1 to 17.0 during the run (other work on the machine): a quiet machine
  gives steadier numbers.
- **Options:** 3 rounds, 4 HMR edits per round and build, 2,000 requests at
  16 at a time for the memory.

| Metric (median)               | a        | b        | b/a   |
| ----------------------------- | -------- | -------- | ----- |
| Production build (ms)         | 55,129.7 | 55,058.2 | 0.999 |
| Dev cold start (ms)           | 925.6    | 934.6    | 1.010 |
| HMR latency (ms)              | 87.5     | 84.9     | 0.970 |
| Server memory (peak RSS) (MB) | 521      | 524.3    | 1.006 |

No metric moved beyond the noise: M10 builds, starts, updates and serves this app as v0.4.0
did. The first build of the run (a, 67.6 s) ran with cold file caches; the median of three
rounds leaves it out.

Samples, in run order:

| Metric                   | a                                                 | b                                                |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------ |
| Production build         | 67600, 55130, 54839                               | 55542, 55047, 55058                              |
| Dev cold start           | 926, 918, 936                                     | 938, 935, 920                                    |
| HMR latency              | 124, 83, 88, 86, 122, 78, 91, 88, 127, 80, 87, 85 | 122, 77, 89, 91, 128, 84, 88, 86, 26, 78, 79, 76 |
| Server memory (peak RSS) | 521, 520, 526                                     | 524, 525, 524                                    |

The full result: [results/2026-10-15-v0.4.0-vs-m10.json](results/2026-10-15-v0.4.0-vs-m10.json).
