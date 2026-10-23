---
id: TASK-526
title: >-
  Strict CSP: a style property the client removes after hydration falls back to
  the server rule
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-23 09:04'
updated_date: '2026-10-23 19:35'
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
Found while doing TASK-521 (decision-78). Under lumiose({ csp: "strict" }) the server writes a style prop as a [data-l-v="N"]:not(#a#b){…} rule and the element keeps data-l-v after an island hydrates, because the rule still carries the declarations the client never sets: static parts of a style object stay in the claimed server DOM (the compiler bakes them into the client template, which hydration does not apply). The client sets the dynamic parts through the CSSOM, whose inline styles win over the rule, so updates show. But removing a property does not: style={{ color: on() ? "red" : null }} rendered red on the server stays red after setStyleProperty(el, "color", null) or setStyle with a string that drops it, since removeProperty() uncovers the rule's color:red. Inferred from packages/lumiose/src/dom/attributes.ts (setStyle, setStyleProperty) and the compiler's class-style fixture; confirm with a hydration test first. Likely fix: on the first style write to a hydrated element with data-l-v, apply its whole style through the CSSOM (the compiler would pass the static parts) and remove data-l-v. Touches packages/lumiose/src/dom (Spark) and possibly the client codegen (Photon).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A hydration test shows whether a removed style property falls back to the server rule under strict CSP
- [x] #2 If it does, removing a style property after hydration under strict CSP leaves the property unset, as without CSP, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (0.6.1 cleanup, worker for Lux): claimed; starting with a hydration test under strictStyles.

Nova: confirmed before the fix in happy-dom (new hydrate test) and in Chromium (temporary island in examples/ssr-bookshelf, production build with the strict CSP header): after hydration a removed color stayed red from the [data-l-v] rule in all three binding shapes (per-key setStyleProperty, setStyle string, setStyle object). The task's premise that static parts stay in the client template holds only without strictCsp: strict builds (the Vite plugin passes strictCsp to both targets) compile static style parts to setStyleProperty/setStyle calls, so hydration sets every declaration through the CSSOM. No compiler change was needed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Under csp: "strict", a style property an island removes after hydration is now unset, as without CSP, instead of falling back to the server's [data-l-v] rule. Strict builds set every declaration of a style prop through the CSSOM while hydrating (static parts included), so setStyle and setStyleProperty drop the element's data-l-v on their first write while the hydration cursor is installed (packages/lumiose/src/dom/attributes.ts); outside hydration they pay one undefined check. Test: hydrate.test.ts 'hydrate: strict-CSP style props (TASK-526)' (fails before the fix). Chromium check: production build of a temporary probe island with the strict CSP header, red before the fix, inherited color after, no CSP violations. Docs: concepts/security.md (Hydration bullet); decision-78 consequences updated. Validation: pnpm check green.
<!-- SECTION:FINAL_SUMMARY:END -->
