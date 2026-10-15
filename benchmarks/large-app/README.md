# Large-app benchmark

How Lumiose scales to a big app (decision-55): production build time, dev server cold start, HMR
latency and server memory under load, on a generated app of about 1,500 routes and 5,000
components, measured as an A/B of two Lumiose builds in one run. [RESULTS.md](RESULTS.md) has the
latest numbers with the machine and versions.

```sh
pnpm --filter @lumiose/bench-large-app ab v0.4.0 .          # the last release against the working tree
pnpm --filter @lumiose/bench-large-app ab . . --rounds 2    # the same build twice: the noise
pnpm --filter @lumiose/bench-large-app ab <a> <b> --json    # only the result, as JSON
pnpm --filter @lumiose/bench-large-app generate <dir>      # just the app
pnpm --filter @lumiose/bench-large-app test                # the generator is deterministic
```

## The app

`scripts/generate.ts` writes it from a seed (mulberry32), byte for byte the same every time:

- 5,000 components in four levels: each imports two or three components of the next level, so a
  page renders a tree four levels deep; every third component of the last level (417) is an
  island with a signal, rendered with `client:visible` or `client:idle`. Each has a style block.
- 1,500 routes: `/docs` (825 `static` pages, a fifth of them with a param and three
  `staticPaths()`, so about 1,150 prerendered files), `/app` (375 `server` pages, a fifth with a
  param), `/spa` (225 `spa` pages) and `/api` (74 endpoints, half static, half per request). Each
  section has a layout; each page renders three to five first-level components.

`--routes`, `--components` and `--seed` change it.

## The A/B

Each of the two builds is a git ref (a temporary worktree, with `pnpm install` and the release
compiler from `pnpm build:compiler`), `.` (this working tree as it is, compiler rebuilt) or the
directory of a prepared checkout. Each gets its own copy of the app, whose `node_modules` links
that checkout's `lumiose`, `@lumiose/vite`, `@lumiose/cli`, `@lumiose/compiler` and
`@lumiose/adapter-node`. Every round measures both builds, in an order rotated every round, each
measurement in a fresh process (`scripts/runner.ts`):

| Metric           | What                                                                                                                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `buildMs`        | `lumiose build` (`build()` of `@lumiose/vite/build`), from process start to the end, prerendering included.                                                                                                          |
| `serverMemoryMb` | Peak resident memory of the build served by `@lumiose/adapter-node` (`createHandler()`) while it answers `--requests` (2,000) requests to the server pages, SPA pages and endpoints, `--concurrency` (16) at a time. |
| `devColdStartMs` | `lumiose dev` (`createDevServer()`), with Vite's dependency cache and the generated types removed, from process start until a server page's HTML has arrived.                                                        |
| `hmrMs`          | From saving a component until the dev server has told the browser (an HMR message) and serves that page with the change: a server component and an island component, alternately, `--edits` (4) per round.           |

The result is each metric's median per build and the ratio b/a: above 1, b is slower or uses more
memory. Builds of separate machines or runs are not comparable: only the ratio of one run is.
Three rounds (the default) take about ten minutes on a laptop, plus a few minutes per ref to
install and compile. `pnpm release:version` runs it between the last release and the candidate
(TASK-320).

`--json` prints the medians, the ratios, every sample, the machine (OS, CPU, cores, memory, Node,
load average) and both builds (label, version, commit).
