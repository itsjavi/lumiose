---
id: TASK-420
title: 'Scroll Area: no scrollbar without JavaScript in Firefox'
status: To Do
assignee: []
created_date: '2026-10-16 03:06'
labels:
  - ui
  - browsers
dependencies: []
ordinal: 418000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Beacon in TASK-361 (2026-10-16), in Linux Firefox (Playwright 1.63, JavaScript off). The viewport's computed scrollbar-width is none although lu-scroll-area is not defined (customElements.get and matches(':defined') say so): the only matching rule is lu-scroll-area:defined [data-viewport] in scroll-area.css. Gecko's style system seems to treat parser-created custom elements as :defined when the page runs without scripts, so the native scrollbar hides and the custom ones stay hidden. Gating the :defined rules on @media (scripting: enabled) would keep the native scrollbar. The scroll-area.e2e.ts no-JS test skips Firefox with this task's id.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Without JavaScript, Scroll Area shows the native scrollbar in Firefox, and the test runs there
<!-- AC:END -->
