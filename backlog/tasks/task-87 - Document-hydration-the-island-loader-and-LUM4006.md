---
id: TASK-87
title: 'Document hydration, the island loader and LUM4006'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-08 20:58'
updated_date: '2026-10-08 21:17'
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
- [x] #1 docs/reference/dom.md documents hydrate and the loader (triggers, event replay, streaming behaviour); concepts/islands.md is updated with what hydrates, what doesn't refetch, and slots
- [x] #2 LUM4006 page 'Reported by' covers hydration mismatch and a missing await record; llms files regenerated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon: done as part of the TASK-89 docs audit.

Beacon: reference/dom.md documents hydrate() (signature, await replay with tracking, inline/template slots, mismatch fallback, fresh) and lumen/dom/loader (records per streamed chunk, load/only/idle/visible/media triggers, streamed <Suspense> wait, click/input/submit/keydown capture + replay, islands inside inserted slots); islands.md: inline slot adoption vs <template data-l-slot>, 'What hydration does' (claims nodes, no refetch, client:only, Suspense wait); LUM4006 'Reported by' covers mismatch and a missing await record (dev console warning; same fallbacks in production). llms regenerated; docs tests 16/16. Commit 0059f43.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hydration and the island loader are documented end to end: lumen/dom reference (hydrate, loader), islands concept (slots, what hydrates and what does not refetch) and LUM4006's reporting.
<!-- SECTION:FINAL_SUMMARY:END -->
