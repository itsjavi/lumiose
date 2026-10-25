---
id: TASK-584
title: Draft a React Router proposal for configurable route module extensions
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-25 00:31'
labels:
  - proposal
  - stsx
milestone: m-14
dependencies: []
references:
  - >-
    backlog/decisions/decision-86 -
    .stsx-in-other-JSX-frameworks-through-lumiose-stsx.md
  - >-
    backlog/tasks/task-571 -
    Spike-.stsx-in-React-React-Router-and-Solid-through-lumiose-stsx.md
priority: low
ordinal: 576000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
React Router 8.4 hard-codes `.[jt]sx?` in its route-module transforms (refresh, route exports) and matches module ids against routes.ts paths, so `.stsx` route modules cannot work (TASK-571). Draft the issue or RFC text in this task. Nothing is posted until the user has reviewed it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The task notes hold a draft that describes the problem, the transforms involved and a minimal API proposal
- [ ] #2 The user has reviewed the draft before anything is posted
<!-- AC:END -->
