---
id: TASK-434
title: 'Preview Card: return focus to the link when the card closes with focus inside'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 10:06'
updated_date: '2026-10-16 10:53'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: high
ordinal: 432000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. Finding H8.

**H8. Preview Card: Escape with focus inside the card drops focus to `<body>`.** CONFIRMED in 3 engines.
- **Repro:** `/preview-card`. Tab to "islands" (the card opens), Tab into the card's link, press Escape.
- **Observed:** focus goes to body, and the next Tab skips past the trigger's neighbours.
- The keyboard-reachable card is a deliberate difference; its focus return was not foreseen.
- **Violates:** WCAG 2.4.3; preview-card.md ("without moving focus").
- **Fix:** on closing `beforetoggle`, note whether the card holds focus, and refocus the link with `preventScroll`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Preview Card: return focus to the link when the card closes with focus inside, with a regression test that fails without the fix (in every engine the finding names)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Halo): claimed (release-review fix batch 1; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): fixed as proposed. preview-card.script.ts notes on a closing beforetoggle whether the card holds focus, and on the closed toggle, if focus fell to the page (or is still inside), focuses the link with preventScroll. That focus does not reopen the card (keyboard focus on the link opens it otherwise). Test: Tab to islands, Tab into the card's link, Escape: the card closes, focus is on islands, the card stays closed and Tab goes on to the next link. It fails without the fix in dev, build, Firefox and WebKit. preview-card.md's Escape row updated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Preview Card gives focus back to its link when it closes with focus inside (Escape), without reopening; regression test fails without the fix in Chromium, Firefox and WebKit.
<!-- SECTION:FINAL_SUMMARY:END -->
