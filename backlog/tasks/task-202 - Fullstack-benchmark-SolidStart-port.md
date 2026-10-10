---
id: TASK-202
title: 'Fullstack benchmark: SolidStart port'
status: To Do
assignee:
  - Quasar
created_date: '2026-10-10 22:40'
labels:
  - benchmark
  - positioning
milestone: m-8
dependencies: []
priority: medium
ordinal: 204000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/): the landing's stack comparison table needs measured cells (JS on a server page, payload, time to interactive, server throughput) for SolidStart. Port the issue tracker of doc-4 to SolidStart in benchmarks/fullstack/apps/solid-start, following the React Router and Next.js apps: same routes, data, CSS and behaviour, idiomatic for the framework, measured by the same harness.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 benchmarks/fullstack/apps/solid-start implements the doc-4 app idiomatically and passes the conformance checks
- [ ] #2 The harness runs it in every group and the results viewer shows it
- [ ] #3 A committed results run includes it, and doc-4 lists it with versions and caveats
<!-- AC:END -->
