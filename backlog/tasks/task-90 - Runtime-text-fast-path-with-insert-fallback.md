---
id: TASK-90
title: 'Runtime: text fast path with insert fallback'
status: To Do
assignee:
  - '@Spark'
created_date: '2026-10-08 21:05'
labels: []
milestone: m-1
dependencies:
  - TASK-13
priority: medium
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Photon's TASK-65 can compile benchmark-style rows ({id}, {row.label()}) to text nodes only if the runtime offers a helper that is a plain text write for strings/numbers and falls back to insert semantics otherwise (option A in the TASK-65 notes). Lux approved option A.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen/dom exports insertText(parent, value, marker) (or an equivalent name), contract doc-2 and client.ts updated via a note to Lux: strings/numbers go to a single text node (data write on change), other values fall back to insert reconciliation; reactive sources bind once
- [ ] #2 Hydration claims the server text() hole for the fast path (no LUM4006); server text() parity; tests; size delta ≤ 120 B brotli
<!-- AC:END -->
