---
id: TASK-221
title: Style placement convention in @lumiose/site-kit
status: To Do
assignee:
  - Halo
created_date: '2026-10-11 01:24'
labels:
  - styles
  - site
milestone: m-7
dependencies: []
priority: medium
ordinal: 223000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-40 (user 2026-10-11): teach and use one top-level <style> at the end of the file by default, shared by every component in it; nested blocks only to scope one element's subtree or to read a component-local $constant. The docs show and explain both placements. Apply it to packages/site-kit/src (13 files with <style>, 11 nested). The showcase must look the same.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each .stsx file uses one top-level <style> at the end of the file by default; every remaining nested block scopes an element subtree or reads a component-local constant
- [ ] #2 Rendering is unchanged: tests and e2e pass, and before/after screenshots of the main pages match (watch for selectors that now reach other components in the same file)
<!-- AC:END -->
