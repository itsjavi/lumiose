---
id: TASK-579
title: '@lumiose/stsx: one hot update per save, CSS-only when the TSX is unchanged'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-25 00:31'
labels:
  - build
  - stsx
milestone: m-14
dependencies:
  - TASK-578
references:
  - >-
    backlog/decisions/decision-86 -
    .stsx-in-other-JSX-frameworks-through-lumiose-stsx.md
  - >-
    backlog/tasks/task-571 -
    Spike-.stsx-in-React-React-Router-and-Solid-through-lumiose-stsx.md
priority: medium
ordinal: 571000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The spike sent up to 4 duplicate client updates per save under React Router, and 1 under plain Vite. Find the source and deduplicate. Candidates: watcher events per environment, React Router's child compiler running the plugin, and importers created by `addWatchFile`.
Keep the spike's behaviour:
- A style-only edit updates only the stylesheet.
- Editing a module that `$name` constants are folded from updates the CSS of every file that uses them.
- The SSR environment is invalidated correctly.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A save sends exactly one client update under React + Vite, React Router and Solid
- [ ] #2 A style-only edit updates only the stylesheet: no JS re-fetch, and component state is kept
- [ ] #3 A JSX edit hot-updates through the framework's refresh, keeping React state
- [ ] #4 Editing a module that $name constants are folded from updates the CSS of every dependent file without a remount
- [ ] #5 Tests cover these cases on a real dev server, including React Router's SSR environment
<!-- AC:END -->
