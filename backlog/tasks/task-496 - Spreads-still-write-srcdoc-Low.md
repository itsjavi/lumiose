---
id: TASK-496
title: Spreads still write srcdoc (Low)
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-20 23:55'
labels:
  - security
dependencies: []
priority: high
ordinal: 492000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Delta review finding C3 (TASK-472 L3 not closed): packages/lumiose/src/dom/spread.ts:14 and server/attrs.ts:204-213. <iframe {...payload}/> with {srcdoc: '<script>…'} runs script with the page's origin (a strict CSP blocks it). Treat srcdoc like innerHTML: only a written prop sets it. Also keep the docs warning prominent that Dynamic applies innerHTML/textContent from its props (Info C4).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A spread never writes srcdoc, on the server or in the DOM; a written srcdoc prop still works
- [ ] #2 Tests cover both targets; the docs list srcdoc with innerHTML and textContent and warn about Dynamic's props
<!-- AC:END -->
