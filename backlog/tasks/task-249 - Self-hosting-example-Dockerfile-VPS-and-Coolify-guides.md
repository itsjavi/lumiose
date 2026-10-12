---
id: TASK-249
title: 'Self-hosting: example Dockerfile, VPS and Coolify guides'
status: Done
assignee:
  - Beacon
created_date: '2026-10-12 18:39'
updated_date: '2026-10-12 20:23'
labels:
  - adapter
  - docs
milestone: m-9
dependencies: []
priority: high
ordinal: 251000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-12: self-hosted VPS and Coolify are first-class targets. An example multi-stage Dockerfile (production deps only, non-root, healthcheck); a VPS guide (Node adapter under systemd or pm2, Caddy or nginx in front, compression, immutable caching of hashed assets); a Coolify guide (deploy from the Dockerfile).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The example Dockerfile builds and serves an example app in a local test
- [x] #2 VPS and Coolify docs pages with copy-paste config; listed in the deploy verification table
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: reassigned Nova -> Beacon (doc-heavy; Nova overloaded). Beacon may create its example app under examples/.

Beacon 2026-10-12: started. Plan: Dockerfile + .dockerignore + local docker test script in an SSR example; docs/deploy/ section (README with verification table, docker.md, vps.md, coolify.md); README nav + docs generator registration.

Beacon 2026-10-12, implementation:
- Example: examples/ssr-bookshelf/Dockerfile (4 stages: rust:1.98.1-slim-bookworm compiles lumiose_napi without LTO, because the monorepo has no Linux binding; node:24-bookworm-slim runs pnpm install --filter "@lumiose-examples/ssr-bookshelf...", seeds a throwaway DB (genre pages are prerendered from it) and lumiose build; node:24-alpine prod-deps with --prod --filter-prod; node:24-alpine runtime with tini, USER node, /data for the DB, HEALTHCHECK via node fetch on HEALTHCHECK_PATH=/api/me). Build context is the repo root, so the ignore file is examples/ssr-bookshelf/Dockerfile.dockerignore (BuildKit's per-Dockerfile ignore file; a plain .dockerignore there would not apply). Only new files; no edits to the sample's src or README (Nova-routes).
- Local test: examples/ssr-bookshelf/e2e/docker-smoke.ts (typechecked with the sample, not matched by Vitest or Playwright, skips without Docker or with CI set, never wired into CI).
- Docs: new Deploy section packages/lumiose/docs/deploy/ (README with production settings and the verification table, docker.md, vps.md, coolify.md); docs/README.md Deploy list; lumiose docs: deploy/ in the section order, and a section name resolves to its README (lumiose docs deploy); docs test requires deploy pages in the index; website nav test lists Deploy. Platform rows (Cloudflare, Vercel, Netlify) are in the table as Planned for Nova-adapters to fill.
- Decision (build stage on Debian): published compiler binaries are linux x64/arm64 gnu and x64 musl only, so an Alpine build stage fails on arm64; build on node:24-slim, run on node:24-alpine.

Evidence (Docker 29.8.2, Docker Desktop, linux/arm64, 8 CPUs):
- docker-smoke.ts against a clean HEAD snapshot + the new files: 20/20 checks ok (healthy, seeds /data, GET / 200 br-compressed and streamed, DB query, POST /login 303 + session cookie, /about and /genres/biography prerendered with revalidate headers, hashed assets immutable and served from .br, /api/me, uid 1000, no vite/cli/compiler in the image, docker stop in ~140 ms). Cold build 1m15s (Rust 52 s), cached 10 s. Image 242 MB.
- The working tree's build failed to prerender routes while TASK-253's route scanner WIP was in progress (only 404.html); the test was run on a git-archive snapshot of HEAD instead.
- docs Dockerfile on a create-lumiose@0.2.0 ssr project from npm: builds (pnpm 11, linux-arm64-gnu binding), healthy, br pages, immutable assets, uid 1000, stop <1 s; packageManager field switches pnpm to that version.
- Caddy 2.11 and nginx 1.31 configs extracted from vps.md (domain -> localhost, Caddy local CA / self-signed cert): HTTP->HTTPS redirect, HTTP/2, streaming shell at 20-70 ms vs 1.5 s total, br/gzip passed through unchanged also with Caddy encode / nginx gzip on, immutable assets, same-origin login 303, cross-site 403; nginx -t ok; nginx streams with default proxy_buffering too.
- systemd unit: ran under systemd 252 in a privileged Debian 12 container (active, 200, clean stop); systemd-analyze verify ok. pm2 6.0.14 fork mode: works only with interpreter: node (pm2 6 maps .ts to bun), inherits shell env, save/resurrect keeps it.
- Coolify: not deployed (no instance used); guide follows Coolify v4 docs (Dockerfile build pack, health checks, env var scopes, persistent storage) fetched 2026-10-12.

Beacon 2026-10-12: committed 84549e5. Checks: docs tests and website content tests green (31), docs:check green, lumiose check of the sample green, oxfmt/oxlint clean on the changed files. pnpm check stops at fmt:examples on examples/spa-dotmatrix/src/routes/learn/page.stsx (TASK-253 rename in progress, not mine); pnpm test has 3 failures outside this task (vite options.test 'unknown option' list, create.test minimal/spa templates: in-progress adapter option and route renames). Note: commit 94e8629 (TASK-247) picked up this task's README Deploy list before the deploy pages were committed; 84549e5 adds them. Rerun the smoke test once TASK-253 lands (its scanner WIP broke prerendering in a working-tree build).

Beacon 2026-10-12: after TASK-253 landed (f0074db), docker-smoke.ts against the working tree (with Nova-adapters' TASK-248/175 WIP present): 20/20 checks ok, 15 files prerendered, build 16 s cached, stop 133 ms. The Dockerfile needed no change for the new route file names.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Self-hosting is documented and the Docker path is tested. New docs section packages/lumiose/docs/deploy/: README (what to deploy, production env vars, a verification table with statuses Verified on the platform / Tested locally / Not tested / Planned, and Planned rows for Cloudflare, Vercel and Netlify), docker.md (multi-stage Dockerfile: node:24-slim build, node:24-alpine prod deps and runtime, non-root, tini, HEALTHCHECK), vps.md (systemd unit, pm2 ecosystem file, Caddy and nginx configs, what adapter-node already does for compression and immutable caching, ORIGIN behind a proxy), coolify.md (Dockerfile build pack, port, domain, ORIGIN and runtime-only secrets, image health check, persistent storage). The bookshelf sample has a monorepo Dockerfile (Rust binding stage, workspace filters, seeded build DB) and e2e/docker-smoke.ts, a local-only test (20 checks green). Verified locally: both Dockerfiles, Caddy and nginx with TLS, systemd and pm2; Coolify not deployed. lumiose docs deploy prints the section index.
<!-- SECTION:FINAL_SUMMARY:END -->
