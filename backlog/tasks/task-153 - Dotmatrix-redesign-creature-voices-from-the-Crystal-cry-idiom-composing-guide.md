---
id: TASK-153
title: >-
  Dotmatrix: redesign creature voices from the Crystal cry idiom; composing
  guide
status: To Do
assignee:
  - Chime
created_date: '2026-10-09 05:37'
labels:
  - samples
  - audio
  - docs
milestone: m-6
dependencies: []
priority: medium
ordinal: 153000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User feedback 2026-10-09: the creature voices sound similar to each other and like old cell phones ringing. The previous set is recorded in git at 24cd678. Learn how real cries are built from the crystal-exporter examples at /Users/javi/Developer/lab/projects/games/newbark-engine/tools/crystal-exporter/audio/src/game/audios (cries/, species-cries/, sfx/, music/, the engine types and drivers) and redesign the creatures. The reference is extracted game data: learn techniques and statistics only; never copy or closely transcribe any command sequence, frequency series or envelope pattern. Also write a composing guide for Dotmatrix covering SFX, cries and music.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Creature voices redesigned with the techniques real cries use (per-frame duty patterns, frequency slides rather than musical steps, envelope fades, detuned/offset pulse pair, layered noise, short frame lengths, pitch/length variants); each creature clearly distinct; original patterns, with a one-off similarity check against the reference (not committed) showing no close match
- [ ] #2 examples/spa-dotmatrix/docs/composing.md: how to compose SFX, cries and music in Dotmatrix and in the Crystal-style driver format, with original examples only; linked from the README and the Learn page
- [ ] #3 Unit/e2e tests updated; screenshots if the UI changed
<!-- AC:END -->
