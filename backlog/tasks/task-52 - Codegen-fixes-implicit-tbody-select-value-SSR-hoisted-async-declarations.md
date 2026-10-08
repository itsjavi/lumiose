---
id: TASK-52
title: 'Codegen fixes: implicit tbody, select value SSR, hoisted async declarations'
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-08 15:30'
updated_date: '2026-10-08 16:01'
labels: []
milestone: m-2
dependencies:
  - TASK-15
priority: medium
ordinal: 52000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Photon's TASK-14/15 report found three issues: rows rendered directly in <table> hydrate wrongly (the parser inserts tbody), <select value> isn't reflected in SSR, and $async wrapping turned async component declarations into non-hoisted consts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Direct <tr> children and row-producing .map()/branches of <table> are wrapped in an implicit <tbody> in both client templates and server output (HTML parsing semantics); fixtures
- [ ] #2 <select value={v}> marks the matching <option> as selected in SSR output, for static and .map()-generated options; fixtures
- [ ] #3 Async component function declarations stay hoisted: emit async function X(){…} plus $async(X) instead of a const; fixtures
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (session photon-task45-20261008T153134Z) claimed TASK-52.
<!-- SECTION:NOTES:END -->
