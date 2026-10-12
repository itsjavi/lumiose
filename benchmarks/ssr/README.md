# SSR throughput benchmark

The same page (a 1,000-row table of about 5,000 component instances) rendered to an HTML string
by Lumiose, Solid, Svelte, Vue, React, Preact, Astro and Remix 3. [RESULTS.md](RESULTS.md) has
the latest numbers, the page and the method.

```sh
pnpm --filter @lumiose/bench-ssr bench    # build every framework, measure, rewrite RESULTS.md
```

`scripts/build.ts` compiles each implementation into `dist/<framework>/`, `scripts/run.ts`
measures one framework in one process, and `scripts/bench.ts` runs them all in fresh processes,
interleaved over rounds, and writes RESULTS.md. Run it on a quiet machine: other work shifts
every number.

## Comparing Lumiose builds: `ab`

Separate processes on a busy machine differ by several percent between identical builds, more
than most changes are worth. To tell whether a change makes Lumiose's server rendering faster or
slower, compare the builds in one process with `scripts/ab.ts`:

```sh
pnpm --filter @lumiose/bench-ssr ab HEAD                # HEAD against the working tree
pnpm --filter @lumiose/bench-ssr ab a5d73ef HEAD        # any git refs; the first is the reference
pnpm --filter @lumiose/bench-ssr ab --no-flatten v0.1.0 v0.2.0 .
```

For each ref (`.` is the working tree, uncommitted changes included), it checks out a temporary
git worktree, builds that ref's compiler (`crates/*_napi`, debug: the generated code is the same
as a release build's), compiles that ref's benchmark page with it, and copies that ref's runtime
(`packages/*/src`), so no two builds share a module. Every build renders the same data. Then:

- **Control.** The reference is built twice. The copy's ratio to the reference shows how much
  two identical builds differ: changes within that spread are noise.
- **Rounds.** After a warmup of every build, each round measures each build once for `--ms`, in
  an order rotated every round, with a full GC before each run, as `scripts/run.ts` does
  (results awaited, then flattened; `--no-flatten` measures as before TASK-246). Slow changes in
  the machine's load hit every build alike.
- **Passes.** Which build loaded first can shift it by a few percent, so the rounds run in several
  passes (by default one per build), each in a fresh process that loads the builds in a rotated
  order. The ratios of all passes are pooled.

It prints each build's median renders/s and its ratio to the reference: the median over all
rounds, the quartiles, the extremes and each pass's median. For example, `ab a5d73ef HEAD` on
2026-10-13 (load average 5.5 to 9.9):

```text
Build              renders/s  vs a5d73ef4: median of 48 rounds (quartiles; min to max); median per pass
a5d73ef4               541.5
a5d73ef4, control      538.7   -0.1% (-1.8% to +1.1%; -17.1% to +7.9%); +0.1%, -1.5%, +0.9%
HEAD (e8c51f7c)        579.6   +7.1% (+5.9% to +9.6%; -4.3% to +15.6%); +6.9%, +7.3%, +9.0%
```

A run takes about a minute per ref to build, then about 20 seconds per pass. Options: `--passes`,
`--rounds` (per pass, default 16), `--ms` (default 250), `--warmup` (ms per build and pass,
default 3000), `--no-flatten` and `--keep` (keep the worktrees and the build output, a few GB of
cargo target, which are otherwise removed at the end, also on Ctrl-C). It warns when the load
average exceeds the CPU count: rerun then, or read the result with that in mind. Compare the
ratios: the absolute renders/s are not comparable with RESULTS.md, which measures each framework
alone on a quiet machine.
