---
id: TASK-495
title: 'SSR: <style> and <script> text inside <svg> or <math> can break out (Medium)'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-20 23:55'
labels:
  - security
dependencies: []
priority: high
ordinal: 491000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Delta security review for 0.5.0 (Prism, 2026-10-21), finding C1, introduced by TASK-472 L7. The server codegen uses self.namespace() without html::root_namespace (crates/lumiose_compiler/src/codegen/client/ssr.rs:279-282; the client's build_element at element.rs:176 calls it), and rawText (packages/lumiose/src/server/node.ts:121) only neutralizes </tag and <!--. A component such as function Layer(p){ return <g><style>{p.css}</style></g> } rendered in <svg>, with css = '<img src=x onerror=…>', writes <svg><g><style><img …></style>, and the browser parses the <img> as HTML: script runs (also for a component whose root is <style>/<script>, or one passed as children, under <svg>/<math>). A strict CSP mitigates it; it also causes a hydration mismatch. Blocks the 0.5.0 release.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The server codegen picks the element namespace with html::root_namespace, as the client does
- [ ] #2 rawText is safe in foreign content too: in style and script text, a < before [A-Za-z!/?] is rewritten losslessly (\3c in CSS, \u003c-style escape in script)
- [ ] #3 Tests: the payload above under <svg> and <math> stays text in Chromium's parse (or an equivalent parser check), and <svg><Comp/> hydrates without mismatch
- [ ] #4 security.md and jsx.md state the raw-text guarantee precisely
<!-- AC:END -->
