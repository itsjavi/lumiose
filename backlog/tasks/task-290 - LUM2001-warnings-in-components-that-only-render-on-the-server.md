---
id: TASK-290
title: LUM2001 warnings in components that only render on the server
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-14 03:47'
labels:
  - diagnostics
  - dx
dependencies: []
priority: low
ordinal: 292000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md), gap 12. LUM2001 flagged 13 values derived once from props in components that are never used in an island (static cards and rows). Making them lazy is harmless but is ceremony for code that never reacts. The compiler cannot know whether a component will run in the browser; options: keep it, lower its severity for props-only derivations, or document why it applies to server components.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A decision is recorded and the LUM2001 docs explain the server-component case
<!-- AC:END -->
