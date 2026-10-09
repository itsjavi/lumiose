---
id: TASK-160
title: 'Dotmatrix: Studio import/paste detects song vs sound-effect code'
status: To Do
assignee:
  - Chime
created_date: '2026-10-09 10:49'
labels:
  - samples
  - bug
milestone: m-6
dependencies: []
priority: high
ordinal: 160000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-09: importing a creature .asm in the Studio while a song is open lists 'Unknown command duty_cycle_pattern / square_note' on every line. Songs use the music dialect (note_type, octave, note, rest); SFX and cries use the sound-effect dialect (square_note, noise_note with frame lengths and raw frequency registers, duty_cycle_pattern, pitch_sweep).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Studio import, paste and Code-mode Apply detect the dialect: sound-effect/cry code opens as a sound sheet (switching modes, undoable), song code as a song; mixed files get one clear error explaining the two kinds, never a list of unknown commands
- [ ] #2 e2e: import a creature .asm and an SFX .asm while a song is open, and a song .asm while a sound sheet is open; composing.md explains the two dialects
<!-- AC:END -->
