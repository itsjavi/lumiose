---
id: TASK-137
title: 'Language server: project-wide checks (LUM4003, LUM3012) and contract hovers'
status: To Do
assignee:
  - Beacon
created_date: '2026-10-09 04:54'
labels:
  - language-server
dependencies: []
priority: low
ordinal: 137000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-ups from Photon: TASK-116 (LUM4003 in the LSP via clientGraphDiagnostics from cli/check/client-graph.ts), TASK-62 (lumen check and LSP reuse CustomPropertyCheck for LUM3012), TASK-63 (hovers from the opt-in contract compile meta).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The LSP reports LUM4003 at import sites using the project client graph, incrementally
- [ ] #2 lumen check and the LSP report LUM3012 like lumen build
- [ ] #3 Hovers on JSX expressions show the contract meta (kind, helper, reactive reads)
<!-- AC:END -->
