---
id: TASK-434
title: 'Preview Card: return focus to the link when the card closes with focus inside'
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-16 10:06'
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
- [ ] #1 Preview Card: return focus to the link when the card closes with focus inside, with a regression test that fails without the fix (in every engine the finding names)
<!-- AC:END -->
