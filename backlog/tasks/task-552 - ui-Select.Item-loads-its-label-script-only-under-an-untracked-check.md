---
id: TASK-552
title: 'ui: Select.Item loads its label script only under an untracked check'
status: To Do
assignee:
  - Halo
created_date: '2026-10-23 23:12'
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
- [ ] #1 A Select.Item whose label appears after the first render in an island loads the select script
- [ ] #2 A test covers it
<!-- AC:END -->
