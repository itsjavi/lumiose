---
id: TASK-87
title: 'Document hydration, the island loader and LUM4006'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-08 20:58'
labels: []
milestone: m-5
dependencies:
  - TASK-18
priority: medium
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-18 shipped hydrate(), the island loader and mismatch fallback. The docs must explain islands end to end for agents and humans.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docs/reference/dom.md documents hydrate and the loader (triggers, event replay, streaming behaviour); concepts/islands.md is updated with what hydrates, what doesn't refetch, and slots
- [ ] #2 LUM4006 page 'Reported by' covers hydration mismatch and a missing await record; llms files regenerated
<!-- AC:END -->
