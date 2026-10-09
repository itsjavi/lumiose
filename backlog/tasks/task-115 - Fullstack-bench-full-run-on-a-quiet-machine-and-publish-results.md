---
id: TASK-115
title: 'Fullstack bench: full run on a quiet machine and publish results'
status: In Progress
assignee:
  - Lux
created_date: '2026-10-09 04:07'
updated_date: '2026-10-09 09:05'
labels:
  - benchmark
milestone: m-8
dependencies:
  - TASK-110
  - TASK-111
  - TASK-112
  - TASK-113
  - TASK-114
priority: low
ordinal: 115000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After TASK-110..114: run the full benchmark with no agents running (together with the TASK-68 js-framework-benchmark rerun), commit the results JSON, summarise findings, and file performance tasks for Lumen where it loses.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A full results file is committed and viewable
- [ ] #2 Findings summarised; follow-up tasks filed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-09: full run started after all agents finished and pnpm check passed (b836aa8).

Lux: full run results/2026-10-09T084814-macbookpro.json (all three pass conformance; dev 5, build 3, load 5, server 3 iterations). React Router's server rounds in that run hit a transient load spike (~2x low); the server-only rerun results/2026-10-09T085822-macbookpro.json is the reference for req/s (consistent with Prism's interleaved TASK-136 runs). Harness fix: TASK-154.
<!-- SECTION:NOTES:END -->
