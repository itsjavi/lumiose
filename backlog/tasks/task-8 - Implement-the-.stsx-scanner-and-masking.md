---
id: TASK-8
title: Implement the .stsx scanner and masking
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 13:10'
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
- [x] #1 The scanner implements the mode stack, the <style> recognition rules, placements, the global attribute, SVG style handling and CRLF, per spec §4.1
- [x] #2 Produces masked output in both UTF-8 bytes and UTF-16 code units, with the $ref masking rules (top-level ';' and JSX '{…}' using the first non-newline character)
- [x] #3 Emits LUM1003, LUM1004, LUM1005, LUM1006, LUM3010, LUM3011, LUM3013
- [x] #4 Golden tests pass, including the identity test on a style-free TSX corpus; scan() is exposed through napi and wasm
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation (Photon)
Structure: crates/lumen_compiler/src/{span.rs, diagnostics/{mod,registry}.rs, scanner/{mod,lexer,jsx,block,css_refs,mask,declarations,chars,tests}.rs}. Public API: scan(source, filename) / scan_kind(source, FileKind) -> ScanResult { kind, blocks, diagnostics, masked(), masked_utf16(source), map_spans(f) }; StyleBlock { span, open_tag, content, close_tag, placement: TopLevel | InJsx{parent: JsxParent{kind, name, span}} | Expression, global, svg, attributes, refs: StyleRef{span, path, close} }; Diagnostic { code, severity, message, span, labels, help, fix } + docs(); registry.rs lists every spec 5.4 code.

Decisions:
- Lexer = explicit mode stack (JS paren/bracket/brace kinds, template, JSX tag, JSX children, JSX containers; strings/comments/regex atomic) with expression-start tracking. TS generic arrows use TypeScript's TSX lookahead rule (<T,>, <T = ...>, <T extends U>). Generic function types (type F = <T>(x: T) => T, call signatures) are resolved by speculation: every JSX root has a checkpoint; JSX text containing > or } or a malformed tag rewinds and re-reads < as an operator. Mismatched closing tags recover (close up to the matching ancestor).
- Top level: <style at module top level is a block after a statement end, or on a new line after an operand / closing type args (no-semicolon style, as const, satisfies X<Y>). On the same line after an operand it is a comparison; LUM1003 (warning) if a </style> follows before any other <style.
- LUM1003 also (error) for an unterminated template literal / block comment that swallows <style.
- LUM3010: parent is a component element; block inside a {...} container / attribute value / conditional root (?, :, &&, ||, ??); statement-level block inside a function. LUM3011: expression positions (return/=>/{...}/attribute value) and a root fragment whose only children are style blocks. Not lexically detectable: .map() callbacks outside JSX containers -> left to analysis (TASK-9/10) on the OXC AST.
- LUM3013: parse the masked text with oxc_parser only when a top-level block has refs; lexical top-level bindings (const/let/using/class, destructuring, export) declared after the ref.
- LUM1005: unknown attribute (fix removes it), global with a value (fix), stray tag characters. SVG <style> keeps static attributes. LUM1006: .tsx <style> whose content is raw text (not {..}/empty); masked like .stsx so TSX still parses. LUM1004: unclosed open tag or no </style>; the block runs to EOF.
- SVG: inside <svg> (inherited through containers, reset by foreignObject) -> svg=true, masked, no refs.
- Refs: values and @media/@container/@supports preludes only; not selectors/property names/strings/comments/url(). $brand-primary yields brand (LUM3009 belongs to TASK-10). close = first non-line-terminator char after the ref; a ref cannot start at the previous ref's close.
- Masking: UTF-8 and UTF-16 rendered from one plan (spaces per byte / per code unit, line terminators kept). Extensions to spec 4.1: attribute-value expression blocks mask to {null} (bare null is not a valid attribute value); <style ... /> is an empty block.
- Fast path: no '<style' substring or .ts/.js -> identity without lexing.

Bindings:
- napi: crates/lumen_napi (napi =3.14.2, napi4 + dyn-symbols) exposes scan() and version() with UTF-16 offsets and the UTF-16 masked text. New package packages/compiler (@lumen/compiler, ownership addition for Photon) with @napi-rs/cli ^3.10.0 (3.10.8): pnpm --filter @lumen/compiler build -> compiler.darwin-arm64.node (built), ESM loader + string-union typings (--no-const-enum), generated files formatted by oxfmt in the build script. Platform packages resolve as @lumen/compiler-<platform> (spec 5.5).
- wasm: crates/lumen_wasm scan()/version() via wasm-bindgen + serde-wasm-bindgen (lumen_compiler 'serde' feature), UTF-16 offsets. Compiled and unit-tested on the host; the wasm32 target is not installed, so no .wasm artifact yet (needs rust-toolchain targets + wasm-bindgen-cli, playground task).
- Deps pinned in [workspace.dependencies]: oxc_allocator/oxc_ast/oxc_parser/oxc_span =0.153.0, serde =1.0.229, napi =3.14.2, napi-derive =3.6.12, napi-build =2.6.0, wasm-bindgen =0.2.129, serde-wasm-bindgen =0.6.5.

Validation: cargo test --workspace (lumen_compiler: 29 unit tests incl. CRLF/UTF-16/speculation/placements; golden test over 13 fixtures with .masked + .snap files, every non-broken masked output parses with oxc_parser in both UTF-8 and UTF-16 views; identity test over 11 style-free TSX corpus files, each also re-scanned with a trailing top-level block to prove the lexer ends at the top level; lumen_wasm 1), cargo clippy --workspace --all-targets -D warnings, cargo fmt --check, vitest project compiler 4/4 against the built .node, tsc and oxlint clean for packages/compiler. Opt-in external corpus test (LUMEN_SCAN_CORPUS, ignored by default): 4,615 real-world TSX files from local projects all keep identity and end at top level.

Follow-ups for Lux: (1) .oxfmtrc.json must ignore **/fixtures/** like .oxlintrc.json does; otherwise 'oxfmt .' rewrites crates/lumen_compiler/tests/fixtures/** and breaks the goldens (tsx-raw-css.tsx is intentionally not valid TSX). (2) AGENTS.md ownership table: add packages/compiler/** to Photon. (3) pnpm-lock.yaml changed (+@napi-rs/cli).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the shared .stsx scanner in lumen_compiler (mode-stack lexer with TSX generic-arrow lookahead and speculative JSX roots, style block recognition and placement, SVG and CRLF handling, $ref extraction, masking rendered to UTF-8 and UTF-16 from one plan), the diagnostics module with the spec 5.4 registry, and diagnostics LUM1003-1006, 3010, 3011 and 3013 (3013 via an oxc_parser parse of the masked text). scan() is exposed through lumen_napi (built as compiler.darwin-arm64.node in the new @lumen/compiler package, UTF-16 offsets, string-union typings) and lumen_wasm (wasm-bindgen; host-compiled, no wasm32 artifact yet). Verified with cargo test --workspace (29 unit tests, 13 golden fixtures whose masked output parses in both offset spaces, an 11-file identity corpus), clippy -D warnings, fmt --check, a vitest smoke test of the native addon (4/4), and an opt-in run over 4,615 real-world TSX files. Follow-ups for Lux: ignore **/fixtures/** in .oxfmtrc.json, add packages/compiler to Photon's ownership.
<!-- SECTION:FINAL_SUMMARY:END -->
