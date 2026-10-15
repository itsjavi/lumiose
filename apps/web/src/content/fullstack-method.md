## The app

Every stack implements the same issue tracker ("Tracker"): a shared layout (header with the
current user, a sidebar of 12 projects with their open-issue counts, a footer) and these routes:

| Route                               | Content                                                                           | Interactive part                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `/`                                 | Dashboard: status and priority counts, a per-project table, 10 recent issues      | None                                                                        |
| `/projects/:slug`                   | A GET filter form, 50 issues per page, pagination, the total count                | Bulk select: row checkboxes, "N selected", "Close selected" posts an action |
| `/issues/:id`                       | The issue, a status form (action), and the comments streamed behind a fallback    | A comment composer with a live character count                              |
| `/issues/new`                       | A form validated on the server, with field errors; success redirects to the issue | A label picker                                                              |
| `/search?q=`                        | Search results                                                                    | A search box with debounced suggestions from `/api/search`                  |
| `/login`                            | A username form that sets the session cookie                                      | None                                                                        |
| `/api/issues/:id`, `/api/search?q=` | JSON endpoints                                                                    | None                                                                        |

The data is one SQLite database per app (`node:sqlite`, a deterministic seed: 200 users, 12
projects, 6,000 issues, 30,000 comments), read through one shared package with the same queries
for every app. Mutating actions need a session and redirect to `/login` without one.

## Fairness rules

- **Same app, same output.** Same routes, data, HTML structure, class names and behaviour. One
  Playwright conformance suite runs against every app in production mode, and an app is only
  measured when it passes.
- **Same CSS and data layer.** Every app imports one plain stylesheet and calls the same data
  package. No ORM, no CSS Modules or utility CSS, no framework data cache.
- **Idiomatic code.** Each app uses its framework's recommended primitives (the implementations
  below), including how it streams the slow comments.
- **Dynamic rendering everywhere.** Every page renders on each request: no prerendering and no page
  or data caching.
- **Production servers as shipped,** with HTTP compression off in every app; payload sizes are
  computed offline with gzip (level 6) and brotli (quality 11). The harness checks, on each
  server's first start, that it runs with `NODE_ENV=production` and does not compress.
- **Latest stable versions,** pinned exactly; each results file records the resolved versions.
- **Same machine, sequential runs,** nothing else heavy running; each file records the machine.
  Server load tests run all apps at once and interleave their rounds, rotating the order each
  round, after a cool-down and an idle check, so a load spike cannot land on one framework.

## What is measured

Every number is a median over several iterations, with the minimum and maximum kept (the viewer
draws them as whiskers). Each metric says where it was measured:

- **Development** (each app's dev server): cold and warm start, first and warm page loads, and the
  time from editing a shared component to the browser showing it.
- **Build** (the production build and the sources): build time, output size on disk, type check
  time, lines of source, and the packages the production server loads at run time (traced, not
  read from `package.json`).
- **Production** (the built app on its production server): the JavaScript and CSS each first page
  load downloads, page load timings in Chromium with 4× CPU throttling (TTFB, FCP, LCP, total
  blocking time, time until the interactive parts are ready), and server throughput and latency
  with autocannon (warm-up, then 3 × 10 s with 50 connections per route), cold start and memory.

The results viewer shows every metric of a run as a table and a bar chart, and compares two runs.

## Reproduce a run

You need Node.js 24 or later, pnpm, Rust (for the Lumiose compiler) and a quiet machine.

```sh
git clone https://github.com/itsjavi/lumiose.git && cd lumiose
pnpm install
pnpm build:compiler
pnpm --filter @bench/harness exec playwright install chromium

# Check that every app produces the same output (the conformance suite).
pnpm --filter @bench/harness conformance

# A full run writes benchmarks/fullstack/results/<date>T<time>-<host>.json.
pnpm --filter @bench/harness bench
# A smoke run: one iteration, some apps, some metric groups.
pnpm --filter @bench/harness bench --quick --only lumiose,next --metrics build,load

# Browse the results, yours included, in the viewer.
pnpm --filter @bench/harness run view
```

`bench` also takes `--network slow4g` (a throttled network for page loads), `--comments-delay <ms>`
(slow comments, to see streaming) and `--iterations dev=5,build=3,load=5,server=3`. Every run gets
a file of its own; a `--quick` or `--only` run never replaces another one.
