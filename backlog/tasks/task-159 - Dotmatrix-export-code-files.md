---
id: TASK-159
title: 'Dotmatrix: export code files'
status: To Do
assignee:
  - Chime
created_date: '2026-10-09 10:45'
labels:
  - samples
  - ux
milestone: m-6
dependencies: []
priority: medium
ordinal: 159000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-09: there is Import file but no export anywhere except WAV. Wherever code is shown (Studio code mode, saved sounds/voices, and the read-only built-ins), offer Export code (download) and Copy code. Also (Lux): the composition check accepts a V→I turnaround into the loop as a valid ending for looping songs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Export code downloads the current song / sound sheet / SFX / voice as a .asm file (name from the title) that Import file reads back identically; Copy code copies it; available in the Studio code mode, on saved items and on built-ins
- [ ] #2 Exported files round-trip in a unit test for every demo song, SFX and voice; e2e covers export → import; composing.md mentions it
- [ ] #3 Composition check: for looping songs, ending on V (or the leading tone) that resolves to I at the loop start counts as a cadence; skip list updated
<!-- AC:END -->
