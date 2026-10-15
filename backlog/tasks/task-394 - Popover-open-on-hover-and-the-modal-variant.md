---
id: TASK-394
title: 'Popover: open on hover, and the modal variant'
status: In Progress
assignee:
  - '@Halo'
created_date: '2026-10-15 19:22'
updated_date: '2026-10-15 23:39'
labels:
  - ui
milestone: m-12
dependencies:
  - TASK-356
priority: medium
ordinal: 393000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Proposed by Halo in TASK-356 (2026-10-15): Base UI's Popover has `openOnHover` with `delay` and `closeDelay`, and a `modal` variant. They are not implemented yet. Keep doc-9 section 1.4.13 (content on hover) and section 3 in view.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Popover.Trigger opens on hover with delay and closeDelay, keyboard and touch unaffected
- [ ] #2 A modal popover traps focus and locks scroll like Base UI's
- [ ] #3 Docs page, e2e and doc-9 results updated
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Halo): claimed (M12 sixth batch, branch claude/halo-m12c-4d6b9f).
<!-- SECTION:NOTES:END -->
