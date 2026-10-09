---
id: doc-4
title: Fullstack comparison benchmark
type: specification
created_date: '2026-10-09 04:07'
updated_date: '2026-10-09 05:27'
---
# Fullstack comparison benchmark

**Status:** requested by the user on 2026-10-09. Spec by Lux. Tasks: TASK-110 to TASK-115 (milestone m-8).

**Goal.** Implement the same non-trivial fullstack app three times — **Lumen SSR**, **React Router (framework mode, SSR)** and **Next.js 16 (App Router)** — and compare dev and production metrics with a reproducible harness. Results are stored as JSON and browsed in a static HTML viewer.

## 1. Fairness rules

- **Same app, same output.** Same routes, data, HTML structure, class names and behaviour. One conformance Playwright suite (§5) runs against all three apps; an app is only benchmarked when it passes.
- **Same CSS.** All apps import one shared plain stylesheet (`@bench/ui-css`). No CSS Modules, Tailwind or scoped styles, so CSS bytes are identical and the comparison measures the framework.
- **Same data layer.** All apps call the shared `@bench/data` package (`node:sqlite`, deterministic seed). No ORM, no framework data cache.
- **Idiomatic framework code.** Each app uses its framework's recommended primitives:
  - Lumen: route mode `server`, async components + `Suspense`, form actions, islands (`client:*`) for interactive parts.
  - React Router: loaders/actions, `<Form>`/`useFetcher`, a loader promise + `<Await>` inside `<Suspense>` for streamed data. The whole page hydrates (that is how React Router works).
  - Next.js: server components, server actions, `"use client"` components for interactive parts, async server component inside `<Suspense>`.
- **Dynamic rendering everywhere.** Every page renders on each request. No full-page or data caching (Next: no static prerendering of these routes, no `use cache`; React Router: no prerender; Lumen: mode `server`).
- **Production servers as shipped,** with HTTP compression **off** in all three (Next `compress: false`; React Router served by `@react-router/serve` or an equivalent minimal Node server with compression off; Lumen `adapter-node`). Payload sizes are measured offline with gzip and brotli.
- **Type checking is measured separately**, not inside build time (Next: `typescript.ignoreBuildErrors: true` for the timed build).
- **Latest stable versions** at implementation time (Next.js 16.x, React 19.x, React Router latest stable); exact versions are pinned and recorded in every results file. Node is the repo's Node (≥ 24).
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
  apps/lumen/           Lumen SSR        (Nova)
  apps/react-router/    React Router     (Quasar)
  apps/next/            Next.js 16       (Quasar)
  harness/e2e/          conformance suite (Nova; inside @bench/harness so it resolves @playwright/test)
  harness/              @bench/harness   runner, metrics, results writer (Nova)
  results/              <date>T<time>-<host>.json, index.json (committed)
  viewer/               static HTML viewer (Nova)
```

- Ports: Lumen 4101, React Router 4102, Next 4103 (dev and prod).
- Each app exposes the same scripts: `seed`, `dev`, `build`, `start`, `typecheck`, `clean` (removes build output and framework caches: `.next`, `node_modules/.vite`, `build`, `dist`, `.react-router`, `.lumen`).

## 4. Metrics

Median plus spread (min/max or p95) over N iterations; `--quick` runs one iteration for smoke tests.

**Environment of each metric** (TASK-145). Dev servers (Vite, Turbopack) compile on request and differ a lot from production servers, so every metric says where it was measured:

- `dev`: against each app's dev server (`lumen dev` and `react-router dev` on Vite, `next dev` on Turbopack). Only the **Dev** metrics below.
- `build`: from the production build and the sources: build time, output size on disk (without precompressed `.br`/`.gz` copies), type check, source size, dependency footprint.
- `prod`: against the built apps on their production servers (`start` script: Lumen `node server.ts` on adapter-node, React Router `node server.ts` = Express + @react-router/express, Next `next start`): client payload, page load and every server metric, req/s included.

The harness runs every `start` with `NODE_ENV=production` and checks, on each app's first production start, that the process listening on the port has `NODE_ENV=production` (it stops otherwise) and that `/` is not compressed for a client accepting br and gzip. Each results file records the commands, the dev bundler and these checks.

**Dev**
- Dev server cold start: spawn → first `200` on `/`, caches cleared (`clean`). Warm start: second run without cleaning.
- Dev first page load: first request to `/`, `/projects/:slug` and `/issues/:id` after start (includes on-demand compilation): TTFB and Playwright `load`.
- Dev warm page load: the same, after one prior load.
- HMR: edit a shared component's text, time until the browser DOM shows it.

**Build**
- Production build time (cold, after `clean`).
- Client payload per route: JS and CSS bytes (raw, gzip, brotli) that the browser downloads for the first load of `/`, `/projects/:slug`, `/issues/:id` (measured from Playwright network events, so code splitting is counted as shipped); request count.
- Total client output size and server output size on disk.

**Production page load** (Playwright Chromium, 4× CPU throttling, no network throttling unless a profile flag is passed): TTFB, FCP, LCP, DOMContentLoaded, `load`, total blocking time, and time until interactive (the page sets `window.__benchReady = performance.now()` when its interactive parts are hydrated/attached — each app implements this the same way, documented in the conformance suite).

**Production server**
- Throughput and latency with autocannon (warmup, then 3 × 10 s, 50 connections): `/`, `/projects/:slug?page=3`, `/issues/:id` (streamed), `/api/issues/:id`. Report req/s, p50 and p99 latency, errors.
- Server cold start: spawn → first `200`.
- Server RSS after the load test.

**Other**
- Type check time (`lumen check` with TS 7 vs `tsc --noEmit` / `next typegen && tsc`).
- Source size: lines of code per app (excluding shared packages), files.
- Dependency footprint: number of packages in each app's production dependency tree.

## 5. Conformance suite

`benchmarks/fullstack/harness/e2e`: one Playwright suite parameterised by base URL, run against each app in production mode. It checks every route, status codes, the shared markup landmarks (`data-testid` attributes defined here), filters and pagination, streamed comments, each action (with and without a session), validation errors, the redirect after creating an issue, the 404 page, the JSON endpoints, and each client interaction.

## 6. Results and viewer

- `results/<YYYY-MM-DD>T<HHMMSS>-<host>.json` (UTC start of the run; every run gets its own file, `--quick` and `--only` runs never replace another one):
  ```json
  {
    "schema": 2,
    "meta": { "date": "…", "host": "…", "machine": { "cpu": "…", "cores": 0, "memoryGb": 0, "os": "…" }, "node": "…",
              "versions": { "lumen": "<git sha>", "react": "…", "react-router": "…", "next": "…", "vite": "…" },
              "iterations": { "dev": 5, "build": 3, "load": 5, "server": 3 }, "quick": false,
              "groups": ["dev", "…"], "apps": ["lumen", "…"], "conformance": { "lumen": "pass" }, "notes": ["…"],
              "servers": { "lumen": { "dev": { "command": "lumen dev …", "tool": "Vite 8.3.4", "description": "…" },
                                      "build": { "command": "lumen build" },
                                      "prod": { "command": "NODE_ENV=production node server.ts", "description": "…",
                                                "nodeEnv": "production", "compression": false } } } },
    "results": { "lumen": { "<metric-id>": { "unit": "ms", "values": [], "median": 0, "min": 0, "max": 0 } }, "react-router": {}, "next": {} },
    "metrics": { "<metric-id>": { "label": "…", "group": "dev|build|load|server|other", "env": "dev|build|prod",
                                  "unit": "ms", "better": "lower|higher", "section": "…" } }
  }
  ```
  Schema 1 files (before TASK-145) have no `env` and no `meta.servers`; readers derive `env` from the group (`dev` → dev; `load`, `server` and `payload.*` → prod; the rest → build).
- `results/index.json` lists the files (newest first).
- `viewer/index.html`: a static page with no build step. It loads `results/index.json`, lets you pick a run (and optionally compare two runs). Tabs are grouped and badged by environment: **Development** (dev server), **Production** (build, payload, page load, server) and **Source & tooling**; each tab starts with a line per app on how it is served in that mode (command, bundler, NODE_ENV and compression as checked). Each section is a table and bar chart with the best value highlighted and ratios to the best. Served by `pnpm --filter @bench/harness view`.

## 7. Commands

- `pnpm --filter @bench/harness bench [--quick] [--only lumen,next] [--metrics dev,build,load,server,other]`
- `pnpm --filter @bench/harness conformance`
- `pnpm --filter @bench/harness view`

Full runs happen on a quiet machine (no agents running), together with the TASK-68 js-framework-benchmark rerun (TASK-115).
