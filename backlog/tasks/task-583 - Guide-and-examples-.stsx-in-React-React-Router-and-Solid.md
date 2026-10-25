---
id: TASK-583
title: 'Guide and examples: .stsx in React, React Router and Solid'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-25 00:31'
labels:
  - docs
  - stsx
milestone: m-14
dependencies:
  - TASK-579
  - TASK-580
  - TASK-581
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
priority: medium
ordinal: 575000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A docs guide in packages/lumiose/docs/guides/ and three examples: examples/stsx-react, examples/stsx-react-router and examples/stsx-solid. Beacon owns these example directories; Lux adds them to AGENTS.md. Each example gets a build and SSR smoke test in CI, without Playwright unless a check needs a browser.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A docs guide covers setup, classAttribute, scopedStyles, class passthrough, :deep(), typegen and the React Router limits
- [ ] #2 The three examples build in CI with a smoke test each; for React Router, the SSR HTML links each route's CSS
- [ ] #3 docs:gen and docs:check pass, and llms.txt is regenerated through the docs generator
<!-- AC:END -->
