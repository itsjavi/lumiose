---
id: TASK-127
title: Route-literal type helpers and inferred action types (decision-26 §1)
status: To Do
assignee:
  - Beacon
created_date: '2026-10-09 04:26'
labels:
  - types
  - app
  - dx
dependencies: []
priority: medium
ordinal: 127000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-26 §1: PageProps<P>, LayoutProps<P>, RequestContext/ActionContext/Action/Endpoint<P> by route pattern; actionData<typeof actions>() and submit<typeof actions.x>() inferred. Lux authorises edits in packages/lumen/src/app/{typegen,routes,server,actions}/** types and in all examples/templates for this task; coordinate with Spark (TASK-118 touches app/actions) through task notes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Types per decision-26 §1, checked against the typegen route table (unknown pattern = type error); RouteProps and params-object generics removed
- [ ] #2 actionData/submit infer data and fail() data from the actions export; type tests (expectTypeOf) cover success, failure, unknown action
- [ ] #3 All examples, create-lumen templates, docs and the AGENTS.md section use the new helpers; lumen check clean on every example
<!-- AC:END -->
