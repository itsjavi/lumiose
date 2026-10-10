---
id: TASK-217
title: Prerender the chiptune tracker's first render
status: To Do
assignee:
  - Spark
created_date: '2026-10-10 22:50'
labels:
  - example
  - showcase
milestone: m-6
dependencies:
  - TASK-216
priority: medium
ordinal: 219000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-11 (decision-37 amendment: lean landing and site IA): /showcase/chiptune-tracker/ should show real content before JavaScript runs. Switch examples/spa-chiptune to the build-time prerender of TASK-216, moving browser-only code (AudioWorklet, Web Audio, storage) out of module scope and setup into effects or lazy imports, so the first paint is the app's UI, which then hydrates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The built app's HTML contains the rendered UI for every route without JavaScript
- [ ] #2 Hydration takes over without a flash or a mismatch, and audio starts only after a user gesture, as today
- [ ] #3 The app's tests and the site build pass
<!-- AC:END -->
