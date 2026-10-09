---
id: TASK-117
title: Fold booleanish and ARIA static attributes like the runtime
status: Done
assignee:
  - Photon
created_date: '2026-10-09 04:20'
updated_date: '2026-10-09 04:35'
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
- [x] #1 aria-*, spellcheck, draggable, contenteditable (and the rest of the runtime BOOLEANISH set) fold to ="true"/="false" on client and server; real boolean attributes unchanged
- [x] #2 Goldens + client/server parity test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-09): element.rs is_booleanish (the runtime BOOLEANISH set: aria-*, contenteditable, draggable, spellcheck, writingsuggestions, preserveAlpha and the MathML ones); static Literal::Bool (incl. bare attributes) folds to name="true"/"false" in client templates and server strings; other attributes unchanged (true present, false absent). Goldens: new fixtures/client/booleanish.tsx (client + server), templates.* updated (aria-hidden={false} and bare spellcheck now fold to values). Parity: packages/compiler/test/server.test.ts 'booleanish and ARIA attributes, static and dynamic' (server HTML = client DOM, and the folded span equals the runtime-set one). Docs: concepts/jsx.md attribute table.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Static aria-*/enumerated attributes fold to "true"/"false" like the runtime on client and server; goldens + parity test; jsx.md documents the rule.
<!-- SECTION:FINAL_SUMMARY:END -->
