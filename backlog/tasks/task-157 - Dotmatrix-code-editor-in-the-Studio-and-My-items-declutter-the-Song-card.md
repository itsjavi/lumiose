---
id: TASK-157
title: 'Dotmatrix: code editor in the Studio and My items; declutter the Song card'
status: To Do
assignee:
  - Chime
created_date: '2026-10-09 10:23'
labels:
  - samples
  - ux
milestone: m-6
dependencies: []
priority: medium
ordinal: 157000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-09: the code editor belongs in the Studio and on custom saved items, not on the predefined ones. The Studio has no way to show or edit code, and the Song card is already cluttered with buttons.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Predefined SFX/voices: code is read-only (learning view) with a way to copy them into My sounds/My voices; editing, paste and import live only on custom items and in the Studio
- [ ] #2 Studio: a Grid | Code switch (or equivalent) on the editor area shows and edits the current song or sound sheet in the driver format, round-tripping with the grid (songs need a music-macro exporter/parser: tempo, notetype, duty, vibrato, notes, rests, loops, per channel), with line errors; import/paste available there
- [ ] #3 Song card decluttered: bar/channel tools grouped (e.g. a toolbar or overflow menu) so the card holds only song settings; overflow and e2e tests updated; screenshots
<!-- AC:END -->
