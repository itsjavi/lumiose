---
id: TASK-552
title: 'ui: Select.Item loads its label script only under an untracked check'
status: Done
assignee:
  - Halo
created_date: '2026-10-23 23:12'
updated_date: '2026-10-23 23:24'
labels:
  - ui
dependencies: []
priority: low
ordinal: 544000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up of TASK-551. Select.Item calls selectScript() under an untracked label check. Since TASK-551, a conditionally called ?client script in an island loads on its first call, so a label that appears after an island's first render no longer loads the script (before, the static import always had it). Low impact: the picker shows the label text, as server HTML does before the script runs. Fix: call it inside a reactive branch, as Popover.Trigger now does for openOnHover.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A Select.Item whose label appears after the first render in an island loads the select script
- [x] #2 A test covers it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (solo, 2026-10-24): Select.Item calls the script from the function that renders its label attribute, so a label that appears later loads it (the call is conditional, so an island loads it on the call, TASK-551). src/select/select.dom.test.tsx fails on the old code. ui tests 619, typecheck, lint and the Select e2e (28) pass.
<!-- SECTION:NOTES:END -->
