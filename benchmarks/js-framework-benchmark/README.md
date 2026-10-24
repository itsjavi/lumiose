# js-framework-benchmark and runtime A/Bs

Lumiose's implementation of krausest's [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark)
(`src/App.stsx`), the scripts that run krausest's own runner against reference frameworks
([RESULTS.md](RESULTS.md)), and in-process A/Bs of Lumiose builds for runtime and compiler
changes.

| Script                  | What it does                                                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm bench:jsfb`       | krausest's runner (Puppeteer, Chrome traces, CPU throttling, memory) for Lumiose and the reference frameworks; writes RESULTS.md. `--build` only builds. |
| `pnpm bench:jsfb:ab`    | krausest's CPU benchmarks for two or more builds in one browser session, alternating run by run, with paired differences against the first.              |
| `pnpm bench:grid:ab`    | Nested keyed lists (10 rows of 8 cards): replace every row, two runtime builds in one page (`src/grid`).                                                 |
| `pnpm bench:measure:ab` | Rows whose `attach` measures them and writes a signal (`src/measure`).                                                                                   |
| `pnpm bench:rows:ab`    | Keyed rows whose entries are re-derived on every change: replace, re-derive, refetch (`src/rows`), two builds and optionally React in one page.          |

Claim a speedup or a regression only from an in-process A/B: two builds in one process, measured
alternately, so the machine's load hits both alike.

## Builds of `lumiose`

`pnpm bench:jsfb --build --frameworks lumiose,lumiose-keyed,lumiose-hand` builds into
`.krausest/frameworks/keyed/<name>`:

- `lumiose`: `src/App.stsx`, unkeyed rows (krausest's keyed category: rows keep their identity);
- `lumiose-keyed`: the same app with `key={row.id}` on its rows (`vite --mode keyed`), to measure
  keyed reconciliation;
- `lumiose-hand`: the app hand-compiled from the compiler-runtime contract (`src/hand-compiled.js`).

To compare a change, copy a build of the old commit to another directory name first (for example
`.krausest/frameworks/keyed/lumiose-base`), rebuild, and run
`pnpm bench:jsfb:ab --frameworks lumiose-base,lumiose --benchmarks 01_,02_,03_,04_,05_,06_,07_,08_,09_`.

## Rows A/B (`bench:rows:ab`)

`src/rows/main.tsx` renders the visible window of a virtual grid: 10 rows of 8 cards, each row an
entry `{ key, index, row }` derived from the items again on every change (new objects), keyed by
position and card ids, and each card a component with an image, type icons and a conditional.
Each sample mounts a build's grid, runs one operation and times it until the next frame has painted:

- `replace`: new ids, so every row and card is new;
- `rederive`: the same items in new row entries;
- `refetch`: new item objects with the same ids, in new row entries.

It prints the medians and quartiles of the time until painted, of the script with forced style and
layout, and of the script alone, the paired differences between the builds, and the DOM nodes one
operation adds and removes.

```sh
# The runtime of a git ref against this tree, both compiled with this checkout's compiler:
pnpm bench:rows:ab HEAD .
# A change to the compiler's output needs a bundle of each side, built in its own checkout:
pnpm bench:rows:ab build <dir>/rows-before.js   # in a checkout of the old commit
pnpm bench:rows:ab build <dir>/rows-after.js    # here
pnpm bench:rows:ab <dir>/rows-before.js <dir>/rows-after.js --react ../fullstack/apps/react-router/node_modules
```

`--react <node_modules>` adds the same page in React (`src/rows/react.ts`, cards memoized on their
fields) as a reference, from any `node_modules` with `react` and `react-dom`. Options: `--rounds`,
`--warmup`, `--cpu` (slowdown, default 4) and `--ops`.
