---
id: TASK-241
title: 'SSR benchmark: Preact, Astro and Remix 3 implementations'
status: To Do
assignee:
  - Nova
created_date: '2026-10-11 03:48'
labels:
  - benchmark
milestone: m-8
dependencies: []
priority: medium
ordinal: 243000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
For the stack table's 'Rendering' column (decision-37 amendment, user 2026-10-11). Add implementations of the SSR benchmark page (src/data.ts, the same elements, classes and escaping) for Preact (preact-render-to-string), Astro (the Container API rendering .astro components to a string) and Remix 3 (its component model's server render). Use the latest stable versions (decision-41), compile each with its own toolchain as its bundler plugin would, and make each pass scripts/run.ts's output checks. Smoke only: the user's machine is busy, and the full run belongs to TASK-235. Document any method caveats, such as async renderers or framework overhead, in RESULTS.md's method notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Preact, Astro and Remix 3 render the same page, pass the output checks and are pinned to their latest stable versions
- [ ] #2 Method caveats are documented; no RESULTS.md regeneration (TASK-235 runs it)
<!-- AC:END -->
