---
id: TASK-284
title: Document that event replay only covers an island's own elements
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-14 03:30'
updated_date: '2026-10-14 03:47'
labels:
  - docs
  - islands
dependencies: []
priority: low
ordinal: 286000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in the itsjavi.com port to Lumiose 0.4.0 (the port's FINDINGS.md), gap 7. The port's search island opens from a header button outside the island; with client:idle, clicks and the keyboard shortcut before hydration were lost, since replay only covers events on the island's elements. The fix was client:load. islands.md says events are replayed but not that triggers outside the island are not.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 islands.md states which events are replayed and recommends client:load (or moving the trigger inside the island) for triggers outside it
<!-- AC:END -->
