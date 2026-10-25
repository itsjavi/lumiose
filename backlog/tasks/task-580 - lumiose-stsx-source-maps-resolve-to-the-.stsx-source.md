---
id: TASK-580
title: '@lumiose/stsx: source maps resolve to the .stsx source'
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
ordinal: 572000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In the spike, production maps listed the virtual `*.stsx.tsx` ids beside the `.stsx` sources. Compose the emit map with the framework's transform, so that every segment resolves to the `.stsx` file with sourcesContent, in dev (devtools) and in builds. CSS maps point at the style blocks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Production JS source maps list only .stsx sources (no virtual *.stsx.tsx ids), with sourcesContent, for React and Solid
- [ ] #2 Dev source maps open the .stsx file at the right line in the browser devtools, checked with a breakpoint or a stack trace
- [ ] #3 CSS source maps resolve rules to the lines of their <style> blocks
- [ ] #4 A test asserts the sources and a sampled mapping
<!-- AC:END -->
