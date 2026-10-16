---
id: TASK-456
title: 'Release review, Low: Prism''s cross-cutting'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 10:08'
updated_date: '2026-10-16 13:46'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: low
ordinal: 454000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Prism's cross-cutting. Fix each, or record why it stays.

**Prism's cross-cutting**
- **L37.** English defaults: "Notifications (F6)" on Toast.Viewport and "Remove" on chips. Both are overridable; list them in the docs for localisation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L36: Build: warn when a rendered component's client script has no chunk
- [x] #2 L37: English defaults: "Notifications (F6)" on Toast.Viewport and "Remove" on chips.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Beacon for release-review fix batch 2 (it fixed the related Highs in batch 1).

2026-10-16 (Beacon): L37 fixed: packages/ui/docs/README.md has a Localisation section listing the English defaults (Toast.Viewport's "Notifications (F6)", Combobox.Chips' "Remove", Number Field's "Increase" and "Decrease") and how to override each; src/localisation.test.ts checks each default is still in its source and listed. L36 (a build warning, @lumiose/vite, outside @lumiose/ui) filed as TASK-463.
<!-- SECTION:NOTES:END -->
