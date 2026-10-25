---
id: TASK-574
title: 'Runtimes apply attribute or class scope tokens (applyScope, server attributes)'
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-25 00:31'
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
- [ ] #1 applyScope applies attribute tokens as empty attributes and class tokens through classList, leaving other classes alone
- [ ] #2 The server attribute writer merges class tokens into one class attribute, escaped like other classes
- [ ] #3 A dynamic class binding on an element with scope classes keeps them on every update
- [ ] #4 Hydrating server-rendered class-scoped elements causes no mismatch; vitest covers both strategies on the client and the server
<!-- AC:END -->
