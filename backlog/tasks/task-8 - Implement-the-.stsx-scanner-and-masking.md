---
id: TASK-8
title: Implement the .stsx scanner and masking
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-08 12:20'
labels: []
milestone: m-1
dependencies:
  - TASK-5
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
All tools (compiler, shadow TSX, language server, lint, format) depend on one correct scanner and on the masking invariant that keeps TSX offsets identical (spec §4.1).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The scanner implements the mode stack, the <style> recognition rules, placements, the global attribute, SVG style handling and CRLF, per spec §4.1
- [ ] #2 Produces masked output in both UTF-8 bytes and UTF-16 code units, with the $ref masking rules (top-level ';' and JSX '{…}' using the first non-newline character)
- [ ] #3 Emits LUM1003, LUM1004, LUM1005, LUM1006, LUM3010, LUM3011, LUM3013
- [ ] #4 Golden tests pass, including the identity test on a style-free TSX corpus; scan() is exposed through napi and wasm
<!-- AC:END -->
