---
id: TASK-29
title: Implement the language server
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 13:49'
labels: []
milestone: m-4
dependencies:
  - TASK-27
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Editors need full TS 7 features in .stsx plus CSS features in style blocks, without TS plugins (decision-6, spec §9.2).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Takeover proxy in front of one TS 7 native LSP for .ts/.tsx/.stsx: masked buffers, shadow URI rewriting in every request, response and workspace edit
- [ ] #2 CSS language service on style blocks with $refs replaced by same-length identifiers
- [ ] #3 Class completion from in-scope styles, go-to-definition and rename between classes and selectors, $ref hovers, compiler diagnostics; tests
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Probe TS 7: the typescript@7 package ships a native tsc (lib/getExePath.js resolves it); 'tsc --lsp --stdio' is its LSP (verified: initialize/hover/definition/rename/pull diagnostics).
2. packages/language-server (@lumen/language-server): vscode-languageserver 10 over stdio; spawn one TS 7 LSP per server; proxy every request/notification with deep URI rewriting (source .stsx <-> .lumen/shadow/<path>.stsx.tsx), .stsx sent as masked text (full-text didChange), on-disk shadows kept fresh with syncShadows (startup, save, close, watched .stsx files).
3. Per-version StsxSnapshot: scan(), per-block virtual CSS (blanked outside the block, $refs -> same-length identifiers), selector-class and class-attribute indexes.
4. CSS features via vscode-css-languageservice (completion, hover, colors, diagnostics, folding, highlights); cross-language class completion/definition/references/rename/highlights with component scoping from TS documentSymbol; $ref hover with folded value from TS literal types; Lumen diagnostics (scanner + provider hook) and quick fixes.
5. Protocol tests over stdio against a fixture workspace + unit tests; pnpm typecheck/test/lint.
<!-- SECTION:PLAN:END -->
