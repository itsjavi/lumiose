---
id: TASK-574
title: 'Runtimes apply attribute or class scope tokens (applyScope, server attributes)'
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-25 00:31'
updated_date: '2026-10-25 00:54'
labels:
  - runtime
  - css
milestone: m-14
dependencies:
  - TASK-573
references:
  - >-
    backlog/decisions/decision-85 -
    Scoped-styles-attribute-or-class-strategy-specificity-and-namespace-scopedStyles.md
  - packages/lumiose/src/dom/attributes.ts
  - packages/lumiose/src/server/attrs.ts
priority: medium
ordinal: 566000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implements decision-85 in the runtimes. Class passthrough tokens arrive in `$$scope` in the format agreed in the compiler task.
- `applyScope` (packages/lumiose/src/dom/attributes.ts) applies them as attributes or through `classList`.
- The server attribute writer (packages/lumiose/src/server/attrs.ts) merges class tokens into the element's single `class` attribute. That file is in Nova's area; the orchestrator allows the edit for this task.
- Dynamic class bindings and hydration keep the scope classes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 applyScope applies attribute tokens as empty attributes and class tokens through classList, leaving other classes alone
- [x] #2 The server attribute writer merges class tokens into one class attribute, escaped like other classes
- [x] #3 A dynamic class binding on an element with scope classes keeps them on every update
- [x] #4 Hydrating server-rendered class-scoped elements causes no mismatch; vitest covers both strategies on the client and the server
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux): standalone takeover of Spark's task at the user's request (M14 run).

2026-10-25 (Lux): applyScope applies ".name" tokens through classList (attribute names as before). Server: classAttr(value, scope?) merges the ".name" tokens of scope; spreadAttrs(props, custom?, scope?) merges the element's own scope classes and the ".name" tokens of props.$$scope into the class it writes (or writes one, also for a nullish spread), and keeps attribute tokens as attributes. setClass already removes only its own classes. Tests: ssr.test (classAttr/spreadAttrs merging), attributes.test (applyScope classes and a dynamic class binding keeping them), and hydrate.test (a class-strategy .stsx compiled for both targets, server-rendered, hydrated without LUM4006, nodes claimed, toggled classes keep the scope class, passthrough class on the child). lumiose vitest 1221 passed; size script passes (its OVER lines are soft targets of the island loader, unchanged).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Both runtimes apply class-strategy scope tokens: applyScope adds .name tokens as classes, and the server merges scope classes into the single class attribute (classAttr and spreadAttrs take the scope). Hydration of class-scoped markup is tested end to end.
<!-- SECTION:FINAL_SUMMARY:END -->
