---
id: TASK-407
title: Setting value to undefined on <progress> or <meter> throws
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-15 23:25'
labels:
  - runtime
  - dom
milestone: m-12
dependencies:
  - TASK-373
priority: medium
ordinal: 406000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Halo in TASK-373 (2026-10-16). The DOM runtime writes `value` as a property, and Chrome throws when `<progress>.value` or `<meter>.value` is set to `undefined` (a non-finite double). Progress.Track works around it with an effect. Remove the attribute, or skip the write, when the value is undefined or null, as the runtime does for other nullable properties.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `<progress value={x}>` with x switching between a number and undefined works in islands, with a test
- [ ] #2 Progress.Track drops its workaround
<!-- AC:END -->
