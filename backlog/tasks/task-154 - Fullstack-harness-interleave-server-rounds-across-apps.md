---
id: TASK-154
title: 'Fullstack harness: interleave server rounds across apps'
status: To Do
assignee:
  - Nova
created_date: '2026-10-09 09:05'
labels:
  - benchmark
milestone: m-8
dependencies: []
priority: medium
ordinal: 154000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-115: in the first full run (2026-10-09T084814) React Router's server rounds ran during a transient load spike and came out ~2x low (/issues 556 vs 1432 req/s in a server-only rerun 10 min later), while Lumen and Next were stable. The harness runs each app's 3 rounds back to back, so a spike hits one framework. Interleave rounds round-robin across apps per route (A B C A B C …), add a short cool-down and an idle check (load average) before each round, and report min/median/max so outliers are visible in the viewer.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Server rounds are interleaved across apps per route, with cool-down/idle checks; results show spread; doc-4 §4 updated
<!-- AC:END -->
