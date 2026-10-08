---
id: TASK-92
title: >-
  Forward the caller's $$scope when a component passes props.class on to a child
  component
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 21:27'
labels: []
dependencies: []
priority: low
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-75. <Inner class={props.class} /> inside Middle compiles $$scope to Middle's own scope tokens (components.rs props_expression), or omits it when Middle has no styles. The class string came from Middle's caller, whose scoped selector (.x[data-l-caller]) then never matches Inner's element. Spec doc-1 §4.6.2 says $$scope carries the caller's tokens; forwarding is not specified. Likely fix: when the class value may carry the component's own class prop (class_flow.rs), pass $$scope as the union of the current tokens and props.$$scope (a runtime join or a mergeScope helper), on client and server.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A class forwarded through an intermediate component keeps the original caller's scope on the final element (client and SSR), covered by a golden fixture and a runtime test
- [ ] #2 Contract doc-2 / spec note on forwarding updated
<!-- AC:END -->
