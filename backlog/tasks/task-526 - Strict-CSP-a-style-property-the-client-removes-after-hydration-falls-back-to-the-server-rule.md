---
id: TASK-526
title: >-
  Strict CSP: a style property the client removes after hydration falls back to
  the server rule
status: To Do
assignee: []
created_date: '2026-10-23 09:04'
labels:
  - csp
  - styles
  - hydration
dependencies: []
priority: low
ordinal: 520000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while doing TASK-521 (decision-77). Under lumiose({ csp: "strict" }) the server writes a style prop as a [data-l-v="N"]:not(#a#b){…} rule and the element keeps data-l-v after an island hydrates, because the rule still carries the declarations the client never sets: static parts of a style object stay in the claimed server DOM (the compiler bakes them into the client template, which hydration does not apply). The client sets the dynamic parts through the CSSOM, whose inline styles win over the rule, so updates show. But removing a property does not: style={{ color: on() ? "red" : null }} rendered red on the server stays red after setStyleProperty(el, "color", null) or setStyle with a string that drops it, since removeProperty() uncovers the rule's color:red. Inferred from packages/lumiose/src/dom/attributes.ts (setStyle, setStyleProperty) and the compiler's class-style fixture; confirm with a hydration test first. Likely fix: on the first style write to a hydrated element with data-l-v, apply its whole style through the CSSOM (the compiler would pass the static parts) and remove data-l-v. Touches packages/lumiose/src/dom (Spark) and possibly the client codegen (Photon).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A hydration test shows whether a removed style property falls back to the server rule under strict CSP
- [ ] #2 If it does, removing a style property after hydration under strict CSP leaves the property unset, as without CSP, with a test
<!-- AC:END -->
