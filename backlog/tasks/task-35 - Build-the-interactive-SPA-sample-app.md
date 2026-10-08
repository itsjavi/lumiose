---
id: TASK-35
title: 'Build the interactive SPA sample app: chiptune composer and mixer'
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 15:31'
labels: []
milestone: m-6
dependencies:
  - TASK-25
  - TASK-23
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user wants to see what building a highly interactive SPA with Lumen is like in a real project. They asked for an in-browser chiptune composer/mixer (2026-10-08): a tracker-style app that stresses fine-grained updates, real-time audio and dense keyboard-driven UI.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 examples/spa-chiptune: lumen({ mode: "spa", ssr: false }) app with routes (songs list, tracker editor, instrument editor, settings); NES-style 4-channel chip voices (2 pulse with duty 12.5/25/50/75%, triangle, noise) synthesized in an AudioWorklet, optional wavetable channel
- [ ] #2 Tracker pattern editor (rows × channels: note, instrument, volume, effect columns) with full keyboard entry, cursor and selection, copy/paste; song arrangement (order list of patterns); effects at least arpeggio, vibrato, volume slide, duty change; instrument envelopes (volume/duty/pitch macros); transport (play song/pattern, loop, BPM/speed) with the playing row following
- [ ] #3 Mixer: per-channel volume/pan/mute/solo, master, VU meters and per-channel oscilloscopes animated via requestAnimationFrame; state in store() with undo/redo; save/load song (localStorage + JSON file), export WAV via OfflineAudioContext; retro pixel UI with scoped styles and $tokens; busy()/Suspense where loading applies
- [ ] #4 Runs in lumen dev and builds; type-checks with lumen check; README; screenshots in backlog/assets; a performance note (frame times while playing with meters and scopes animating)
<!-- AC:END -->
