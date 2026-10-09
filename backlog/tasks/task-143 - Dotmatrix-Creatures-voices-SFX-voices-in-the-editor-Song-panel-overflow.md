---
id: TASK-143
title: 'Dotmatrix: Creatures voices, SFX/voices in the editor, Song panel overflow'
status: To Do
assignee:
  - Chime
created_date: '2026-10-09 05:13'
labels:
  - samples
  - spa
  - audio
milestone: m-6
dependencies: []
priority: medium
ordinal: 143000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User feedback 2026-10-09 on spa-dotmatrix (loves the UI): (1) the Song panel overflows its card (the Scale select sticks out past the right edge at desktop width; screenshot in chat); (2) add a Creatures section next to SFX with a variety of original creature voices (cries), Crystal-style: a few base voice patterns on pulse + noise, varied by pitch and length, with a maker like the SFX one; original only, no game cry data; (3) make SFX and voices editable in the Studio editor too, where compatible (features the note grid cannot represent stay in the maker, with a clear explanation).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Song panel fits its card at desktop, tablet and phone widths (no overflow), with a regression check
- [ ] #2 /creatures (or a tab next to SFX) with at least 12 original creature voices, a maker (base voice, pitch, length, variation), playback and WAV export
- [ ] #3 SFX and voices open in the editor when compatible and round-trip back; incompatible ones explain why; e2e tests; screenshots in backlog/assets
<!-- AC:END -->
