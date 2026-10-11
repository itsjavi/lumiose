---
id: doc-4
title: Fullstack comparison benchmark
type: specification
created_date: '2026-10-09 04:07'
updated_date: '2026-10-11 02:35'
---
# Fullstack comparison benchmark

**Status:** requested by the user on 2026-10-09. Spec by Lux. Tasks: TASK-110 to TASK-115 (milestone m-8). More stacks for the landing's comparison table (decision-37): TASK-202 (SolidStart), TASK-203 (SvelteKit), TASK-204 (Nuxt), TASK-205 (Remix 3).

**Goal.** Implement the same non-trivial fullstack app three times — **Lumiose SSR**, **React Router (framework mode, SSR)** and **Next.js 16 (App Router)**, later also **SolidStart**, **SvelteKit**, **Nuxt** and **Remix 3** (§8) — and compare dev and production metrics with a reproducible harness. Results are stored as JSON and browsed in a static HTML viewer.

## 1. Fairness rules

- **Same app, same output.** Same routes, data, HTML structure, class names and behaviour. One conformance Playwright suite (§5) runs against every app; an app is only benchmarked when it passes.
- **Same CSS.** All apps import one shared plain stylesheet (`@bench/ui-css`). No CSS Modules, Tailwind or scoped styles, so CSS bytes are identical and the comparison measures the framework.
- **Same data layer.** All apps call the shared `@bench/data` package (`node:sqlite`, deterministic seed). No ORM, no framework data cache.
- **Idiomatic framework code.** Each app uses its framework's recommended primitives:
  - Lumiose: route mode `server`, async components + `Suspense`, form actions, islands (`client:*`) for interactive parts.
  - React Router: loaders/actions, `<Form>`/`useFetcher`, a loader promise + `<Await>` inside `<Suspense>` for streamed data. The whole page hydrates (that is how React Router works).
  - Next.js: server components, server actions, `"use client"` components for interactive parts, async server component inside `<Suspense>`.
  - SolidStart: file routes, `query` + `createAsync` server functions (`"use server"`) with route `preload`, `action`s with `<form action>` and `useSubmission`, a non-deferred `createAsync` inside `<Suspense>` for streamed data. The whole page hydrates (SolidStart's islands mode is not supported yet).
  - SvelteKit: `+page.server.ts` loads and form actions with `use:enhance`, the session in `hooks.server.ts` (`locals.user`), and an un-awaited load promise rendered with `{#await}` for streamed data. The whole page hydrates.
  - Nuxt: file-based pages with `useFetch` from Nitro server routes (`server/api`), mutations with `$fetch` to server routes followed by `refresh`/`refreshNuxtData`, `<NuxtLink>` for navigation, and `useLazyFetch(…, { server: false })` for the slow comments, since Nuxt cannot stream a Suspense boundary (§8). The whole page hydrates.
  - Remix 3: route maps and controllers (`remix/router`), pages rendered with `context.render` (`remix/component`), native forms posting to POST actions that redirect (303) or render again with errors (400), `clientEntry` components for the interactive parts, and a `<Frame>` with a fallback for streamed data. The browser runtime turns links and forms into frame navigations.
- **Dynamic rendering everywhere.** Every page renders on each request. No full-page or data caching (Next: no static prerendering of these routes, no `use cache`; React Router: no prerender; Lumiose: mode `server`).
- **Production servers as shipped,** with HTTP compression **off** in every app (Next `compress: false`; React Router served by `@react-router/serve` or an equivalent minimal Node server with compression off; Lumiose `adapter-node`; SolidStart and Nuxt on Nitro's `node-server` output, which does not compress; SvelteKit on adapter-node with `precompress: false`; Remix 3 on `remix/node-fetch-server` without the compression middleware). Payload sizes are measured offline with gzip and brotli.
- **Type checking is measured separately**, not inside build time (Next: `typescript.ignoreBuildErrors: true` for the timed build).
- **Latest stable versions** (decision-41): every framework uses its latest stable version that is compatible with the rest of its stack, pinned exactly; §8 records each version and why an older one is used. Results files record the resolved versions. Node is the repo's Node (≥ 24).
- **Same machine, sequential runs,** nothing else heavy running. Every results file records the machine.

## 2. The app: "Tracker" (an issue tracker)

### Data (`@bench/data`)

- `node:sqlite`, one DB file per app run (`TRACKER_DB` env var, default `<app>/.data/tracker.db`, gitignored). `seed(path)` rebuilds it deterministically (fixed PRNG seed): 200 users, 12 projects, 6,000 issues (title, ~500-char body, status `open|in_progress|closed`, priority `low|medium|high|urgent`, 0–3 of 15 labels, assignee, reporter, created/updated timestamps), 30,000 comments.
- Synchronous query API (shared by all apps):
  - `getDashboard()` → counts by status and priority, open issues per project, 10 most recently updated issues.
  - `listProjects()`, `getProject(slug)`.
  - `listIssues({ projectSlug?, status?, priority?, label?, q?, sort: "updated" | "created" | "priority", page, pageSize = 50 })` → `{ items, total }`.
  - `getIssue(id)` with labels, assignee and reporter.
  - `listComments(issueId)` (async: returns a promise; awaits `COMMENTS_DELAY_MS`, default 0, so the harness can model slow data for streaming).
  - `searchIssues(q, limit = 20)`.
  - `createIssue(input, userId)`, `updateIssueStatus(id, status, userId)`, `addComment(issueId, body, userId)`, `closeIssues(ids, userId)`.
  - `validateIssue(input)` → `{ ok: true, value } | { ok: false, errors: Record<field, string> }` (hand-written, no schema library, shared by all apps).
  - `getUserByName(name)`, `getUser(id)`.
- Session: cookie `uid=<userId>` (unsigned; this is a benchmark). `POST /login` with a username sets it; `POST /logout` clears it.

### Routes

All pages share a layout: header with nav and the current user (or a "Log in" link), a sidebar listing the 12 projects with open-issue counts, and a footer.

| Route | Content | Interactivity |
|---|---|---|
| `/` | Dashboard: status and priority stat cards, per-project table, 10 recent issues | none |
| `/projects/:slug` | Filter form (GET: status, priority, label, sort, q), table of 50 issues, pagination links, total count | **Bulk select** (client): row checkboxes, "N selected", "Close selected" posts an action, then the list refreshes |
| `/issues/:id` | Issue header, body, labels, sidebar (assignee, reporter, dates), status form (action). Comments list **streamed** behind a Suspense fallback | **Comment composer** (client): textarea with a live character count, submit posts an action and the new comment appears |
| `/issues/new` | New issue form (title, body, project, priority, labels); server validation re-renders field errors; success redirects to `/issues/:id` | **Label picker** (client): toggle chips that fill a hidden input |
| `/search?q=` | Search results (server) | **Search box** (client): debounced suggestions from `GET /api/search?q=` |
| `/login` | Username form; POST sets the cookie and redirects to `/` | none |
| `/api/issues/:id` | JSON of `getIssue(id)` | — |
| `/api/search?q=` | JSON of `searchIssues(q, 8)` | — |
| anything else | 404 page inside the layout, status 404 | — |

Mutating actions require a session; without one they redirect to `/login`.

## 3. Layout and ownership

```
benchmarks/fullstack/
  packages/data/        @bench/data      (Quasar)
  packages/ui-css/      @bench/ui-css    (Quasar)
  packages/react-ui/    @bench/react-ui  shared presentational React components (Quasar)
  apps/lumiose/           Lumiose SSR        (Nova)
  apps/react-router/    React Router     (Quasar)
  apps/next/            Next.js 16       (Quasar)
  apps/solid-start/     SolidStart 2     (Quasar)
  apps/sveltekit/       SvelteKit 3      (Quasar)
  apps/nuxt/            Nuxt 4           (Quasar)
  apps/remix/           Remix 3          (Quasar)
  harness/e2e/          conformance suite (Nova; inside @bench/harness so it resolves @playwright/test)
  harness/              @bench/harness   runner, metrics, results writer (Nova)
  results/              <date>T<time>-<host>.json, index.json (committed)
  viewer/               static HTML viewer (Nova)
```

- Ports: Lumiose 4101, React Router 4102, Next 4103, SolidStart 4104, SvelteKit 4105, Nuxt 4106, Remix 3 4107 (dev and prod).
- Each app exposes the same scripts: `seed`, `dev`, `build`, `start`, `typecheck`, `clean` (removes build output and framework caches: `.next`, `node_modules/.vite`, `build`, `dist`, `.react-router`, `.lumiose`, `.output`, `.nuxt`, `node_modules/.nitro`).

## 4. Metrics

Median plus spread (min and max; the viewer draws them as whiskers and highlights a range wider than 25% of the median) over N iterations; `--quick` runs one iteration for smoke tests.

**Environment of each metric** (TASK-145). Dev servers (Vite, Turbopack) compile on request and differ a lot from production servers, so every metric says where it was measured:

- `dev`: against each app's dev server (`lumiose dev`, `react-router dev`, SolidStart's and SvelteKit's `vite dev` and `nuxt dev` on Vite, `next dev` on Turbopack, Remix 3's `node hmr.ts` on its own asset server). Only the **Dev** metrics below.
- `build`: from the production build and the sources: build time, output size on disk (without precompressed `.br`/`.gz` copies), type check, source size, dependency footprint.
- `prod`: against the built apps on their production servers (`start` script: Lumiose `node server.ts` on adapter-node, React Router `node server.ts` = Express + @react-router/express, Next `next start`, SolidStart `node .output/server/index.mjs` on Nitro, SvelteKit `node build` on adapter-node, Nuxt `node .output/server/index.mjs` on Nitro, Remix 3 `node --import remix/node-tsx server.ts`): client payload, page load and every server metric, req/s included.

The harness runs every `start` with `NODE_ENV=production` and checks, on each app's first production start, that the process listening on the port has `NODE_ENV=production` (it stops otherwise) and that `/` is not compressed for a client accepting br and gzip. Each results file records the commands, the dev bundler and these checks.

**Dev**
- Dev server cold start: spawn → first `200` on `/`, caches cleared (`clean`). Warm start: second run without cleaning.
- Dev first page load: first request to `/`, `/projects/:slug` and `/issues/:id` after start (includes on-demand compilation): TTFB and Playwright `load`.
- Dev warm page load: the same, after one prior load.
- HMR: edit a shared component's text, time until the browser DOM shows it.

**Build**
- Production build time (cold, after `clean`). Not recorded for an app without a build (`build: false` in `harness/src/apps.ts`: Remix 3), and neither are its output sizes; the results notes say so.
- Client payload per route: JS and CSS bytes (raw, gzip, brotli) that the browser downloads for the first load of `/`, `/projects/:slug`, `/issues/:id` (measured from Playwright network events, so code splitting is counted as shipped); request count.
- Total client output size and server output size on disk.

**Production page load** (Playwright Chromium, 4× CPU throttling, no network throttling unless a profile flag is passed): TTFB, FCP, LCP, DOMContentLoaded, `load`, total blocking time, and time until interactive (the page sets `window.__benchReady = performance.now()` when its interactive parts are hydrated/attached — each app implements this the same way, documented in the conformance suite).

**Production server**
- Throughput and latency with autocannon (warmup, then 3 × 10 s, 50 connections): `/`, `/projects/:slug?page=3`, `/issues/:id` (streamed), `/api/issues/:id`. Report req/s, p50 and p99 latency, errors.
- **Interleaved rounds (TASK-154).** All apps' production servers run at once (each on its own port). Cold starts and, per route, the load-test rounds are interleaved across apps with the order rotated each round (A B C, B C A, C A B), so a transient load spike on the machine cannot land on one framework's rounds. Each round starts after a cool-down (3 s; 0.5 s with `--quick`) and an idle check: wait until the 1-minute load average is at most 0.5 per core, for up to 60 s (5 s with `--quick`). A round that still starts on a busy machine runs anyway and is listed in the results notes.
- Server cold start: spawn → first `200`.
- Server RSS after the load test.

**Other**
- Type check time (`lumiose check` with TS 7 vs `tsc --noEmit` / `next typegen && tsc` / `tsc` for SolidStart / `svelte-kit sync && svelte-check --tsgo` for SvelteKit / `nuxt typecheck` (vue-tsc) for Nuxt / `tsc` for Remix 3).
- Source size: lines of code per app (excluding shared packages), files. `.svelte` and `.vue` files count as code.
- Dependency footprint: number of packages in each app's production dependency tree.

## 5. Conformance suite

`benchmarks/fullstack/harness/e2e`: one Playwright suite parameterised by base URL, run against each app in production mode. It checks every route, status codes, the shared markup landmarks (`data-testid` attributes defined here), filters and pagination, streamed comments (with `COMMENTS_DELAY_MS` > 0 the fallback must be in the shell and the comments must arrive later in the same response, as markup or, for SvelteKit, as streamed data; an app registered with `comments: "client"` in `harness/src/apps.ts`, Nuxt only, must instead render the fallback on the server and load the comments on the client, with no comments in the response), each action (with and without a session), validation errors, the redirect after creating an issue, the 404 page, the JSON endpoints, and each client interaction.

## 6. Results and viewer

- `results/<YYYY-MM-DD>T<HHMMSS>-<host>.json` (UTC start of the run; every run gets its own file, `--quick` and `--only` runs never replace another one):
  ```json
  {
    "schema": 2,
    "meta": { "date": "…", "host": "…", "machine": { "cpu": "…", "cores": 0, "memoryGb": 0, "os": "…" }, "node": "…",
              "versions": { "lumiose": "<git sha>", "react": "…", "react-router": "…", "next": "…", "vite": "…" },
              "iterations": { "dev": 5, "build": 3, "load": 5, "server": 3 }, "quick": false,
              "groups": ["dev", "…"], "apps": ["lumiose", "…"], "conformance": { "lumiose": "pass" }, "notes": ["…"],
              "servers": { "lumiose": { "dev": { "command": "lumiose dev …", "tool": "Vite 8.3.4", "description": "…" },
                                      "build": { "command": "lumiose build" },
                                      "prod": { "command": "NODE_ENV=production node server.ts", "description": "…",
                                                "nodeEnv": "production", "compression": false } } } },
    "results": { "lumiose": { "<metric-id>": { "unit": "ms", "values": [], "median": 0, "min": 0, "max": 0 } }, "react-router": {}, "next": {} },
    "metrics": { "<metric-id>": { "label": "…", "group": "dev|build|load|server|other", "env": "dev|build|prod",
                                  "unit": "ms", "better": "lower|higher", "section": "…" } }
  }
  ```
  Schema 1 files (before TASK-145) have no `env` and no `meta.servers`; readers derive `env` from the group (`dev` → dev; `load`, `server` and `payload.*` → prod; the rest → build).
- `results/index.json` lists the files (newest first).
- `viewer/index.html`: a static page with no build step. It loads `results/index.json`, lets you pick a run (and optionally compare two runs). Tabs are grouped and badged by environment: **Development** (dev server), **Production** (build, payload, page load, server) and **Source & tooling**; each tab starts with a line per app on how it is served in that mode (command, bundler, NODE_ENV and compression as checked). Each section is a table and bar chart with the best value highlighted and ratios to the best. Served by `pnpm --filter @bench/harness run view` (`run` is needed: `pnpm view` is a built-in command).

## 7. Commands

- `pnpm --filter @bench/harness bench [--quick] [--only lumiose,next] [--metrics dev,build,load,server,other]`
- `pnpm --filter @bench/harness conformance`
- `pnpm --filter @bench/harness run view`

Full runs happen on a quiet machine (no agents running), together with the TASK-68 js-framework-benchmark rerun (TASK-115).

## 8. Other stacks: versions and caveats

Ports for the landing's stack comparison (decision-37), registered in the harness (`harness/src/apps.ts`) and the viewer. Versions follow decision-41.

### SolidStart (TASK-202, `apps/solid-start`, port 4104)

- **Versions:** `@solidjs/start` 2.0.6, `solid-js` 1.9.17, `@solidjs/router` 1.0.0, `@solidjs/meta` 0.29.4, `nitro` 3.0.260903-beta, Vite 8.3.4, TypeScript 7.0.2 (`tsc` type check). Solid 2 is release-candidate only and SolidStart 2 does not support it, so Solid stays on 1.9 (decision-41).
- **Server:** `vite build` with SolidStart's plugin and `nitro({ preset: "node-server" })`, as in the official SolidStart 2 templates; production is `node .output/server/index.mjs`. Nitro 3 is only published as a beta, but it is the deployment path SolidStart 2 documents. It does not compress responses (`compressPublicAssets` is off by default) and serves `/_build/assets` as immutable.
- **Data and mutations:** `query` functions are server functions, called in process during SSR and over `/_server` on client navigations; `action`s replace the `/login` and `/logout` POST routes and the form posts of the other apps (the conformance suite only drives the forms). Every action revalidates the page's queries in the same response (SolidStart's single-flight mutations). The session cookie is read from the request event (`getRequestEvent()`), not the HTTP event, so the single-flight render after login sees the new cookie. `query` dedupes calls within a request and reuses a client-side result for up to 5 s between a preload (link hover) and the navigation; that is the router's request deduplication, not a data cache, and every page request still reads the database.
- **Streaming:** page data uses `createAsync(…, { deferStream: true })`, so the shell, status code and `<title>` wait for it, like a React Router loader; the comments are a non-deferred `createAsync` inside `<Suspense>` and stream after the shell.
- **Interactive parts:** the whole page hydrates. GET forms (filters, search) are plain HTML forms (Solid Router only intercepts POST forms), so they reload the page where React Router navigates on the client. Links are plain `<a>` (the router intercepts them); `<A>` would add `active`/`inactive` classes and change the markup.
- **Readiness:** `onMount` in a `BenchReady` component rendered after the page inside the root `<Suspense>`, so it runs once the lazily loaded route has hydrated.
- **Workspace caveat:** `benchmarks/ssr` pinned `solid-js` 1.9.16 when the app was added, and pnpm first reused it for `@solidjs/start`, giving the app two Solid runtimes (broken router context). The lockfile now resolves the app's whole tree to 1.9.17 (`pnpm update solid-js --depth Infinity` on the app).
- **Shared code:** the app has its own Solid components (no shared UI package), written from `@bench/react-ui` with the same elements, classes and `data-testid`s, so its source size counts them all.

### SvelteKit (TASK-203, `apps/sveltekit`, port 4105)

- **Versions:** `@sveltejs/kit` 3.0.1, `svelte` 5.57.2, `@sveltejs/adapter-node` 6.0.0, `@sveltejs/vite-plugin-svelte` 7.3.1, Vite 8.3.4, `svelte-check` 4.7.6. Type check: `svelte-kit sync && svelte-check --tsgo`, which needs TypeScript 6.0.3 (`typescript`, for svelte-check and SvelteKit's peer range) next to TypeScript 7.0.2 (`@typescript/native`, which does the check), as svelte-check documents. Svelte's experimental async mode and SvelteKit's experimental remote functions stay off: only stable features.
- **Server:** adapter-node, production is `node build`. `precompress: false`, since the adapter otherwise serves brotli/gzip copies of the client assets. adapter-node assumes `https` for the request origin unless a proxy header says otherwise, which fails the CSRF check of form actions on plain http, so `paths.origin` is `http://127.0.0.1:4105` (`ORIGIN` overrides it at build time).
- **Streaming:** SvelteKit streams load promises as data after the page, not as HTML: the shell carries the `{#await}` fallback and the client renders the comments when the data arrives (no JS, no comments). The conformance suite accepts that (§5). The other apps stream HTML.
- **Data and mutations:** form actions everywhere (`?/close`, `?/status`, `?/comment`, `/login`, `/logout`), enhanced with `use:enhance`, which reloads the page's data after each one. The bulk close posts to `?<current query>&/close`, since a bare `?/close` would drop the filters. GET forms (filters, search) become client-side navigations through SvelteKit's router, as in React Router.
- **Readiness:** `afterNavigate` in the root layout, which SvelteKit calls once the app has hydrated.
- **Dependencies:** every package is a devDependency, as `sv create` sets it up: adapter-node bundles them into `build/`, which runs without `node_modules`. The "production dependency packages" metric therefore reads 0. SolidStart's Nitro output is self-contained too, but its template lists packages as dependencies (177). The metric follows each template's package.json, not what the server needs at run time.
- **Shared code:** its own Svelte components (one per file), written from `@bench/react-ui` with the same elements, classes and `data-testid`s.

### Nuxt (TASK-204, `apps/nuxt`, port 4106)

- **Versions:** `nuxt` 4.6.1, `vue` 3.5.43, `vue-router` 5.4.0, `nitropack` 2.13.4 (through `@nuxt/nitro-server`), Vite 8.3.4. Type check: `nuxt typecheck`, which runs `vue-tsc` 3.3.13 on TypeScript 6.0.3: vue-tsc needs TypeScript's JS API, which TypeScript 7 does not have. Nuxt 4.5's `experimental.ssrStreaming` and other experimental flags stay off: only stable features.
- **Server:** `nuxt build` with Nitro's `node-server` preset; production is `node .output/server/index.mjs`. Nitro does not compress responses, and `compressPublicAssets` is off. The server output carries its own traced `node_modules` (Vue, unhead, devalue, …) and source maps, which count in its size on disk.
- **Data and mutations:** pages read their data with `useFetch` from Nitro server routes (`/api/dashboard`, `/api/projects/:slug/issues`, `/api/issues/:id`, …), the documented Nuxt pattern: during SSR the call goes to the route in process (no HTTP), and the result is serialized into the page for hydration; on client navigations it is a request. The layout reads `/api/me` and `/api/projects` the same way, so each page render makes three in-process route calls. Mutations post JSON with `$fetch` to server routes (`/api/login`, `/api/issues`, `/api/issues/:id/status`, …) and refetch with `refresh`/`refreshNuxtData`; without a session a route answers 401 and the page navigates to /login. Nuxt has no form actions, so the forms need JavaScript, where the other apps also work without it. GET forms (filters, search) become client-side navigations, as in React Router and SvelteKit. The search page asks `/api/search` for 20 results (`limit=20`); the JSON endpoint's default stays 8.
- **Streaming:** Nuxt renders pages to a string, and Vue's server renderer waits for async components rather than streaming a Suspense fallback (Nuxt 4.5's experimental streaming sends the body in order, so a slow component still holds back everything after it). The comments are therefore a `useLazyFetch(…, { server: false })`: the server renders the fallback and the client fetches the comments after hydration. The conformance suite checks that for this app (`comments: "client"`, §5). The issue page's server cost leaves out the comments query, but its time to interactive includes a second request.
- **Interactive parts:** the whole page hydrates. Links are `<NuxtLink>`, which prefetches the code of linked pages when they scroll into view (the default, as Next's `<Link>`), so those chunks count in the client payload; it also adds `router-link-active` classes.
- **Readiness:** a client plugin sets the mark on `app:suspense:resolve`, which Nuxt calls once the app has hydrated.
- **Dev:** `nuxt dev` with Nuxt DevTools on, as `nuxi init` sets it up; `NUXT_TELEMETRY_DISABLED=1` and `telemetry: false`.
- **Shared code:** its own Vue components (one per file), written from `@bench/react-ui` with the same elements, classes and `data-testid`s.

### Remix 3 (TASK-205, `apps/remix`, port 4107)

- **Versions:** `remix` 3.0.0 (one package; its parts are `@remix-run/component` 1.0.0, `@remix-run/fetch-router` 1.0.0, `@remix-run/assets` 1.0.0, …), TypeScript 7.0.2 (`tsc`). Remix 3 is its own stack, not React Router, and does not use React.
- **Layout:** as `remix new` generates it: `server.ts` on `remix/node-fetch-server`, `app/routes.ts` (the route map), `app/router.ts` (middleware and controllers), controllers under `app/actions/`, browser code in `public/` directories next to its owner, and `app/assets.ts` for the asset server. `hmr.ts` is the starter's live-update dev server, used as the `dev` script.
- **No build step:** production runs the TypeScript sources with `node --import remix/node-tsx server.ts`, and the asset server compiles browser modules and CSS on request: minified, with content-fingerprinted URLs (`fingerprint: true`, immutable caching) as the asset docs recommend for production, and cached in memory. So the `build` script is a no-op, build time and output sizes are not recorded (§4), and the first request for each module after a start pays its compilation (the page-load median absorbs it). The server process also holds that cache, which shows in its RSS.
- **Unbundled browser modules:** the asset server serves ES modules one per file, with an import map and `modulepreload` links, so a first load makes about 50 requests where the bundling apps make 10 to 20.
- **Interactive parts:** only the client entries hydrate: the search box, the bulk-select bar, the comment composer and the label picker. The browser runtime (`run()` in `app/actions/public/entry.ts`) loads on every page and turns same-origin links and forms into frame navigations through the Navigation API: it fetches the destination's HTML and reconciles the document. It commits the URL before the new page arrives, so the conformance suite waits for the content rather than the URL alone. The bulk-select bar is the smallest boundary: it follows the server-rendered row checkboxes through its form's `change` events.
- **Data and mutations:** controllers call `@bench/data` and render pages with `context.render`. Native forms post to POST actions, which redirect with 303 or render the form again with status 400, so every form also works without JavaScript. The current user comes from a middleware (`context.currentUser`), and a `requireUser()` action middleware redirects mutations to /login. The session cookie uses `remix/cookie`, which base64-encodes the value (`uid=MTI=` for user 12).
- **Streaming:** the comments are their own route (`/issues/:id/comments`) rendered into the page by `<Frame src fallback>`: the render middleware resolves the frame through the router while the page streams, and sends the comments' HTML later in the same response.
- **Readiness:** `entry.ts` sets the mark after `app.ready()`, which resolves once the page's client entries have hydrated.
- **Shared code:** its own components (`app/ui/`, the pages and the client entries), written from `@bench/react-ui` with the same elements, classes and `data-testid`s. The shared stylesheet is served through the asset server, which mounts `packages/ui-css`.
