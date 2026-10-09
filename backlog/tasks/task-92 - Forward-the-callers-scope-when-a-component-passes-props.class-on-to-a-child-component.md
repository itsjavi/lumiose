---
id: TASK-92
title: >-
  Forward the caller's $$scope when a component passes props.class on to a child
  component
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 21:27'
updated_date: '2026-10-09 03:41'
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
- [x] #1 A class forwarded through an intermediate component keeps the original caller's scope on the final element (client and SSR), covered by a golden fixture and a runtime test
- [x] #2 Contract doc-2 / spec note on forwarding updated
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
components.rs props_expression: when a component call passes `class` whose value may carry the current component's own class prop (ClassFlow via reads_props_class, checked on the raw attribute value), $$scope becomes the own tokens plus props.$$scope: "<own> " + (props.$$scope ?? "") (the runtimes skip empty tokens), or props.$$scope alone when the component has no styles; unchanged otherwise. Same code for client and server (props_expression is shared). Golden class-forwarding.tsx; server.test.ts SSR render + client/server parity case; styles.md note; doc-2 note proposed to Lux (contract owner).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon: implemented. Evidence: golden crates/lumen_compiler/tests/fixtures/client/class-forwarding.{tsx,js,server.js,css} (Middle: $$scope: "data-l-xv47rtvg " + (props.$$scope ?? ""); unstyled destructured Plain: $$scope: props.$$scope; Own passing a literal class: own tokens only). packages/compiler/test/server.test.ts: SSR renders <span class="mid cta" data-l-<Middle> data-l-<Outer>> through Outer → Middle → Inner and <span class="cta" data-l-<Outer>> through the unstyled Plain; parity case 'class forwarding (TASK-92)' mounts the client build and matches the server DOM (so the client element carries both tokens too). styles.md class passthrough paragraph documents forwarding. cargo test/clippy/fmt -p lumen_compiler, pnpm test 1025/1025 (after docs:gen). AC #2 needs Lux (doc-2 is the contract owner's): proposed addition to doc-2 §1 'Props are getter objects' after the $$scope bullet: '- A component that passes its own class prop on to a child component (the class value may carry props.class) forwards its caller's scope: $$scope is its own tokens plus props.$$scope ("data-l-m1 " + (props.$$scope ?? "")), or props.$$scope when it has no styles. Runtimes skip empty tokens.' and spec doc-1 §4.6.2: 'Forwarding through intermediate components keeps the original caller's tokens.'
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A component forwarding its own class to a child passes its caller's scope ($$scope = own tokens + props.$$scope). Golden class-forwarding, SSR and parity tests, styles.md; doc-2 §1 updated by Lux. Commit 060b19f.
<!-- SECTION:FINAL_SUMMARY:END -->
