---
id: TASK-155
title: 'Dotmatrix: 20 creatures/base voices; paste and import driver code'
status: To Do
assignee:
  - Chime
created_date: '2026-10-09 09:25'
labels:
  - samples
  - audio
milestone: m-6
dependencies: []
priority: medium
ordinal: 155000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-09 ('much better'): add 7 more base voices so there are 4 complete rows (20 in total) — i.e. 7 new creatures, each on its own new original base voice, built with the cry techniques of TASK-153; grids show complete rows at desktop width. And: the app shows the driver code for SFX and voices but cannot take it back — allow pasting/editing and importing that format.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 20 creatures and 20 original base voices, each distinct; creature and base-voice grids show complete rows at desktop width; similarity check (scratch, not committed) against the reference cries reported
- [ ] #2 The code view is editable (or has Paste/Import): driver code in the shown format (duty_cycle, duty_cycle_pattern, square_note, noise_note, pitch_sweep, slides, cry header, sound_ret…) parses back into an SFX or voice, with line-numbered errors; Import from a .txt/.asm file; the result saves to My sounds / My voices
- [ ] #3 Round-trip tests: every built-in SFX and voice exports to code and imports back identically; e2e for paste, edit, error and import; composing.md documents it
<!-- AC:END -->
