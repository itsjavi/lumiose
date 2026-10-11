---
id: TASK-204
title: 'Fullstack benchmark: Nuxt port'
status: In Progress
assignee:
  - Quasar
created_date: '2026-10-10 22:41'
updated_date: '2026-10-11 02:18'
labels:
  - benchmark
  - positioning
milestone: m-8
dependencies: []
priority: medium
ordinal: 206000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/): the landing's stack comparison table needs measured cells (JS on a server page, payload, time to interactive, server throughput) for Nuxt. Port the issue tracker of doc-4 to Nuxt in benchmarks/fullstack/apps/nuxt, following the React Router and Next.js apps: same routes, data, CSS and behaviour, idiomatic for the framework, measured by the same harness.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 benchmarks/fullstack/apps/nuxt implements the doc-4 app idiomatically and passes the conformance checks
- [x] #2 The harness runs it in every group and the results viewer shows it
- [ ] #3 A committed results run includes it, and doc-4 lists it with versions and caveats
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-11 (decision-41): also bump express in benchmarks/fullstack/apps/react-router from 5.2.1 to 5.3.0, the latest stable, and check every fullstack app is on its framework's latest stable release before the measurement run.

Quasar 2026-10-11: Nuxt 4.6.1 port in benchmarks/fullstack/apps/nuxt (Vue 3.5.43, vue-router 5.4.0, nitropack 2.13.4, Vite 8.3.4; type check nuxt typecheck = vue-tsc 3.3.13 on TS 6.0.3). Registered in harness (apps.ts port 4106, comments: "client"), meta.versions (nuxt, vue, vue-router, nitropack via nuxt>@nuxt/nitro-server; resolvedVersion now follows a chain), .vue counted in source size, viewer --series-6. Nuxt cannot stream a Suspense boundary (renders to string; 4.5's ssrStreaming is experimental and in-order), so comments are useLazyFetch({ server: false }); the conformance suite has a 'client' mode for that (fallback in the shell, no comments in the response). express in apps/react-router bumped 5.2.1 -> 5.3.0 (decision-41), React Router conformance still passes. pnpm-workspace.yaml: allowBuilds esbuild: false, minimumReleaseAgeExclude vue-tsc@3.3.13 and @vue/language-core@3.3.13 (approved by Lux). Checks: conformance 15/15 pass, nuxt typecheck clean, oxlint clean, oxfmt clean, pnpm install --frozen-lockfile clean. Quick pass (bench --quick --only nuxt) ran every group (dev, build, load, server, other), not committed. doc-4 §1-§5 and §8 updated with versions and caveats. Remaining: the quiet-machine full run (AC #3).
<!-- SECTION:NOTES:END -->
