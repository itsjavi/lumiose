---
id: TASK-414
title: A compact nav for the ui-e2e fixture
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 01:30'
updated_date: '2026-10-16 02:12'
labels:
  - test
  - ui
milestone: m-12
dependencies: []
priority: low
ordinal: 413000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From batch 7 (2026-10-16). The ui-e2e layout's nav grows with every component and pushes the fixtures below a 720px viewport. Three tests (Menu, Select, Popover) now set a 1000px viewport to keep anchored popups from flipping. A compact nav would let the tests keep Playwright's default viewport: a disclosure, a select, or the links only on the home page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The ui-e2e fixtures sit within a 720px viewport, and the tests drop their 1000px overrides
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Halo): claimed (M12 eighth batch, hardening; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): the ui-e2e layout's nav is one link, "All @lumiose/ui fixtures", to the home page that lists every fixture (examples/ui-e2e/src/routes/layout.stsx). Every fixture now starts near the top of a 720px viewport, so anchored popups no longer flip; the 1000px overrides are gone from menu.e2e.ts (2), popover.e2e.ts and select.e2e.ts. lastNavLink (a11y.ts) still returns the nav's last link, the one before the first fixture control. Full ui-e2e: 728 passed, 22 skipped. Commit 4b647571.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A compact ui-e2e nav: one link to the fixtures index. The fixtures fit a 720px viewport and the Menu, Select and Popover tests dropped their 1000px viewport overrides. Full ui-e2e green (728 passed). Commit 4b647571.
<!-- SECTION:FINAL_SUMMARY:END -->
