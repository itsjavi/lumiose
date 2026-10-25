---
id: TASK-587
title: >-
  Move ssg-travel-journal and ssr-bookshelf design tokens to CSS custom
  properties
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-25 02:33'
labels:
  - docs
  - css
  - examples
milestone: m-14
dependencies:
  - TASK-586
priority: low
ordinal: 579000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Decision-87 follow-up: examples/ssg-travel-journal and examples/ssr-bookshelf read a theme.ts design system through $theme.* in about 35 style blocks. Declare those values as custom properties on :root in the root layout's <style global> (typed names in an as const module where useful), keep $name for breakpoints and values JS also uses, update the READMEs, and keep their e2e tests green.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Neither example keeps design values in a TS module read with $
- [ ] #2 Breakpoints or JS-shared values still use $name where they apply
- [ ] #3 READMEs updated; the examples' tests and lumiose check pass
<!-- AC:END -->
