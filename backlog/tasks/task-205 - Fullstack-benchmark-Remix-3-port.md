---
id: TASK-205
title: 'Fullstack benchmark: Remix 3 port'
status: Done
assignee:
  - Quasar
created_date: '2026-10-10 22:41'
updated_date: '2026-10-12 13:24'
labels:
  - benchmark
  - positioning
milestone: m-8
dependencies: []
priority: medium
ordinal: 207000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/): the landing's stack comparison table needs measured cells (JS on a server page, payload, time to interactive, server throughput) for Remix 3. Port the issue tracker of doc-4 to Remix 3 in benchmarks/fullstack/apps/remix, following the React Router and Next.js apps: same routes, data, CSS and behaviour, idiomatic for the framework, measured by the same harness.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 benchmarks/fullstack/apps/remix implements the doc-4 app idiomatically and passes the conformance checks
- [x] #2 The harness runs it in every group and the results viewer shows it
- [x] #3 A committed results run includes it, and doc-4 lists it with versions and caveats
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Quasar 2026-10-11: Remix 3 port in benchmarks/fullstack/apps/remix, from the `remix new` starter layout (remix 3.0.0: @remix-run/component, fetch-router, assets 1.0.0; TypeScript 7.0.2 tsc). Route maps + controllers, context.render pages, native POST forms with 303/400, clientEntry for search box, bulk-select bar, comment composer and label picker, <Frame src fallback> for the streamed comments (HTML streamed in the same response), loadCurrentUser/requireUser middleware, remix/cookie session. Production: node --import remix/node-tsx server.ts, asset server minify + fingerprint, no compression. No build step: harness App.build = false skips build time and output sizes (with a results note). Dev: the starter's hmr.ts. Registered in harness (port 4107), meta.versions (remix, @remix-run/component), viewer --series-7 (also fixed the dark-theme series-6 token I had misplaced in the Nuxt commit). Conformance: two waits for routers that commit the URL before rendering (search results visible, filtered page count polled). Checks: conformance 15/15 (5 runs), tsc clean, oxlint clean, oxfmt clean, frozen lockfile OK. Quick pass ran every group (build group records the no-build note), not committed. doc-4 §1-§4 and §8 updated. Also made Nuxt's status select a v-model after one flaky status-form run. Remaining: the quiet-machine full run (AC #3).

Lux 2026-10-12: included in the quiet-machine fullstack run results/2026-10-12T114559-macbookpro.json (fd2723b); all 8 apps passed conformance. doc-4 §8 lists versions and caveats.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Remix 3 port measured in the 2026-10-12 quiet-machine run (TASK-235): home 843 req/s, issue page 42 kB JS (brotli), 41 runtime deps; no build step.
<!-- SECTION:FINAL_SUMMARY:END -->
