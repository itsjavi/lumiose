---
id: TASK-44
title: Align server runtime with client parity rules
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-08 13:28'
labels: []
milestone: m-2
dependencies:
  - TASK-13
priority: medium
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The client DOM runtime (TASK-13) settled value-rendering rules that SSR output must match exactly, otherwise hydration mismatches and inconsistent HTML follow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 server text() renders booleans as empty (like client setText)
- [ ] #2 server attr() writes aria-* and enumerated attributes (draggable, spellcheck, contenteditable, translate…) as "true"/"false" and removes plain boolean attributes on false (like client setAttr)
- [ ] #3 index.server.ts exports server versions of ref, Portal (renders nothing / or into a deferred region: decide and document), and Dynamic
- [ ] #4 parity tests compare server output with client DOM serialization for the same inputs
<!-- AC:END -->
