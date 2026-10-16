---
id: TASK-444
title: 'Release review, Low: Scroll Area'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 13:30'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: low
ordinal: 442000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Scroll Area. Fix each, or record why it stays.

**Scroll Area**
- **L6.** No JS: an unscrollable viewport is an unnamed tab stop. Document it, or drop its `tabindex` on the server.
- **L7.** Scrollbars and thumbs are 6–10px, under the 2.5.8 target size. Give them a 24px hit area. Task: "Scroll Area scrollbars as 24px pointer targets".
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L6: No JS: an unscrollable viewport is an unnamed tab stop.
- [x] #2 L7: Scroll Area scrollbars as 24px pointer targets
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): Halo's in release-review fix batch 2.

2026-10-16 (Halo): claimed (release-review fix batch 2; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo):
- L6: documented, not changed. The server cannot know whether a viewport will overflow, so it keeps tabindex=0 (dropping it would leave Safari, which has no focusable scrollers, without keyboard scrolling when JS is off). scroll-area.md now says to name the Viewport (aria-label) because it is a tab stop while it overflows and in server HTML before the script, and that without JS an area that does not overflow is a tab stop with nothing to scroll.
- L7: the default theme gives each thumb a 24x24px pointer target: a ::before reaching 16px inward and over the scrollbar's padding, and 4px past the thumb's ends (its least length is 16px); the track's ends got 4px padding so the target stays inside the area. The track stays 10px (the wheel, keyboard and thumb stand in for it; a wider band would take presses from content near the edge). e2e test 'each thumb takes presses over 24 by 24 px' (elementFromPoint 14px inward and 3px past the end, a drag from beside the thumb, the horizontal thumb) fails without the change in dev, build, Firefox and WebKit. a11y.ts clipped() now skips aria-hidden subtrees (decoration holds no content to clip).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
L6 documented (the viewport is a tab stop in server HTML; name it). L7: theme thumbs are 24px pointer targets, with a regression test.
<!-- SECTION:FINAL_SUMMARY:END -->
