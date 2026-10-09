---
id: TASK-117
title: Fold booleanish and ARIA static attributes like the runtime
status: To Do
assignee:
  - Photon
created_date: '2026-10-09 04:20'
labels:
  - compiler
  - bug
dependencies: []
priority: high
ordinal: 117000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-38 finding 2. Static folding drops attr={false} and emits bare attr for {true} for every name (client element.rs:388, ssr.rs:514), so aria-pressed={false}, spellcheck={false}, draggable={false}, contenteditable={false} vanish and aria-*={true} renders as an empty value. The runtime BOOLEANISH rule (server/attrs.ts:13) stringifies them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 aria-*, spellcheck, draggable, contenteditable (and the rest of the runtime BOOLEANISH set) fold to ="true"/="false" on client and server; real boolean attributes unchanged
- [ ] #2 Goldens + client/server parity test
<!-- AC:END -->
