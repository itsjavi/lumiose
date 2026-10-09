---
id: TASK-178
title: 'Emit LUM4004: browser APIs at module scope'
status: To Do
assignee:
  - Photon
created_date: '2026-10-09 14:59'
labels:
  - compiler
  - diagnostics
dependencies: []
priority: medium
ordinal: 178000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the eval suite (TASK-40): LUM4004 is documented and registered but never emitted; reading localStorage (or window/document/navigator…) at module scope of a server-rendered module passes lumen check and crashes SSR.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Compiler emits LUM4004 for browser globals evaluated at module top level of modules in server graphs (not inside functions, effects or typeof guards); lumen check/LSP/Vite agree; tests; LUM4004 docs accurate
<!-- AC:END -->
