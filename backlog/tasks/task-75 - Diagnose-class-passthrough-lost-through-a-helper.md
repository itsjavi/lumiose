---
id: TASK-75
title: Diagnose class passthrough lost through a helper
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 16:37'
labels: []
milestone: m-5
dependencies: []
priority: low
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while building @lumen/site-kit (TASK-59). Class passthrough (applyScope with props.$$scope) is emitted only when props.class appears syntactically in an element's class expression. Moving the class value into a helper, e.g. class={variantClass(props)} where the helper returns ['btn', {…}, props.class], compiles to bind(el, () => variantClass(props), setClass) without applyScope: the parent's classes arrive but its scoped selectors silently stop matching. The kit inlines the class arrays to avoid it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Either passthrough also applies when a component passes props (or props.class) into a helper used as the class value of an element, or the compiler warns with a fix (inline props.class in the class expression)
- [ ] #2 Documented in concepts/styles (class passthrough) via a Beacon note if user-facing
<!-- AC:END -->
