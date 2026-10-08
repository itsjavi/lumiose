---
id: TASK-49
title: 'Runtime: parentless branch and list values'
status: In Progress
assignee:
  - '@Spark'
created_date: '2026-10-08 14:11'
updated_date: '2026-10-08 15:27'
labels: []
milestone: m-1
dependencies:
  - TASK-13
priority: medium
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Conditionals and .map() inside component children, fragments and nested ternaries currently fall back to tracked functions that re-render (Photon, TASK-9). The runtime needs parentless variants that return a Renderable, so the compiler can keep memoised branches and keyed lists everywhere.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 branchValue(cond, whenTrue, whenFalse?) and listValue(source, render, key?) return Renderables that insert() mounts with the same memoisation and keyed reconciliation as branch/list
- [ ] #2 Contract doc-2 and client.ts updated by Lux from Spark's proposal; tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark: claimed (session spark-task12-20261008T140314Z). Plan: branchValue/listValue return a range (RangeStart, like async components) whose own end marker anchors branch()/list(); insert() places it as one node.
<!-- SECTION:NOTES:END -->
