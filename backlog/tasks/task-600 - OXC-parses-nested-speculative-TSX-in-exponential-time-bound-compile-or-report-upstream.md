---
id: TASK-600
title: >-
  OXC parses nested speculative TSX in exponential time: bound compile() or
  report upstream
status: In Progress
assignee:
  - Photon
created_date: '2026-11-10T12:19:00Z'
updated_date: '2026-11-11T02:16:00Z'
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
- [x] #2 compile() on the reproduction returns in bounded time, with a regression test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Solo takeover by Lux (standalone session, user request 2026-11-11).

Minimal trigger: 'a <(n = ' nested ('a < (n = a < (n = 0))'), which doubles oxc_parser 0.158's parse time per level (220 µs at 10 levels, 12 ms at 16): it reads '<' as type arguments, parses a function type whose parameter default is the next level, fails, and parses the text again as a comparison. '<[(n = ' and '<{m(n = ' do the same.

Fix: crates/lumiose_compiler/src/depth.rs check() also counts the brackets open at once that were opened after a '<' that no '>', ';', '=', '&&' or '||' closed ('=>' does not close it), and rejects the file with LUM1010 past MAX_SPECULATION = 10. compile(), compile_tsx() and the constants resolver's module parse use it. The 48 s reproduction now returns LUM1010 in milliseconds (tests/compile_api.rs lum1010_bounds_nested_speculative_type_arguments). None of the repository's 1769 TS/TSX/STSX sources trips the limit; a generated .d.ts with zod types nested more than 10 inline object types deep does, which the LUM1010 page documents.

The guard is a heuristic: other speculative constructs may still be slow; the nightly fuzz will show them. AC #1 (upstream report) waits for the user's approval of the report text.
<!-- SECTION:NOTES:END -->
