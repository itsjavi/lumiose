---
id: TASK-133
title: Game Boy chiptune sample app (spa-dotmatrix) on the gbapu engine
status: To Do
assignee:
  - Chime
created_date: '2026-10-09 04:31'
labels:
  - samples
  - spa
  - audio
milestone: m-6
dependencies: []
priority: medium
ordinal: 133000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User request 2026-10-09: a sibling of spa-chiptune built with Lumen, using the user's Game Boy APU engine (/Users/javi/Developer/lab/projects/games/newbark-engine/packages/gbapu, vendored with its LICENSE-NOTICE.md and PROVENANCE.json) and learning from crystal-exporter (docs/audio.md, audio/DSL.md, authored examples) how Crystal-style music and SFX are expressed. Easier for beginners than spa-chiptune, equally polished, with its own design. Demo songs and SFX must be original compositions in that style: no Pokémon Crystal songs, SFX, cries or exported game data.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 examples/spa-dotmatrix: a Lumen SPA where a beginner can make a short 4-channel Game Boy song (pulse 1/2, wave, noise) and simple SFX with presets, play it, and export WAV
- [ ] #2 Ships several original demo songs and an SFX gallery in the Crystal style (duty cycles, envelopes, vibrato, pitch slides, noise drums)
- [ ] #3 gbapu vendored with its notice and provenance unchanged; no game audio or data copied from crystal-exporter
- [ ] #4 lumen check, lumen fmt --check, build, Playwright e2e green; README; screenshots in backlog/assets linked from the task
<!-- AC:END -->
