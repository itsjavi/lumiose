---
id: TASK-466
title: Reactivity diagnostics see JSX spreads
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-16 22:50'
labels:
  - compiler
  - diagnostics
dependencies: []
priority: low
ordinal: 464000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while fixing TASK-347 and TASK-349 (Photon, 2026-10-17). The analyzer counts identifiers in JSX expression containers as JSX references, but not spread arguments: `const attrs = { title: props.title }; <div {...attrs} />` reports no LUM2001, although the spread reads attrs once. And since TASK-347, `<span {...props} />` without content inserts props.children, but LUM2005 (children inserted twice) does not count that insert next to a written {props.children}.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A stale derived value that reaches JSX only through a spread attribute reports LUM2001
- [ ] #2 The children insert of an element with a props spread and no content counts for LUM2005
- [ ] #3 Compiler tests cover both
<!-- AC:END -->
