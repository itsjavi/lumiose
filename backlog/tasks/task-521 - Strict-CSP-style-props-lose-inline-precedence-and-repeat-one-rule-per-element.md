---
id: TASK-521
title: 'Strict CSP: style props lose inline precedence and repeat one rule per element'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-23 08:17'
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
- [ ] #1 A style prop wins over a scoped class rule setting the same property under strict CSP, as an inline style does, with a test
- [ ] #2 Identical style declarations in one response share one rule, with a test and the size change measured on a long list
- [ ] #3 The Security docs describe how style props are written under strict CSP, precedence included
<!-- AC:END -->
