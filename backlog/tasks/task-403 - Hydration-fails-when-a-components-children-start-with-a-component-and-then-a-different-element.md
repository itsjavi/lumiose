---
id: TASK-403
title: >-
  Hydration fails when a component's children start with a component and then a
  different element
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-15 22:29'
labels:
  - runtime
  - hydration
milestone: m-12
dependencies:
  - TASK-365
priority: high
ordinal: 402000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Halo in TASK-365 (2026-10-15); the repros are in TASK-365's notes. In a client:load island, `<Wrap><B /><NS.P /></Wrap>` fails to hydrate (LUM4006) and the island renders on the client. The swapped order, two `<B />`, and a plain `<div><B /><p>x</p></div>` all hydrate. In @lumiose/ui, `Field.Control` followed by `Field.Description` hits it: the control's template never claims its server `<input>`. Same family as the fixed TASK-234. The ui-e2e form island works around it by putting the control last.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both repros hydrate without LUM4006, with a regression test
- [ ] #2 The ui-e2e form island uses the natural order (control before description) again
<!-- AC:END -->
