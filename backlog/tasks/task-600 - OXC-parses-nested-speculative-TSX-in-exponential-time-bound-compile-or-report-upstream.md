---
id: TASK-600
title: >-
  OXC parses nested speculative TSX in exponential time: bound compile() or
  report upstream
status: To Do
assignee:
  - Photon
created_date: '2026-11-10T12:19:00Z'
labels:
  - compiler
dependencies: []
priority: medium
ordinal: 592000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while fixing the nightly scan fuzz timeout (TASK-599). oxc_parser (0.153 and 0.158) backtracks exponentially on nested type-argument and arrow-function speculation. 'd = a <s,(n = a <[t((n = ' repeated 22 times, with balanced brackets, is valid TSX and takes 48 s to parse; each repetition roughly doubles the time. The scanner no longer parses with OXC, but compile() does, so the dev server, the language server and the compile_client and compile_server fuzz targets can still hang on such a file. Options: report it upstream (needs the user's approval before posting), and a pre-parse guard next to the nesting limit (LUM1010) if a cheap metric for this nesting exists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The exponential case is reported upstream or fixed by an OXC upgrade
- [ ] #2 compile() on the reproduction returns in bounded time, with a regression test
<!-- AC:END -->
