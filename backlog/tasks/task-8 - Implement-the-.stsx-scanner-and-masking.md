---
id: TASK-8
title: Implement the .stsx scanner and masking
status: In Progress
assignee:
  - '@Photon'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 12:32'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Deps (deps.lock): pin oxc_allocator/oxc_ast/oxc_parser/oxc_span =0.153.0, napi/napi-derive/napi-build, wasm-bindgen, serde in [workspace.dependencies].
2. lumen_compiler::span (Span u32 byte offsets, Utf16 index) and diagnostics/{mod,registry}.rs: Diagnostic {code, severity, message, span, labels, help, fix, docs}, registry of all spec 5.4 codes.
3. lumen_compiler::scanner/{mod,lexer,jsx,block,css_refs,mask,diagnose}: explicit mode-stack state machine (JS with paren/bracket/brace kinds and expr-start tracking, template, JSX tag, JSX children, JSX expr container; strings/comments/regex atomic), TS generic-arrow lookahead, speculative JSX roots with rollback (generic fn types), style block recognition + placement (TopLevel / InJsx{parent} / Expression), global attr, SVG subtree, CRLF; $ref extraction from CSS values and @media/@container/@supports preludes.
4. Masking plan rendered to UTF-8 String and UTF-16 Vec<u16> (block -> spaces keeping line terminators; Expression -> null; top-level $ -> ; / JSX $ -> { with first non-newline char after ref -> ; or }).
5. Diagnostics LUM1003-1006, 3010, 3011; LUM3013 via oxc_parser on the masked text, only when a top-level block has refs.
6. Tests: golden fixtures (masked output + JSON summary), every masked output parses with oxc_parser as TSX, identity corpus of style-free TSX, UTF-16 offset tests.
7. lumen_napi (napi-rs v3) scan() with UTF-16 offsets + packages/compiler (@lumen/compiler, @napi-rs/cli 3) darwin-arm64 .node smoke test; lumen_wasm scan() via wasm-bindgen (host compile).
8. cargo test/clippy -D warnings/fmt --check.
<!-- SECTION:PLAN:END -->
