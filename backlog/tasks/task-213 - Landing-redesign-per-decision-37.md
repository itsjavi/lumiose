---
id: TASK-213
title: Landing redesign per decision-37
status: To Do
assignee:
  - Beacon
created_date: '2026-10-10 22:41'
labels:
  - landing
  - positioning
milestone: m-7
dependencies:
  - TASK-202
  - TASK-203
  - TASK-204
  - TASK-205
  - TASK-206
  - TASK-207
  - TASK-211
  - TASK-212
priority: high
ordinal: 215000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-37 (positioning, approved by the user 2026-10-11; notes in .local/positioning/). Hero: eyebrow "Static · Server · Islands · SPA — one framework", H1 "Feels like React. Runs like vanilla JS.", a sub on TSX with first-class CSS, per-route rendering and 0 kB where pages don't move, CTAs Get started / Compare the stacks / Playground, proof row 1.05x vanilla JS · 0 kB JS on server pages · 6.5 kB app. Directly below: the stack comparison table (React + Next.js, React Router, Solid + SolidStart, Svelte + SvelteKit, Vue + Nuxt, Preact, Remix 3, Astro, Lumiose; columns: full-stack layer, styles, JS on a server page, client speed, interactive parts use the same components), Astro shown honestly (0 kB too, islands need a second UI framework). Then, in order: Familiar to write (React-like JSX, one file per component with first-class CSS, stock TypeScript; the live demo island) → Every rendering mode (static → islands → server → SPA, each linked to a live example app) → Light and fast, measured (fullstack vs Next.js and React Router first, then js-framework-benchmark and SSR) → Explicit, for you and your agent (no hidden machinery, LUM codes with fixes, agent eval numbers) → secure by default, toolchain, pre-release note. Claims follow the decision: near-vanilla and Solid-class, never 'fastest' or smallest; .stsx first named in the authoring section.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Hero, table and sections match decision-37, in that order
- [ ] #2 Every number and table cell comes from committed results through content modules checked by tests; no 'not measured' cells
- [ ] #3 The page meets the site's accessibility and payload budgets, with screenshots in backlog/assets linked from this task
<!-- AC:END -->
