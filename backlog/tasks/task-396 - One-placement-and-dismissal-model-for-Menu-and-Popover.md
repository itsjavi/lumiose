---
id: TASK-396
title: One placement and dismissal model for Menu and Popover
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-15 19:22'
updated_date: '2026-10-15 20:31'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-356
  - TASK-357
priority: medium
ordinal: 395000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found at the M12 second-batch merge (2026-10-15). Menu and Popover solve doc-9's right-click and second-finger outside press two ways: Menu's script switches its popup to popover=manual and dismisses itself, while Popover keeps popover=auto and reopens in a requestAnimationFrame. Menu also re-exports the shared placement types as MenuSide and MenuAlign next to the package's Side and Align. Pick one dismissal approach (or record why both stay), share it, and drop the duplicate type names before @lumiose/ui's first release.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Menu and Popover use one recorded dismissal approach, or the split is recorded with its reason
- [ ] #2 One pair of placement type names is exported
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-15 (Halo): claimed (M12 third batch, branch claude/halo-m12c-4d6b9f).
<!-- SECTION:NOTES:END -->
