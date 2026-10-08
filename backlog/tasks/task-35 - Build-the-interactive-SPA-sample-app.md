---
id: TASK-35
title: 'Build the interactive SPA sample app: audio composer and mixer'
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 15:30'
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
The user wants to see what building a highly interactive SPA with Lumen is like in a real project. They chose an in-browser audio composer/mixer (2026-10-08) because it stresses fine-grained updates far more than a CRUD board.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 examples/spa-composer: lumen({ mode: "spa", ssr: false }) app with routes (projects list, editor, settings); multi-track sequencer (step grid and/or piano roll), transport (play/stop/loop/tempo), mixer (per-track gain/pan/mute/solo, master), knobs/faders with pointer + keyboard control, VU meters driven by requestAnimationFrame, Web Audio graph with AudioWorklet or built-in nodes for synthesis/samples
- [ ] #2 State in store() with undo/redo, project save/load (localStorage or file), keyboard shortcuts; many components with scoped styles and $tokens; uses busy()/Suspense for sample loading
- [ ] #3 Runs in lumen dev and builds; type-checks with lumen check; README; screenshots in backlog/assets; a short performance note (frame times while playing with meters animating)
<!-- AC:END -->
