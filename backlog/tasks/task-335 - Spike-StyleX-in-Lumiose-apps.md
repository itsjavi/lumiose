---
id: TASK-335
title: 'Spike: StyleX in Lumiose apps'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-15 04:11'
labels:
  - css
  - spike
milestone: m-11
dependencies: []
references:
  - packages/vite/src/styles.ts
  - packages/vite/src/css-manifest.ts
priority: medium
ordinal: 337000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15: find out whether StyleX can be used in Lumiose apps, and what it takes, before documenting it. Known friction: StyleX compiles `stylex.create()` at build time through a bundler plugin, which here has to run on the JS that the Lumiose compiler emits for `.stsx` files (plugin order is unverified); `stylex.props()` returns React's `className`, which Lumiose's JSX rejects (it uses `class`); its CSS must be linked by the CSS manifest in SSR builds, and dev must not flash unstyled content.

Spike only: a throwaway app in scratch space, nothing committed to the source tree. Use StyleX's current official Vite integration. Any new public API (a helper, accepting `className`, a plugin option) is a proposal for the user to approve, per the syntax and DX rule in AGENTS.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Findings record whether StyleX compiles in .stsx and .tsx files in dev, SSR and production builds, with its CSS linked in SSR output and HMR working
- [ ] #2 Findings compare ways to apply StyleX styles to elements given `class` instead of `className` (a user-land helper, a StyleX API for other frameworks if one exists, or a Lumiose change), with trade-offs
- [ ] #3 A recommendation is recorded in the task: supported as is, supported with a documented helper, or documented as unsupported; any public API change is left as a proposal for the user
<!-- AC:END -->
