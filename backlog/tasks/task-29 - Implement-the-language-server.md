---
id: TASK-29
title: Implement the language server
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 14:03'
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
- [x] #1 Takeover proxy in front of one TS 7 native LSP for .ts/.tsx/.stsx: masked buffers, shadow URI rewriting in every request, response and workspace edit
- [x] #2 CSS language service on style blocks with $refs replaced by same-length identifiers
- [x] #3 Class completion from in-scope styles, go-to-definition and rename between classes and selectors, $ref hovers, compiler diagnostics; tests
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Probe TS 7: the typescript@7 package ships a native tsc (lib/getExePath.js resolves it); 'tsc --lsp --stdio' is its LSP (verified: initialize/hover/definition/rename/pull diagnostics).
2. packages/language-server (@lumen/language-server): vscode-languageserver 10 over stdio; spawn one TS 7 LSP per server; proxy every request/notification with deep URI rewriting (source .stsx <-> .lumen/shadow/<path>.stsx.tsx), .stsx sent as masked text (full-text didChange), on-disk shadows kept fresh with syncShadows (startup, save, close, watched .stsx files).
3. Per-version StsxSnapshot: scan(), per-block virtual CSS (blanked outside the block, $refs -> same-length identifiers), selector-class and class-attribute indexes.
4. CSS features via vscode-css-languageservice (completion, hover, colors, diagnostics, folding, highlights); cross-language class completion/definition/references/rename/highlights with component scoping from TS documentSymbol; $ref hover with folded value from TS literal types; Lumen diagnostics (scanner + provider hook) and quick fixes.
5. Protocol tests over stdio against a fixture workspace + unit tests; pnpm typecheck/test/lint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (2026-10-08): implemented packages/language-server (@lumen/language-server). Launch: `node packages/language-server/src/bin.ts --stdio` (Node >= 24 type stripping; bin `lumen-language-server`).

TS 7 launch: resolve typescript>=7 from the project (else this package's dep), call its lib/getExePath.js (same resolver the TS 7 VS Code extension mirrors) and spawn `<exe> --lsp --stdio`. TS 7 LSP facts verified empirically: positionEncoding utf-16, pull diagnostics only (textDocument/diagnostic; push only for tsconfig), semantic tokens legend follows client caps, sometimes reports lowercased paths on macOS.

Proxy architecture (src/server.ts): typed handlers for the methods Lumen augments (completion/resolve, hover, definition, references, documentHighlight, prepareRename/rename, documentColor/colorPresentation, foldingRange, formatting x3 (edits touching blocks dropped), signatureHelp, codeAction, pull diagnostics); a star handler forwards every other request/notification to TS. URIs are rewritten deeply (values + object keys such as WorkspaceEdit.changes; text fields get embedded shadow paths rewritten; `data` stays opaque). Server->client requests/notifications from TS are proxied the same way. Client capabilities sent to TS: no dynamic registration (TS selectors would exclude .stsx), pull diagnostics + refresh, utf-16; TS watches files in-process (sees the shadows the proxy writes). Push-diagnostics fallback for clients without pull.

Decisions: (1) TS diagnostics inside style blocks are dropped EXCEPT on $ref spans (e.g. TS2304 'Cannot find name' on $missing is kept: refs are type-checked, decision-6). (2) Class rename/references scope: a class defined only in component blocks of one component renames within that component; file-level/global definitions (or none) rename file-wide. Component ranges come from TS documentSymbol on the shadow. (3) Class slots: string literals at the top level/arrays/ternaries and object keys of class={...}; object values and call arguments are not classes. (4) shadows.ts imports lumen's syncShadows by relative path (packages/lumen/package.json is Lux-owned and has no tooling export) -> follow-up for Lux.

Evidence: src/server.test.ts (17 protocol tests over stdio vs real TS 7.0.2): hover/definition on .stsx symbols -> .stsx URI + exact ranges; .tsx -> unopened .stsx definition via on-disk shadows; merged TS/Lumen/CSS diagnostics with exact ranges (TS2322, TS6133, LUM1005, TS2304 on $missing, css-propertyvalueexpected); unsaved buffer masking; CSS completion+hover in blocks; $ref member completion via TS; scoped class completion; class->selector definition and selector->usage references; rename of a const used as $ref from the declaration and from the CSS $ref (TS + CSS positions); rename from tokens.ts into $refs of .stsx; class rename across selector + quoted key; $ref hover folded values (12px, #7c3aed); colors + block folding; LUM quick fix; LUM1006 in .tsx; push diagnostics mode. Unit tests: classes.test.ts, mapping.test.ts. Repo: pnpm typecheck OK, pnpm test 48 files/472 tests OK (before final LS additions; LS suite 32/32 after), pnpm lint: only a pre-existing warning in packages/lumen/src/app/router/index.ts.

Deps (deps.lock taken/released): vscode-languageserver ^10.1.2, vscode-languageserver-textdocument ^1.0.15, vscode-css-languageservice ^6.3.10, typescript ^7.0.2, @lumen/compiler workspace:*; pnpm-lock.yaml updated (additions only).

Gaps: no TS auto-restart after a crash (error message shown); compiler compile() diagnostics only via ServerOptions.diagnosticProviders (no compile() binding yet); class features are per file (global classes from other files not offered); no CSS document symbols merged into TS symbols; execution-contract hovers not implemented; TS logMessage output is forwarded verbatim (verbose).

Final validation (Beacon): pnpm typecheck OK (3 packages); pnpm test 55 files / 596 tests OK; pnpm lint: 0 errors, 1 pre-existing warning outside this package. A first full run hung in a lumen worker while other agents' in-progress tests were changing; a rerun passed and the language-server + compiler projects pass in isolation. Follow-ups recorded as TASK-48.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented @lumen/language-server (packages/language-server): a stdio LSP that takes over .ts/.tsx/.stsx in front of one TypeScript 7 native LSP (`tsc --lsp --stdio`, binary resolved via typescript/lib/getExePath.js from the project, fallback to the package's own typescript@7). .stsx documents reach TS as their shadow URIs with masked text (offset-identical, so only URIs are mapped), on-disk shadows stay in sync via lumen's syncShadows, and every request/response/server request/notification/workspace edit is URI-rewritten so results land in .stsx sources. On top: CSS features in style blocks (vscode-css-languageservice on per-block virtual CSS with same-length $ref identifiers: completion, hover, colors, diagnostics, folding, highlights), cross-language class completion/definition/references/rename/highlights scoped by component, $ref completion/hover (folded literal value) via TS, Lumen scanner diagnostics + quick fixes and a diagnosticProviders hook for compiler diagnostics, TS diagnostics filtered inside blocks except on $refs, pull diagnostics with a push fallback. Evidence: 17 stdio protocol tests against real TS 7.0.2 + 15 unit tests; repo typecheck/test/lint green. Follow-ups in TASK-48 (lumen package export for the shadow API, compile() diagnostics wiring, TS crash restart, cross-file global classes).
<!-- SECTION:FINAL_SUMMARY:END -->
