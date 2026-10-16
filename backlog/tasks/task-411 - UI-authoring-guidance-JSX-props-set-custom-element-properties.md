---
id: TASK-411
title: 'UI authoring guidance: JSX props set custom-element properties'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-16 00:24'
labels:
  - ui
  - docs
milestone: m-12
dependencies:
  - TASK-375
priority: low
ordinal: 410000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Halo in TASK-375 (2026-10-16). The runtime sends a JSX prop to the custom element's property of the same name. A read-only getter with that name, such as `min` on `lu-number-field`, makes hydration throw. Record the rule wherever @lumiose/ui's authoring conventions live (the docs structure or a contributor note): a `lu-` element's getters either have setters or don't share a name with a prop the component renders. Consider a dev-time check.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The rule is documented where component authors read it
- [ ] #2 A test or dev warning catches a read-only getter shadowed by a rendered prop, or its absence is recorded with the reason
<!-- AC:END -->
