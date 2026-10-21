---
id: TASK-496
title: Spreads still write srcdoc (Low)
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-20 23:55'
updated_date: '2026-10-21 00:26'
labels:
  - security
dependencies: []
priority: high
ordinal: 492000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Delta review finding C3 (TASK-472 L3 not closed): packages/lumiose/src/dom/spread.ts:14 and server/attrs.ts:204-213. <iframe {...payload}/> with {srcdoc: '<script>…'} runs script with the page's origin (a strict CSP blocks it). Treat srcdoc like innerHTML: only a written prop sets it. Also keep the docs warning prominent that Dynamic applies innerHTML/textContent from its props (Info C4).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A spread never writes srcdoc, on the server or in the DOM; a written srcdoc prop still works
- [x] #2 Tests cover both targets; the docs list srcdoc with innerHTML and textContent and warn about Dynamic's props
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-21), commits a6ba7dfa, d23f8d7f:
- dom/spread.ts CONTENT and server/attrs.ts SRCDOC drop srcdoc in any case (attribute names are case-insensitive, so srcDoc would set it too).
- Compiler take_written: a written srcdoc next to a spread is taken out of the spread and applied after it, as innerHTML and textContent are (TASK-478), so it still works.
- Dynamic applies srcdoc from its props on both targets (its props are written props), like innerHTML and textContent.
- Tests: server/parity.test.ts (spread on both sides with srcdoc, srcDoc, SRCDOC; Dynamic iframe), dom/hydrate.test.ts (compiled: spread payload dropped, written srcdoc next to a spread and alone, hydrates and updates), compiler golden spread-content.
- Docs: concepts/security.md (srcdoc listed, Warning callout that Dynamic applies innerHTML, textContent and srcdoc from its props), concepts/jsx.md, reference/jsx.md, guides/web-components.md, reference/components.md (Warning callout).
- Validation: as TASK-495 (same run).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A spread never writes srcdoc (any case), on the server or in the DOM; a written srcdoc works alone and next to a spread, and Dynamic applies it as a written prop. Tests cover both targets and the compiled output; docs list srcdoc with innerHTML and textContent and warn prominently about Dynamic.
<!-- SECTION:FINAL_SUMMARY:END -->
