---
id: TASK-35
title: 'Build the interactive SPA sample app: chiptune composer and mixer'
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 16:26'
labels: []
milestone: m-6
dependencies:
  - TASK-45
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user wants to play with a highly interactive SPA built with Lumen as soon as possible: an in-browser chiptune composer/mixer (2026-10-08). It starts now as a client-only app (views via app state) ahead of the remaining SSR work; TASK-71 moves it onto file routes and the client router once TASK-25 lands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 examples/spa-chiptune: client-only Lumen app (lumen/vite, ssr:false style entry) with views (songs list, tracker editor, instrument editor, settings) switched via app state; NES-style 4-channel chip voices (2 pulse with duty 12.5/25/50/75%, triangle, noise) synthesized in an AudioWorklet, optional wavetable channel
- [ ] #2 Tracker pattern editor (rows × channels: note, instrument, volume, effect columns) with full keyboard entry, cursor/selection, copy/paste; song arrangement (order list); effects at least arpeggio, vibrato, volume slide, duty change; instrument envelopes (volume/duty/pitch macros); transport (play song/pattern, loop, BPM/speed) with the playing row following
- [ ] #3 Mixer: per-channel volume/pan/mute/solo, master, VU meters and per-channel oscilloscopes animated via requestAnimationFrame; state in store() with undo/redo; save/load song (localStorage + JSON file), export WAV via OfflineAudioContext; retro pixel UI with scoped styles and $tokens; a bundled demo song
- [ ] #4 Runs in vite dev and builds; type-checks with lumen check; README; screenshots in backlog/assets; a performance note (frame times while playing with meters and scopes animating); framework bugs found are filed as tasks for their owners
<!-- AC:END -->
