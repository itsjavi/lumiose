---
id: TASK-249
title: 'Self-hosting: example Dockerfile, VPS and Coolify guides'
status: In Progress
assignee:
  - Beacon
created_date: '2026-10-12 18:39'
updated_date: '2026-10-12 20:01'
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
- [ ] #1 The example Dockerfile builds and serves an example app in a local test
- [ ] #2 VPS and Coolify docs pages with copy-paste config; listed in the deploy verification table
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
<!-- SECTION:NOTES:END -->
