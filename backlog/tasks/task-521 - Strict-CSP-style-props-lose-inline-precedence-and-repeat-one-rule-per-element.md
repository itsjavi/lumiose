---
id: TASK-521
title: 'Strict CSP: style props lose inline precedence and repeat one rule per element'
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-23 08:17'
updated_date: '2026-10-23 09:05'
labels:
  - csp
  - styles
  - performance
milestone: m-13
dependencies: []
priority: medium
ordinal: 515000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by a port of a private app of the author's (TASK-492, doc-11). Under lumiose({ csp: "strict" }) the server writes each style prop as a [data-l-v="N"]{…} rule of a nonce'd <style> (packages/lumiose/src/server/attrs.ts).

1. Precedence. Such a rule has the specificity of one attribute selector, so a scoped class rule of a component (.x[data-l-hash], 0,2,0), or even a :where() default of the same specificity that comes later, wins over it, where an inline style attribute wins over every non-important rule. The same component then renders differently with and without strict CSP, and an island's element changes when it hydrates (the browser sets styles through the CSSOM, with inline precedence). Seen with an icon component whose aspect-ratio style prop lost to the component's own default, on every server-rendered page.
2. Size. A server-rendered list with a style prop on each item writes one rule per element, about 40 bytes each: about 4,900 rules on a list page of about 1,600 items before the port moved the value into its stylesheet. Identical declaration blocks could share one rule (one data-l-v id per distinct block in a response).

Options for 1: write the declarations with !important (the closest to an inline style's precedence), or a selector that outranks scoped rules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A style prop wins over a scoped class rule setting the same property under strict CSP, as an inline style does, with a test
- [x] #2 Identical style declarations in one response share one rule, with a test and the size change measured on a long list
- [x] #3 The Security docs describe how style props are written under strict CSP, precedence included
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Approach (decision-78, packages/lumiose/src/server/strict-styles.ts): rules read [data-l-v="N"]:not(#a#b){…}; :not(#a#b) matches every element and weighs two ids, (2,1,0) in all. Rejected !important: it would win over CSS animations, and over the client's CSSOM styles after hydration, since the element keeps data-l-v for its static declarations. Identical declarations share one rule per response; an element reuses a rule only from its own unit, a unit it streams inside, or a flushed unit (a pending sibling boundary may fail). Precedence evidence (Playwright, same page with and without strict CSP): Chromium, Firefox and WebKit compute the same values against a scoped rule, an id rule (#app .icon), a later :where() default, an !important rule and a running animation, and CSSOM styles win afterwards. happy-dom weighs :not() as one class, so the unit test covers scoped rules, !important and CSSOM only. Size, list of about 1,600 items with three style props per item (1, 12 and 100 distinct values): about 4,800 rules, 252,212 B before; 113 rules, 105,672 B after; inline style attributes 129,974 B. Found: TASK-526 (a property removed after hydration falls back to the server rule).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Strict-CSP style props now render as inline styles do: their rules read [data-l-v="N"]:not(#a#b){…}, weighing two ids, so they win over scoped component rules and later :where() defaults while animations, !important rules and the client's CSSOM styles still win over them (same computed values with and without strict CSP in Chromium, Firefox and WebKit). Identical declarations share one rule per response, reused only where the rule is sure to be in the document (own unit, enclosing units, flushed units): a list of about 1,600 items goes from about 4,800 rules and 252,212 B to 113 rules and 105,672 B. Tests: strict-styles.test.ts (happy-dom precedence, long list, reuse across streamed boundaries), updated render, streaming and csp tests. Docs: concepts/security.md. Decision: decision-78. Follow-up: TASK-526.
<!-- SECTION:FINAL_SUMMARY:END -->
