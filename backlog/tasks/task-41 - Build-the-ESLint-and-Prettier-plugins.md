---
id: TASK-41
title: Build the ESLint and Prettier plugins
status: Done
assignee:
  - Beacon
created_date: '2026-10-08 12:21'
updated_date: '2026-10-09 12:25'
labels: []
milestone: m-7
dependencies:
  - TASK-31
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: low
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Teams on ESLint or Prettier need .stsx support without the lumen wrappers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 eslint-plugin-lumen with rules and a .stsx processor; prettier-plugin-lumen formatting .stsx; tests
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-09 (user-approved): priority oxlint → oxfmt → ESLint → Prettier. Single source of truth: the compiler's LUM diagnostics; plugins are thin adapters. First verify current oxlint JS plugin support (one ESLint-compatible package may serve oxlint and ESLint) and whether oxfmt has any plugin/embedded-language API; .stsx stays on lumen lint/fmt where the tools cannot parse <style> blocks.

Beacon (2026-10-09): verified first: oxlint 1.87 JS plugins (alpha) load ESLint-v9-style plugins via jsPlugins and run them on .tsx, but no custom file formats/parsers/processors (so no .stsx); oxfmt has no plugin API (its JS format() is what lumen fmt wraps). Built: packages/eslint-plugin (@lumen/eslint-plugin): rules lumen/compiler (errors) and lumen/compiler-warnings (warnings, hints) that report compile() diagnostics (single source of truth; LUM1001 left to parsers) with help, docs topic and fixes; an ESLint processor lumen/stsx (scanner masked TSX, offset-identical; the rules compile the original .stsx text kept by preprocess); configs.recommended (flat). One package serves oxlint (jsPlugins, .tsx) and ESLint 9 (.tsx and .stsx). packages/prettier-plugin (@lumen/prettier-plugin): language stsx with an async parser running lumen fmt's formatStsx with Prettier's typescript/css printers and options; scanner/syntax errors throw. Not covered (documented): project-wide LUM4003/LUM3012 and imported $ constants (lumen check). Tests: eslint-plugin (rule positions/messages via a minimal context, processor, recommended config, real oxlint run through jsPlugins); prettier-plugin (format, idempotence incl. multi-line CSS comment, options, errors). Also checked by hand with ESLint 9.39 + typescript-eslint on a .stsx file (LUM2004 error, LUM2001 warning at the right lines). Docs: reference/cli.md 'oxlint, ESLint and Prettier'. Deps: prettier ^3.9.9 (dev, peer ^3); lockfile updated in the same commit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
@lumen/eslint-plugin (compiler diagnostics as rules for oxlint JS plugins and ESLint 9, with a .stsx processor) and @lumen/prettier-plugin (.stsx via lumen fmt's algorithm with Prettier's printers).
<!-- SECTION:FINAL_SUMMARY:END -->
