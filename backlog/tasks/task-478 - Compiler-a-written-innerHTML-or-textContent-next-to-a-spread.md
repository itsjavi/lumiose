---
id: TASK-478
title: 'Compiler: a written innerHTML or textContent next to a spread'
status: To Do
assignee: []
created_date: '2026-10-17 00:01'
labels:
  - compiler
  - security
dependencies: []
priority: low
ordinal: 475000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while fixing TASK-470 (Beacon, 2026-10-17). An element with a spread compiles every written prop into the spread object, on both targets, and since TASK-470 a spread never writes innerHTML or textContent (the server's spreadAttrs never did). So `<div {...rest} innerHTML={html} />` silently renders no HTML, on the server and the client, while the same prop without the spread works. Options: take written innerHTML and textContent out of the spread, as bind: attributes are (take_bindings), so they apply as written props on both targets; or report a diagnostic. The docs (jsx.md, security.md) currently say innerHTML works only on an element without a spread.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A written innerHTML or textContent next to a spread either works on both targets, with compiler fixtures, or reports a diagnostic
- [ ] #2 jsx.md and security.md match the behaviour
<!-- AC:END -->
