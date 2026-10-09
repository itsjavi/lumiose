---
id: TASK-110
title: 'Fullstack bench: shared data layer, CSS and React UI packages'
status: To Do
assignee:
  - Quasar
created_date: '2026-10-09 04:07'
labels:
  - benchmark
milestone: m-8
dependencies: []
priority: medium
ordinal: 110000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
doc-4 §2–§3: @bench/data (node:sqlite, deterministic seed, the shared query/validation API), @bench/ui-css (one plain stylesheet), @bench/react-ui (presentational React components shared by the React Router and Next apps).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 @bench/data seeds the documented dataset deterministically and implements the full API in doc-4 §2, with unit tests
- [ ] #2 @bench/ui-css and @bench/react-ui exist; the markup landmarks match doc-4 §5 data-testids
<!-- AC:END -->
