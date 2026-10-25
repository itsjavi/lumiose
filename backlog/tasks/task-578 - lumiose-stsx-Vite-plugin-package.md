---
id: TASK-578
title: '@lumiose/stsx Vite plugin package'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-25 00:31'
labels:
  - build
  - stsx
milestone: m-14
dependencies:
  - TASK-577
references:
  - >-
    backlog/decisions/decision-86 -
    .stsx-in-other-JSX-frameworks-through-lumiose-stsx.md
  - >-
    backlog/decisions/decision-85 -
    Scoped-styles-attribute-or-class-strategy-specificity-and-namespace-scopedStyles.md
  - >-
    backlog/tasks/task-571 -
    Spike-.stsx-in-React-React-Router-and-Solid-through-lumiose-stsx.md
  - packages/vite/src/styles.ts
priority: high
ordinal: 570000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Builds packages/stsx from the TASK-571 prototype. The prototype itself is not committed; its design is in TASK-571's notes.
- **Module ids.** Virtual `X.stsx.tsx` and `X.stsx.css` modules.
- **Dependency scan.** A scanner plugin (`optimizeDeps.rolldownOptions.plugins`, loading the masked TSX), so dependencies are not discovered late (no duplicate React).
- **Dev and transform.** A dev rewrite of `/x.stsx` URLs. The emit runs in `transform`, because React Router reads route files and transforms them itself.
- **Options.** `classAttribute` is required (the error names the value per framework). `scopedStyles` is validated (decision-85).
- **CSS and tokens.** CSS targets come from `build.cssTarget`. Tokens are stable across machines (root and package relative).
- **Diagnostics.** Through this.error/this.warn, with code frames.
- **React Router guard.** `.stsx` route modules are rejected with an error that shows the supported pattern.

Lockstep package: release scripts and README. Lux adds packages/stsx/** to Photon's area in AGENTS.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 packages/stsx releases @lumiose/stsx in lockstep, with stsx({ classAttribute, scopedStyles }) typed and validated at startup
- [ ] #2 React + Vite and Solid + Vite fixtures render scoped styles in dev and production builds, with dependencies pre-bundled on the first load (no late discovery, no duplicate React)
- [ ] #3 Under React Router, .stsx components work in dev and in SSR production builds, and a .stsx route module fails with an error that shows the supported pattern
- [ ] #4 Diagnostics show in the Vite overlay and build output with the code, file:line:col and a code frame
- [ ] #5 The package README documents setup for React, React Router and Solid
<!-- AC:END -->
