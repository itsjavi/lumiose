---
id: TASK-31
title: Implement lumen lint and lumen fmt
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 14:37'
labels: []
milestone: m-4
dependencies:
  - TASK-27
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bare oxlint and oxfmt cannot read .stsx, so Lumen wraps them around the masking invariant (spec §9.3).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumen lint runs oxlint on shadow TSX and filters diagnostics inside style blocks; optional stylelint on CSS parts
- [x] #2 lumen fmt formats TSX with oxfmt and CSS blocks separately, then re-indents and stitches; idempotent; $refs preserved
- [x] #3 Tests
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Shared helpers in packages/lumen/src/cli: tools.ts (resolve oxlint/oxfmt/stylelint from the project, then Lumen's location; JSONC config parsing; nearest config lookup; node script runner), style-css.ts (same-length $ref identifiers, virtual block CSS, reversible protectRefs).
2. lint/: oxlint -f json on the project (shadows excluded) + on the shadows with the nearest oxlint config copied to .lumen/shadow/.oxlintrc.json (layout mirrors the root so overrides/ignorePatterns match); map shadow paths/UTF-8 spans back to .stsx UTF-16 positions; drop diagnostics inside blocks except on $refs (minus no-unused-expressions); optional stylelint per block on virtual CSS.
3. fmt/: placeholders (<__lumen_style_N__ /> in JSX, /*__lumen_style_N__*/ at top level) -> oxfmt format() as .tsx; each block's CSS via oxfmt format() as .css with protected refs and printWidth reduced by the indentation; stitch + re-indent; --check.
4. CLI wiring (lumen lint [--format json], lumen fmt [--check] [paths]), lumen/tooling exports, tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (2026-10-08): implemented.

Files: packages/lumen/src/cli/{tools.ts, style-css.ts, lint/index.ts, lint/lint.test.ts, fmt/index.ts, fmt/fmt.test.ts}; main.ts (lint/fmt commands, --check, per-command option validation); tooling.ts (exports fmt, formatStsx, lint, protectRefs, refIdentifier, virtualCss for TASK-41's ESLint/Prettier plugins); check/diagnostics.ts (DiagnosticSource += oxlint | stylelint); check/shadow.ts (loadCompiler exported).

Decisions/findings:
- oxfmt 0.72's JS API format(fileName, text, options) formats CSS too (bundled Prettier postcss), so no Prettier fallback is needed; oxfmt (and oxlint) are resolved from the project, falling back to Lumen's own location, else a tool failure (exit 2) with an install hint. Options come from the nearest .oxfmtrc.json(c) (format() does not discover configs); its ignorePatterns are honoured (gitignore-style -> globs via path.matchesGlob); overrides are not applied.
- oxlint skips explicit paths matched by ignorePatterns of the discovered config (a typical **/.lumen/** blocks shadows) and passing the shadow dir finds no files, so shadows are passed as explicit paths with -c .lumen/shadow/.oxlintrc.json (a copy of the nearest .oxlintrc.json(c), $schema dropped, relative extends/jsPlugins made absolute). Verified: an override for src/components/** and an ignorePattern src/ignored/** apply to the shadows. The project run adds --ignore-pattern=**/.lumen/**.
- oxlint spans are UTF-8 byte offsets of the linted text: converted with the shadow's masked text, then positioned in the source (same UTF-16 offsets).
- Inside blocks: dropped unless the span starts on a $ref; no-unused-expressions (the ;ref; masking of top-level blocks) is always dropped; e.g. no-undef on $missing is kept.
- stylelint: used only if resolvable from the project; per block (SVG blocks skipped) on whole-file virtual CSS (same lines/columns) with codeFilename <source>.stsx.css; warnings starting on a ref placeholder are dropped; 'No configuration provided' -> note on stderr, not a failure.
- fmt: files with scanner errors (LUM1004 unclosed, LUM1005 attributes, ...) or blocks in expression position are reported and left unchanged (exit 1); a block whose CSS does not parse is kept verbatim with a warning; JSX blocks sharing a line with other JSX children (e.g. 'a <style>…</style> b') stay verbatim; a top-level block sharing a line moves to its own line. Indent unit from useTabs/tabWidth, EOL from endOfLine, CSS printWidth = printWidth - indentation (min 40). Same-length ref placeholders avoid identifiers already in the block ($gap next to a literal _gap -> _ga0).

Evidence:
- lint/lint.test.ts (4, real oxlint 1.87 on temp projects outside git): no-unused-vars at 4:7-4:13 in .stsx; no-debugger after '→é😀' at the UTF-16 column and as warning via the override (shadow config); no-undef on $missing kept; no-unused-expressions and in-block diagnostics dropped; project .ts diagnostic reported; ignored dir skipped; no .lumen paths; stylelint stub: one color-no-invalid-hex at the source line/column, placeholder warning dropped, virtual CSS same length as the source; unconfigured stylelint -> note; 'lumen lint --format json' JSON report + exit 1.
- fmt/fmt.test.ts (8, real oxfmt 0.72): exact output for a messy file (component block, top-level block, <style global>, $refs incl. @media/calc), every case formatted twice to check idempotence (nested/inline/SVG/empty/line-sharing blocks), ref protection next to look-alike identifiers, useTabs/semi:false/tabWidth/CRLF, LUM1004 + TSX syntax errors, invalid CSS kept with a warning, CLI --check (lists file, exit 1, no write), write mode with .oxfmtrc.json (JSONC, semi:false, ignorePatterns), second --check clean, --check rejected for lint.
- Manual: node packages/lumen/src/cli/bin.ts lint --root <tmp project> prints code frames for .stsx diagnostics at source positions.
- pnpm typecheck OK; pnpm lint: 0 errors (warnings only pre-existing, outside cli/); vitest: cli 24/25 — the 1 failure (check.test.ts tsconfig warning) and 2 more in app/ (typegen, public-api) all come from the uncommitted packages/lumen/src/dom/component.ts change (import.meta.env -> TS2339 in type-checked fixtures, Spark's area), not from this task.

Limitations: stylelint not exercised for real (not installed in the repo; stub-tested against its Node API shape); oxlint/oxfmt JS/TS config files are not read (JSON/JSONC only); oxfmt overrides not applied to .stsx; a config found in an ancestor dir has its globs matched relative to the project root for shadows; lumen fmt formats .stsx only (oxfmt handles other files); no lint --fix.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added lumen lint and lumen fmt (packages/lumen/src/cli/{lint,fmt}, shared tools.ts + style-css.ts, wired in main.ts, exported from lumen/tooling).

lumen lint [--format json]: syncs shadows, runs oxlint -f json on the project (shadows excluded) and on the shadow TSX with the project's oxlint config copied to the shadow root (so overrides/ignorePatterns still match), maps shadow paths and UTF-8 spans back to .stsx UTF-16 positions, drops diagnostics inside style blocks except on $refs (never no-unused-expressions, the masking artefact), and runs stylelint per block on same-length-ref virtual CSS when the project installs and configures it. Output reuses the lumen check report (human code frames or stable JSON; sources oxlint/stylelint); exit 0/1/2.

lumen fmt [--check] [paths]: formats the TSX with oxfmt with blocks replaced by placeholders, each block's CSS with oxfmt (which formats CSS natively) with $refs protected by unique same-length identifiers, then re-indents and stitches; honours .oxfmtrc.json(c) options and ignorePatterns; idempotent; files with scanner/syntax errors are reported and untouched; --check lists unformatted files and exits 1.

Evidence: 12 tests with real oxlint 1.87 / oxfmt 0.72 (positions incl. non-ASCII, filtering, overrides on shadows, stylelint stub mapping, JSON CLI; exact formatting, double-pass idempotence, ref preservation, config options, errors, CLI check/write). typecheck + lint green; 3 unrelated repo test failures come from an in-progress import.meta.env change in packages/lumen/src/dom/component.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
