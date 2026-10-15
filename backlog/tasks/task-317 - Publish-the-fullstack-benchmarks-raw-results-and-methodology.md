---
id: TASK-317
title: Publish the fullstack benchmark's raw results and methodology
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 04:02'
updated_date: '2026-10-15 05:56'
labels:
  - performance
  - benchmark
milestone: m-11
dependencies: []
priority: medium
ordinal: 319000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-55: a site page with the fullstack comparison's methodology (doc-4), its raw results files and viewer, the implementations of each framework, and how to reproduce a run. The site's existing claims stay as they are.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The site publishes the methodology, raw results, viewer and implementations
- [x] #2 The page explains how to reproduce a run
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (batch 3): started.

Done. New site page /benchmarks/fullstack-comparison (apps/web/src/routes/benchmarks/fullstack-comparison/page.stsx): the methodology written for readers from doc-4 (apps/web/src/content/fullstack-method.md: the Tracker app and its routes, the fairness rules, what is measured in dev/build/prod), the implementations (apps/web/src/content/fullstack.ts: each stack's approach, the versions and production server commands the newest run recorded, a link to each app's source), every committed results file newest first (machine, Node, metric groups, apps, quick flag, links to the JSON served next to the viewer and on GitHub, plus index.json), the results viewer (already published at /benchmarks/fullstack/ by scripts/site.ts; linked), and how to reproduce a run (install, compiler, Playwright, conformance, bench with its flags, view). Existing claims unchanged: the landing table, /benchmarks charts and their numbers are untouched; the benchmarks card's description now names eight stacks (it said three) and its button opens the new page; the footer's 'Fullstack comparison' link and /benchmarks's source line point to it. Checks: @lumiose/web lumiose check, site content tests, and the axe a11y e2e (the new page added to its page list) in light and dark. Screenshots: backlog/assets/task-317-method.png, task-317-implementations.png, task-317-raw-results.png.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The site publishes the fullstack comparison's methodology, implementations, raw results files and viewer at /benchmarks/fullstack-comparison, with the commands to reproduce a run.
<!-- SECTION:FINAL_SUMMARY:END -->
