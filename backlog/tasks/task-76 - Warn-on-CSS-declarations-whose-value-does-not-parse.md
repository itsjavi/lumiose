---
id: TASK-76
title: Warn on CSS declarations whose value does not parse
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-08 16:37'
labels: []
milestone: m-5
dependencies: []
priority: low
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while building @lumen/site-kit (TASK-59): 'grid-template-columns: 2fr repeat(auto-fit, minmax(9rem, 1fr))' (invalid: an auto-repeat cannot be combined with flexible tracks) compiled without a diagnostic, and the browser dropped it. lumen_css keeps values of known properties that Lightning CSS cannot parse as unparsed tokens (also 'color: notacolor', 'width: 10 px'), so typos reach the browser silently. LUM3015 currently covers dropped selectors only. Related: TASK-67 (the '$gap px' case is one instance).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen_css reports a warning (LUM3015 or a new registered code) for a declaration of a known property whose value does not parse and contains no var()/env()/attr(), with the property and value in the message
- [ ] #2 No warning for valid values, custom properties or vendor-prefixed properties Lightning CSS does not know; tests in crates/lumen_css
<!-- AC:END -->
