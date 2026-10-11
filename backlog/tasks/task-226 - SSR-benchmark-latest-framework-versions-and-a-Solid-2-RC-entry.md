---
id: TASK-226
title: 'SSR benchmark: latest framework versions and a Solid 2 RC entry'
status: To Do
assignee:
  - Nova
created_date: '2026-10-11 01:43'
labels:
  - benchmark
milestone: m-8
dependencies: []
priority: medium
ordinal: 228000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-41 (user 2026-10-11): benchmarks/ssr uses solid-js 1.9.16 (latest 1.9.17); the others are current (React 19.3.0, Svelte 5.57.2, Vue 3.5.43). Bump to the latest stable, and add a 'Solid 2 (RC)' implementation on solid-js@next (2.0.0-rc.14) with its matching compiler, labelled as a pre-release. Check that every implementation still passes scripts/run.ts's output checks. The full run waits for the quiet-machine measurement wave.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every implementation is on its latest stable version, pinned, with versions in RESULTS.md
- [ ] #2 A Solid 2 (RC) implementation renders the same page, passes the output checks, and is labelled as a pre-release
<!-- AC:END -->
